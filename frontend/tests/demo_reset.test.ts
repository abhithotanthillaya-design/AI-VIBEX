import assert from 'node:assert/strict'
import test from 'node:test'
import type { DemoResetResponse } from '../src/types/index.ts'
import { executeGuardedDemoReset } from '../src/utils/demoReset.ts'

test('executeGuardedDemoReset refuses unconfirmed execution', async () => {
  const guard = { current: false }
  let called = false

  const outcome = await executeGuardedDemoReset({
    isConfirmed: false,
    guard,
    resetFn: async () => {
      called = true
      return {
        status: 'ok',
        deleted_orders: 0,
        deleted_order_items: 0,
        available_menu_items: 11,
        message: 'Reset',
      }
    },
    onAfterSuccess: () => {},
  })

  assert.equal(called, false)
  assert.equal(outcome.status, 'ignored_unconfirmed')
})

test('executeGuardedDemoReset prevents duplicate concurrent reset requests and refreshes UI on success', async () => {
  const guard = { current: false }
  let apiCalls = 0
  let refreshed = false
  let resolveReset!: (value: DemoResetResponse) => void

  const pendingPromise = new Promise<DemoResetResponse>((resolve) => {
    resolveReset = resolve
  })

  const firstCall = executeGuardedDemoReset({
    isConfirmed: true,
    guard,
    resetFn: () => {
      apiCalls += 1
      return pendingPromise
    },
    onAfterSuccess: () => {
      refreshed = true
    },
  })

  // Second overlapping call while first is in flight must be ignored
  const secondCall = await executeGuardedDemoReset({
    isConfirmed: true,
    guard,
    resetFn: async () => {
      apiCalls += 1
      return {
        status: 'ok',
        deleted_orders: 0,
        deleted_order_items: 0,
        available_menu_items: 11,
        message: 'Duplicate',
      }
    },
    onAfterSuccess: () => {},
  })

  assert.equal(secondCall.status, 'ignored_duplicate')
  assert.equal(apiCalls, 1)

  resolveReset({
    status: 'ok',
    deleted_orders: 3,
    deleted_order_items: 5,
    available_menu_items: 11,
    message: 'Demo reset complete.',
  })

  const firstOutcome = await firstCall
  assert.equal(firstOutcome.status, 'success')
  assert.equal(refreshed, true)
  assert.equal(guard.current, false)
})

test('executeGuardedDemoReset surfaces API errors without claiming success', async () => {
  const guard = { current: false }
  let refreshed = false

  const outcome = await executeGuardedDemoReset({
    isConfirmed: true,
    guard,
    resetFn: async () => {
      throw new Error('Demo reset is disabled in this environment.')
    },
    onAfterSuccess: () => {
      refreshed = true
    },
  })

  assert.equal(outcome.status, 'error')
  if (outcome.status === 'error') {
    assert.equal(outcome.message, 'Demo reset is disabled in this environment.')
  }
  assert.equal(refreshed, false)
  assert.equal(guard.current, false)
})

