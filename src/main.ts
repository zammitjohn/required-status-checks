import * as core from '@actions/core'
import { getStatusChecks, type StatusCheck } from './github.js'

const POLL_INTERVAL = 30000 // 30 seconds

export async function run(): Promise<void> {
  try {
    const statusRegex = new RegExp(core.getInput('status-regex'))
    const expectedChecks = parseInt(core.getInput('expected-checks'), 10)

    if (isNaN(expectedChecks) || expectedChecks < 1) {
      throw new Error('expected-checks must be a positive number')
    }

    while (true) {
      const checks = await getStatusChecks()
      core.debug(`Found ${checks.length} checks`)

      const matchedChecks = checks.filter((check) =>
        statusRegex.test(check.context)
      )

      if (matchedChecks.length > 0) {
        core.debug(`Found ${matchedChecks.length} matching checks`)

        // Group checks by context and get latest for each
        const latestChecks = new Map<string, StatusCheck>()
        for (const check of matchedChecks) {
          const existing = latestChecks.get(check.context)
          if (
            !existing ||
            new Date(check.created_at) > new Date(existing.created_at)
          ) {
            latestChecks.set(check.context, check)
          }
        }

        // Track successful checks
        let successfulChecks = 0

        // Evaluate only the latest status for each context
        for (const check of latestChecks.values()) {
          if (check.state === 'failure') {
            throw new Error(`❌ Check '${check.context}' failed`)
          }
          if (check.state === 'success') {
            core.info(`📋 Check '${check.context}' passed`)
            successfulChecks++
          }
        }

        // Exit if we have the expected number of successful checks
        if (successfulChecks === expectedChecks) {
          core.info(
            `✅ All ${expectedChecks} expected checks have passed successfully`
          )
          return
        }
      } else {
        core.info('🔄 No matching checks found yet, continuing to poll...')
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
