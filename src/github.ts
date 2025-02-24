import * as github from '@actions/github'

export interface StatusCheck {
  context: string
  state: string
  created_at: string
}

export async function getStatusChecks(): Promise<StatusCheck[]> {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN is required')
  }

  const octokit = github.getOctokit(githubToken)
  const context = github.context

  // Determine the correct SHA to use
  const sha = context.payload.pull_request
    ? context.payload.pull_request.head.sha
    : context.sha

  const response = await octokit.rest.repos.listCommitStatusesForRef({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: sha
  })

  return response.data.map((status) => ({
    context: status.context,
    state: status.state,
    created_at: status.created_at
  }))
}
