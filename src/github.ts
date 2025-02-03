import * as github from '@actions/github'

export interface StatusCheck {
  context: string
  state: string
  description: string
}

export async function getStatusChecks(): Promise<StatusCheck[]> {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN is required')
  }

  const octokit = github.getOctokit(githubToken)
  const context = github.context

  const response = await octokit.rest.repos.listCommitStatusesForRef({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: context.sha
  })

  return response.data.map((status) => ({
    context: status.context,
    state: status.state,
    description: status.description || ''
  }))
}
