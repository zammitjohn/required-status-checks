# Required Status Checks

[![GitHub Super-Linter](https://github.com/zammitjohn/required-status-checks/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/zammitjohn/required-status-checks/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/zammitjohn/required-status-checks/actions/workflows/check-dist.yml/badge.svg)](https://github.com/zammitjohn/required-status-checks/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/zammitjohn/required-status-checks/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/zammitjohn/required-status-checks/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub Action monitors status checks that match a specific regular
expression pattern and waits for them to complete successfully. It's useful when
you need to ensure certain status checks have passed before proceeding with
subsequent workflow steps.

## Features

- Monitor status checks using regular expression pattern matching
- Wait for a specific number of checks to pass
- Fail immediately if any matching check fails

## Usage

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Wait for required checks
    uses: zammitjohn/required-status-checks@v1
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    with:
      status-regex: 'build|test' # Match checks containing 'build' or 'test'
      expected-checks: '2' # Wait for 2 matching checks to pass
```

## Integration with Repository Rulesets

This action can be used in combination with GitHub repository rulesets to
enforce status checks before merging pull requests. To set this up:

1. Go to your repository's Settings > Rules > Rulesets
2. Create a new ruleset or edit an existing one
3. Under "Status checks that are required", select the status checks that must
   pass
4. Enable "Require status checks to pass before merging" and select the status
   check where this action is invoked

This ensures that pull requests can only be merged after the specified status
checks complete successfully.

## Inputs

| Input             | Description                                    | Required | Default |
| ----------------- | ---------------------------------------------- | -------- | ------- |
| `status-regex`    | Regular expression to match status check names | Yes      | N/A     |
| `expected-checks` | Number of checks that should match and pass    | Yes      | '1'     |

## Examples

### Wait for specific CI checks

```yaml
- name: Wait for CI checks
  uses: zammitjohn/required-status-checks@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    status-regex: '^ci/.*'
    expected-checks: '3'
```

### Wait for deployment checks

```yaml
- name: Wait for deployments
  uses: zammitjohn/required-status-checks@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    status-regex: 'deploy-to-.*'
    expected-checks: '1'
```

### Wait for multiple test checks with timeout

```yaml
- name: Wait for test suite checks
  uses: zammitjohn/required-status-checks@v1
  timeout-minutes: 5
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    status-regex: '^test-.*'
    expected-checks: '2'
```
