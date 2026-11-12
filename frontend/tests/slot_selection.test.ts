import assert from 'node:assert/strict'
import test from 'node:test'
import type { AvailablePickupSlot } from '../src/types/index.ts'
import { formatTimeWindow } from '../src/utils/format.ts'
import {
  getSlotAvailabilityBadge,
  isSlotAllocationErrorCode,
  resolveCheckoutSlotSelection,
} from '../src/utils/slots.ts'

function makeSlot(
  overrides: Partial<AvailablePickupSlot> & {
    slot_start: string
    slot_end: string
  },
): AvailablePickupSlot {
  return {
    capacity_units: 12,
    used_units: 0,
    remaining_units: 12,
    active_orders: 0,
    availability_state: 'available',
    is_closed: false,
    close_reason: null,
    is_full: false,
    is_feasible: true,
    ...overrides,
  }
}

const SLOTS: AvailablePickupSlot[] = [
  makeSlot({
    slot_start: '2026-11-12T12:20:00+05:30',
    slot_end: '2026-11-12T12:25:00+05:30',
    used_units: 12,
    remaining_units: 0,
    active_orders: 2,
    availability_state: 'full',
    is_full: true,
    is_feasible: false,
  }),
  makeSlot({
    slot_start: '2026-11-12T12:25:00+05:30',
    slot_end: '2026-11-12T12:30:00+05:30',
    used_units: 0,
    remaining_units: 12,
    availability_state: 'closed',
    is_closed: true,
    close_reason: 'Cleaning',
    is_feasible: false,
  }),
  makeSlot({
    slot_start: '2026-11-12T12:30:00+05:30',
    slot_end: '2026-11-12T12:35:00+05:30',
    used_units: 8,
    remaining_units: 4,
    active_orders: 1,
    availability_state: 'limited',
    is_feasible: true,
  }),
  makeSlot({
    slot_start: '2026-11-12T12:35:00+05:30',
    slot_end: '2026-11-12T12:40:00+05:30',
    used_units: 2,
    remaining_units: 10,
    active_orders: 1,
    availability_state: 'available',
    is_feasible: true,
  }),
]

test('getSlotAvailabilityBadge classifies available, limited, full, closed, and tight slots cleanly', () => {
  assert.deepEqual(getSlotAvailabilityBadge(SLOTS[0], 4), {
    label: 'Full',
    tone: 'rose',
  })
  assert.deepEqual(getSlotAvailabilityBadge(SLOTS[1], 4), {
    label: 'Closed',
    tone: 'stone',
  })
  assert.deepEqual(getSlotAvailabilityBadge(SLOTS[2], 4), {
    label: 'Limited availability',
    tone: 'amber',
  })
  assert.deepEqual(getSlotAvailabilityBadge(SLOTS[3], 4), {
    label: 'Available',
    tone: 'emerald',
  })

  const tightSlot = { ...SLOTS[2], is_feasible: false }
  assert.deepEqual(getSlotAvailabilityBadge(tightSlot, 6), {
    label: 'Not enough space',
    tone: 'amber',
  })
})

test('resolveCheckoutSlotSelection defaults to earliest feasible slot in auto mode', () => {
  const resolved = resolveCheckoutSlotSelection({
    slots: SLOTS,
    selectedSlotStart: null,
    selectionMode: 'auto',
    recommendedSlotStart: SLOTS[2].slot_start,
    orderWorkloadUnits: 4,
  })

  assert.equal(resolved.effectiveSlotStart, SLOTS[2].slot_start)
  assert.equal(resolved.selectedSlot?.slot_start, SLOTS[2].slot_start)
  assert.equal(resolved.unavailableWarning, null)
  assert.equal(resolved.isUsingDefaultEarliest, true)
})

test('resolveCheckoutSlotSelection supports manual and natural preselection without silent reassignment on conflict', () => {
  // Manual choice of slot 3 (later than earliest feasible slot 2)
  const manual = resolveCheckoutSlotSelection({
    slots: SLOTS,
    selectedSlotStart: SLOTS[3].slot_start,
    selectionMode: 'manual',
    recommendedSlotStart: SLOTS[2].slot_start,
    orderWorkloadUnits: 6,
  })
  assert.equal(manual.effectiveSlotStart, SLOTS[3].slot_start)
  assert.equal(manual.unavailableWarning, null)
  assert.equal(manual.isUsingDefaultEarliest, false)

  // Previously selected or NL-preselected slot becomes full -> blocked with clear explanation (no silent shift!)
  const becameFull = resolveCheckoutSlotSelection({
    slots: SLOTS,
    selectedSlotStart: SLOTS[0].slot_start,
    selectionMode: 'natural',
    recommendedSlotStart: SLOTS[2].slot_start,
    orderWorkloadUnits: 4,
  })
  assert.equal(becameFull.effectiveSlotStart, null)
  assert.ok(becameFull.unavailableWarning?.toLowerCase().includes('now full'))
  assert.equal(becameFull.isUsingDefaultEarliest, false)

  // Previously selected slot closed by manager -> shows closure reason, never silently switches
  const becameClosed = resolveCheckoutSlotSelection({
    slots: SLOTS,
    selectedSlotStart: SLOTS[1].slot_start,
    selectionMode: 'manual',
    recommendedSlotStart: SLOTS[2].slot_start,
    orderWorkloadUnits: 4,
  })
  assert.equal(becameClosed.effectiveSlotStart, null)
  assert.ok(becameClosed.unavailableWarning?.includes('Cleaning'))

  // Workload exceeds remaining units on chosen slot (4 remaining, order needs 6)
  const tighterSlots = SLOTS.map((slot, idx) =>
    idx === 2 ? { ...slot, is_feasible: false } : slot,
  )
  const insufficient = resolveCheckoutSlotSelection({
    slots: tighterSlots,
    selectedSlotStart: SLOTS[2].slot_start,
    selectionMode: 'manual',
    recommendedSlotStart: SLOTS[3].slot_start,
    orderWorkloadUnits: 6,
  })
  assert.equal(insufficient.effectiveSlotStart, null)
  assert.ok(insufficient.unavailableWarning?.includes('4 units left'))
})

test('isSlotAllocationErrorCode and formatTimeWindow cover checkout refresh triggers cleanly', () => {
  assert.equal(isSlotAllocationErrorCode('slot_full'), true)
  assert.equal(isSlotAllocationErrorCode('slot_closed'), true)
  assert.equal(isSlotAllocationErrorCode('slot_insufficient_capacity'), true)
  assert.equal(isSlotAllocationErrorCode('slot_in_past'), true)
  assert.equal(isSlotAllocationErrorCode('unknown_menu_item'), false)
  assert.equal(isSlotAllocationErrorCode(undefined), false)

  const label = formatTimeWindow(SLOTS[2].slot_start, SLOTS[2].slot_end)
  assert.ok(label.includes('12:30') && label.includes('12:35'))
})

