import * as core from '@actions/core'
import { getStatusChecks, type StatusCheck } from './github.js'

const POLL_INTERVAL = 30000 // 30 seconds

function getTimestamp(): string {
  return new Date().toISOString()
}

export async function run(): Promise<void> {
  try {
    const statusRegex = new RegExp(core.getInput('status-regex'))
    const expectedChecks = parseInt(core.getInput('expected-checks'), 10)

    if (isNaN(expectedChecks) || expectedChecks < 1) {
      throw new Error('expected-checks must be a positive number')
    }

    core.info(`[${getTimestamp()}] 🔍 Starting to monitor status checks...`)
    core.info(`[${getTimestamp()}] ⚙️ Configuration:`)
    core.info(`   • Status regex: ${statusRegex}`)
    core.info(`   • Expected checks: ${expectedChecks}`)

    let pollCount = 0
    while (true) {
      pollCount++
      const checks = await getStatusChecks()
      core.debug(`[${getTimestamp()}] Found ${checks.length} total checks`)

      const matchedChecks = checks.filter((check) =>
        statusRegex.test(check.context)
      )

      if (matchedChecks.length > 0) {
        core.info(`\n[${getTimestamp()}] 📊 Poll #${pollCount} Status:`)

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

        let successfulChecks = 0
        let pendingChecks = 0

        // Evaluate only the latest status for each context
        for (const check of latestChecks.values()) {
          const status = (() => {
            switch (check.state) {
              case 'success':
                return '✅'
              case 'failure':
                return '❌'
              default:
                return '⏳'
            }
          })()

          core.info(`   ${status} ${check.context} (${check.state})`)

          if (check.state === 'failure') {
            throw new Error(
              `[${getTimestamp()}] ❌ Check '${check.context}' failed`
            )
          }
          if (check.state === 'success') {
            successfulChecks++
          }
          if (check.state === 'pending') {
            pendingChecks++
          }
        }

        core.info(
          `\n   Summary: ${successfulChecks}/${expectedChecks} passed, ${pendingChecks} pending`
        )

        if (successfulChecks === expectedChecks) {
          core.info(
            `\n[${getTimestamp()}] ✅ Success! All ${expectedChecks} expected checks have passed`
          )
          core.info(`   Total polls: ${pollCount}`)
          return
        }
      } else {
        core.info(
          `[${getTimestamp()}] ⏳ Poll #${pollCount}: No matching checks found yet`
        )
      }

      core.info(
        `[${getTimestamp()}] 🔄 Polling again in ${POLL_INTERVAL / 1000} seconds...`
      )
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
