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
        { context: 'check1', state: 'success', description: 'Check 1 passed' },
        { context: 'check2', state: 'success', description: 'Check 2 passed' }
      ])
    })

    afterEach(() => {
      jest.resetAllMocks()
      jest.useRealTimers()
    })

    it('Exits successfully when expected checks pass', async () => {
      await run()

      expect(core.info).toHaveBeenCalledWith(
        '✅ All 2 expected checks have passed successfully'
      )
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
        { context: 'check1', state: 'failure', description: 'Check 1 failed' }
      ])

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        "❌ Check 'check1' failed: Check 1 failed"
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
              description: 'Check 1 passed'
            },
            // check2 pending initially
            {
              context: 'check2',
              state: 'pending',
              description: 'Check 2 running'
            }
          ]
        }
        return [
          {
            context: 'check1',
            state: 'success',
            description: 'Check 1 passed'
          },
          { context: 'check2', state: 'success', description: 'Check 2 passed' }
        ]
      })

      const runPromise = run()
      await jest.advanceTimersByTimeAsync(30000)
      await runPromise

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 30000)
      expect(core.info).toHaveBeenCalledWith("📋 Check 'check1' passed")
      expect(core.info).toHaveBeenCalledWith("📋 Check 'check2' passed")
      expect(core.info).toHaveBeenCalledWith(
        '✅ All 2 expected checks have passed successfully'
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
            description: 'Check 1 passed'
          },
          { context: 'check2', state: 'success', description: 'Check 2 passed' }
        ]
      })

      const runPromise = run()
      await jest.advanceTimersByTimeAsync(30000)
      await runPromise

      expect(core.info).toHaveBeenCalledWith(
        '🔄 No matching checks found yet, continuing to poll...'
      )
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 30000)
      expect(core.info).toHaveBeenCalledWith(
        '✅ All 2 expected checks have passed successfully'
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
              description: 'Check 1 passed'
            }
          ]
        }
        return [
          {
            context: 'check1',
            state: 'success',
            description: 'Check 1 passed'
          },
          { context: 'check2', state: 'success', description: 'Check 2 passed' }
        ]
      })

      const runPromise = run()
      await jest.advanceTimersByTimeAsync(30000)
      await jest.advanceTimersByTimeAsync(30000)
      await runPromise

      expect(setTimeout).toHaveBeenCalledTimes(2)
      expect(getStatusChecks).toHaveBeenCalledTimes(3)
      expect(core.info).toHaveBeenCalledWith(
        '✅ All 2 expected checks have passed successfully'
      )
    })
  })
})
