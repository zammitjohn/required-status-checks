/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import {
  jest,
  describe,
  beforeAll,
  beforeEach,
  afterEach,
  it,
  expect
} from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import { getStatusChecks } from '../__fixtures__/github.js'

// Helper to match timestamp format in logs
const timestampRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/

// Helper to create dynamic matchers for timestamped messages
const withTimestamp = (message: string) =>
  expect.stringMatching(new RegExp(`${timestampRegex.source} ${message}`))

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/github.js', () => ({ getStatusChecks }))

describe('main.ts', () => {
  let run: () => Promise<void>

  beforeAll(async () => {
    // The module being tested should be imported dynamically. This ensures that the
    // mocks are used in place of any actual dependencies.
    ;({ run } = await import('../src/main.js'))
  })

  describe('main.ts', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.spyOn(global, 'setTimeout')

      core.getInput.mockImplementation((name) => {
        if (name === 'status-regex') return '.*'
        if (name === 'expected-checks') return '2'
        return ''
      })

      getStatusChecks.mockImplementation(async () => [
        {
          context: 'check1',
          state: 'success',
          created_at: '2025-02-22T09:41:24Z'
        },
        {
          context: 'check2',
          state: 'success',
          created_at: '2025-02-22T09:41:24Z'
        }
      ])
    })

    afterEach(() => {
      jest.resetAllMocks()
      jest.useRealTimers()
    })

    it('Exits successfully when expected checks pass', async () => {
      await run()

      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('🔍 Starting to monitor status checks...')
      )
      expect(core.info).toHaveBeenCalledWith(withTimestamp('⚙️ Configuration:'))
      expect(core.info).toHaveBeenCalledWith('   • Status regex: /.*/')
      expect(core.info).toHaveBeenCalledWith('   • Expected checks: 2')
      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('📊 Poll #1 Status:')
      )
      expect(core.info).toHaveBeenCalledWith('   ✅ check1 (success)')
      expect(core.info).toHaveBeenCalledWith('   ✅ check2 (success)')
      expect(core.info).toHaveBeenCalledWith(
        '\n   Summary: 2/2 passed, 0 pending'
      )
      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('✅ Success! All 2 expected checks have passed')
      )
      expect(core.info).toHaveBeenCalledWith('   Total polls: 1')
    })

    it('Throws an error if expected-checks is not a positive number', async () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'status-regex') return '.*'
        if (name === 'expected-checks') return '-1'
        return ''
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'expected-checks must be a positive number'
      )
    })

    it('Throws an error if a check fails', async () => {
      getStatusChecks.mockImplementation(async () => [
        {
          context: 'check1',
          state: 'failure',
          created_at: '2025-02-22T09:41:24Z'
        }
      ])

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        withTimestamp("❌ Check 'check1' failed")
      )
    })

    it('Polls until all expected checks pass', async () => {
      let callCount = 0
      getStatusChecks.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return [
            {
              context: 'check1',
              state: 'success',
              created_at: '2025-02-22T09:41:24Z'
            },
            // check2 pending initially
            {
              context: 'check2',
              state: 'pending',
              created_at: '2025-02-22T09:41:24Z'
            }
          ]
        }
        return [
          {
            context: 'check1',
            state: 'success',
            created_at: '2025-02-22T09:41:24Z'
          },
          {
            context: 'check2',
            state: 'success',
            created_at: '2025-02-22T09:41:25Z'
          }
        ]
      })

      const runPromise = run()
      await jest.advanceTimersByTimeAsync(30000)
      await runPromise

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 30000)
      expect(core.info).toHaveBeenCalledWith('   ✅ check1 (success)')
      expect(core.info).toHaveBeenCalledWith('   ✅ check2 (success)')
      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('✅ Success! All 2 expected checks have passed')
      )
    })

    it('Continues polling when no matching checks are found', async () => {
      let callCount = 0
      getStatusChecks.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return []
        }
        return [
          {
            context: 'check1',
            state: 'success',
            created_at: '2025-02-22T09:41:24Z'
          },
          {
            context: 'check2',
            state: 'success',
            created_at: '2025-02-22T09:41:24Z'
          }
        ]
      })

      const runPromise = run()
      await jest.advanceTimersByTimeAsync(30000)
      await runPromise

      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('⏳ Poll #1: No matching checks found yet')
      )
      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('🔄 Polling again in 30 seconds...')
      )
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 30000)
      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('✅ Success! All 2 expected checks have passed')
      )
    })

    it('Handles multiple polling cycles before success', async () => {
      let callCount = 0
      getStatusChecks.mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return []
        }
        if (callCount === 2) {
          return [
            {
              context: 'check1',
              state: 'success',
              created_at: '2025-02-22T09:41:24Z'
            }
          ]
        }
        return [
          {
            context: 'check1',
            state: 'success',
            created_at: '2025-02-22T09:41:24Z'
          },
          {
            context: 'check2',
            state: 'success',
            created_at: '2025-02-22T09:41:25Z'
          }
        ]
      })

      const runPromise = run()
      await jest.advanceTimersByTimeAsync(30000)
      await jest.advanceTimersByTimeAsync(30000)
      await runPromise

      expect(setTimeout).toHaveBeenCalledTimes(2)
      expect(getStatusChecks).toHaveBeenCalledTimes(3)
      expect(core.info).toHaveBeenCalledWith(
        withTimestamp('✅ Success! All 2 expected checks have passed')
      )
      expect(core.info).toHaveBeenCalledWith('   Total polls: 3')
    })

    it('Uses status regex to filter checks', async () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'status-regex') return 'test.*'
        if (name === 'expected-checks') return '1'
        return ''
      })

      getStatusChecks.mockImplementation(async () => [
        {
          context: 'test-check',
          state: 'success',
          created_at: '2025-02-22T09:41:24Z'
        },
        {
          context: 'other-check',
          state: 'success',
          created_at: '2025-02-22T09:41:24Z'
        }
      ])

      await run()

      expect(core.info).toHaveBeenCalledWith('   ✅ test-check (success)')
      expect(core.info).not.toHaveBeenCalledWith(
        expect.stringContaining('other-check')
      )
      expect(core.info).toHaveBeenCalledWith(
        '\n   Summary: 1/1 passed, 0 pending'
      )
    })

    it('Evaluates only the latest status for each context', async () => {
      getStatusChecks.mockImplementation(async () => [
        {
          context: 'check1',
          state: 'success',
          created_at: '2025-02-22T09:41:24Z'
        },
        {
          context: 'check1',
          state: 'failure',
          created_at: '2025-02-22T09:41:25Z'
        },
        {
          context: 'check2',
          state: 'pending',
          created_at: '2025-02-22T09:41:24Z'
        },
        {
          context: 'check2',
          state: 'success',
          created_at: '2025-02-22T09:41:25Z'
        }
      ])

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        withTimestamp("❌ Check 'check1' failed")
      )
    })
  })
})
