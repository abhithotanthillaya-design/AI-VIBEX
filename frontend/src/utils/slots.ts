import type { AvailablePickupSlot } from '../types/index.ts'
import { formatTimeWindow } from './format.ts'

export type SlotSelectionMode = 'auto' | 'manual' | 'natural'

export type SlotBadgeTone = 'emerald' | 'amber' | 'rose' | 'stone'

export interface SlotBadgeInfo {
  label: string
  tone: SlotBadgeTone
}

export const SLOT_ERROR_CODES = new Set<string>([
  'slot_closed',
  'slot_full',
  'slot_insufficient_capacity',
  'slot_in_past',
  'slot_out_of_range',
  'invalid_requested_slot',
  'kitchen_full',
])

export function isSlotAllocationErrorCode(code?: string): boolean {
  return Boolean(code && SLOT_ERROR_CODES.has(code))
}

export function getSlotAvailabilityBadge(
  slot: AvailablePickupSlot,
  orderWorkloadUnits = 0,
): SlotBadgeInfo {
  if (slot.is_closed || slot.availability_state === 'closed') {
    return { label: 'Closed', tone: 'stone' }
  }
  if (slot.is_full || slot.availability_state === 'full') {
    return { label: 'Full', tone: 'rose' }
  }
  if (!slot.is_feasible && orderWorkloadUnits > 0) {
    return { label: 'Not enough space', tone: 'amber' }
  }
  if (slot.availability_state === 'limited') {
    return { label: 'Limited availability', tone: 'amber' }
  }
  return { label: 'Available', tone: 'emerald' }
}

export interface ResolvedCheckoutSlot {
  effectiveSlotStart: string | null
  selectedSlot: AvailablePickupSlot | null
  unavailableWarning: string | null
  isUsingDefaultEarliest: boolean
}

/**
 * Resolve which pickup slot is currently selected in checkout without silently
 * moving a student away from an explicitly chosen or NL-preselected slot that
 * became full, closed, or too small.
 */
export function resolveCheckoutSlotSelection(params: {
  slots: AvailablePickupSlot[]
  selectedSlotStart: string | null
  selectionMode: SlotSelectionMode
  recommendedSlotStart?: string | null
  orderWorkloadUnits: number
}): ResolvedCheckoutSlot {
  const {
    slots,
    selectedSlotStart,
    selectionMode,
    recommendedSlotStart,
    orderWorkloadUnits,
  } = params

  const earliestFeasible =
    (recommendedSlotStart
      ? slots.find((s) => s.slot_start === recommendedSlotStart && s.is_feasible)
      : undefined) ??
    slots.find((s) => s.is_feasible) ??
    null

  if (selectionMode === 'auto' || !selectedSlotStart) {
    return {
      effectiveSlotStart: earliestFeasible?.slot_start ?? null,
      selectedSlot: earliestFeasible,
      unavailableWarning: null,
      isUsingDefaultEarliest: true,
    }
  }

  const chosen = slots.find((s) => s.slot_start === selectedSlotStart) ?? null
  if (chosen && chosen.is_feasible) {
    return {
      effectiveSlotStart: chosen.slot_start,
      selectedSlot: chosen,
      unavailableWarning: null,
      isUsingDefaultEarliest:
        earliestFeasible !== null && chosen.slot_start === earliestFeasible.slot_start,
    }
  }

  if (!chosen) {
    return {
      effectiveSlotStart: null,
      selectedSlot: null,
      unavailableWarning:
        'Your chosen pickup slot has passed or is no longer open. Choose an available slot below or switch to the earliest open slot.',
      isUsingDefaultEarliest: false,
    }
  }

  const windowLabel = formatTimeWindow(chosen.slot_start, chosen.slot_end)
  if (chosen.is_closed) {
    const reasonText = chosen.close_reason ? ` (${chosen.close_reason})` : ''
    return {
      effectiveSlotStart: null,
      selectedSlot: chosen,
      unavailableWarning: `Your chosen slot (${windowLabel}) is now closed${reasonText}. Please choose another available slot or switch to the earliest open slot.`,
      isUsingDefaultEarliest: false,
    }
  }

  if (chosen.is_full) {
    return {
      effectiveSlotStart: null,
      selectedSlot: chosen,
      unavailableWarning: `Your chosen slot (${windowLabel}) is now full. Please select another available slot or switch to the earliest open slot.`,
      isUsingDefaultEarliest: false,
    }
  }

  if (orderWorkloadUnits > chosen.capacity_units && chosen.used_units > 0) {
    return {
      effectiveSlotStart: null,
      selectedSlot: chosen,
      unavailableWarning: `Your ${orderWorkloadUnits}-unit order needs an empty dedicated slot, but ${windowLabel} already has ${chosen.used_units} units booked. Select an empty slot or use the earliest open slot.`,
      isUsingDefaultEarliest: false,
    }
  }

  return {
    effectiveSlotStart: null,
    selectedSlot: chosen,
    unavailableWarning: `${windowLabel} only has ${chosen.remaining_units} units left, which cannot fit your ${orderWorkloadUnits}-unit order. Select another open slot or switch to the earliest open slot.`,
    isUsingDefaultEarliest: false,
  }
}

