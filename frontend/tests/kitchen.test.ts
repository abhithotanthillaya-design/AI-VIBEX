import assert from 'node:assert/strict'
import test from 'node:test'
import type { OrderDetail } from '../src/types/index.ts'
import {
  computeKitchenSummary,
  getOrderSlotUrgency,
  groupOrdersBySlot,
  NEXT_KITCHEN_ACTION,
} from '../src/utils/kitchen.ts'

function makeOrder(
  id: string,
  status: OrderDetail['status'],
  slotStart: string,
  slotEnd: string,
  prepUnits: number,
): OrderDetail {
  return {
    id,
    pickup_code: id.toUpperCase().slice(0, 4),
    customer_name: 'Student',
    status,
    pickup_slot_start: slotStart,
    pickup_slot_end: slotEnd,
    total_amount: 5000,
    total_prep_units: prepUnits,
    notes: null,
    created_at: '2026-11-12T12:45:00+05:30',
    updated_at: '2026-11-12T12:45:00+05:30',
    items: [],
  }
}

test('computeKitchenSummary and groupOrdersBySlot aggregate queue state cleanly', () => {
  const orders = [
    makeOrder('ord_1', 'PLACED', '2026-11-12T12:50:00+05:30', '2026-11-12T12:55:00+05:30', 6),
    makeOrder('ord_2', 'ACCEPTED', '2026-11-12T12:50:00+05:30', '2026-11-12T12:55:00+05:30', 4),
    makeOrder('ord_3', 'PREPARING', '2026-11-12T12:55:00+05:30', '2026-11-12T13:00:00+05:30', 5),
    makeOrder('ord_4', 'READY', '2026-11-12T12:55:00+05:30', '2026-11-12T13:00:00+05:30', 3),
  ]

  const summary = computeKitchenSummary(orders)
  assert.deepEqual(summary, {
    placed: 1,
    accepted: 1,
    preparing: 1,
    ready: 1,
    totalActive: 4,
  })

  const groups = groupOrdersBySlot(orders)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].totalPrepUnits, 10)
  assert.equal(groups[0].orders.length, 2)
  assert.equal(groups[1].totalPrepUnits, 8)
})

test('NEXT_KITCHEN_ACTION enforces confirmation only before COLLECTED', () => {
  assert.equal(NEXT_KITCHEN_ACTION.PLACED?.nextStatus, 'ACCEPTED')
  assert.equal(NEXT_KITCHEN_ACTION.PLACED?.requiresConfirmation, false)
  assert.equal(NEXT_KITCHEN_ACTION.ACCEPTED?.nextStatus, 'PREPARING')
  assert.equal(NEXT_KITCHEN_ACTION.PREPARING?.nextStatus, 'READY')
  assert.equal(NEXT_KITCHEN_ACTION.READY?.nextStatus, 'COLLECTED')
  assert.equal(NEXT_KITCHEN_ACTION.READY?.requiresConfirmation, true)
  assert.equal(NEXT_KITCHEN_ACTION.COLLECTED, undefined)
})

test('getOrderSlotUrgency classifies due, soon, and scheduled windows accurately', () => {
  const slotStart = '2026-11-12T12:50:00+05:30'
  const slotMs = new Date(slotStart).getTime()

  assert.equal(getOrderSlotUrgency(slotStart, 'PLACED', slotMs + 1000), 'due')
  assert.equal(getOrderSlotUrgency(slotStart, 'PREPARING', slotMs - 120_000), 'soon')
  assert.equal(getOrderSlotUrgency(slotStart, 'PLACED', slotMs - 900_000), 'scheduled')
  assert.equal(getOrderSlotUrgency(slotStart, 'READY', slotMs + 1000), 'scheduled')
})

