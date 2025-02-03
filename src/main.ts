import * as core from '@actions/core'
import { getStatusChecks } from './github.js'

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

        // Track successful checks
        let successfulChecks = 0

        for (const check of matchedChecks) {
          if (check.state === 'failure') {
            throw new Error(
              `❌ Check '${check.context}' failed: ${check.description}`
            )
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
