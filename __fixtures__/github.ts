import { jest } from '@jest/globals'

export const getStatusChecks =
  jest.fn<typeof import('../src/github.js').getStatusChecks>()
