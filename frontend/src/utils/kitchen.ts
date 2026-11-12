import type { OrderDetail, OrderStatus } from '../types'

export interface NextKitchenAction {
  nextStatus: OrderStatus
  label: string
  requiresConfirmation: boolean
}

export const NEXT_KITCHEN_ACTION: Partial<
  Record<OrderStatus, NextKitchenAction>
> = {
  PLACED: {
    nextStatus: 'ACCEPTED',
    label: 'Accept Order',
    requiresConfirmation: false,
  },
  ACCEPTED: {
    nextStatus: 'PREPARING',
    label: 'Start Preparing',
    requiresConfirmation: false,
  },
  PREPARING: {
    nextStatus: 'READY',
    label: 'Mark Ready',
    requiresConfirmation: false,
  },
  READY: {
    nextStatus: 'COLLECTED',
    label: 'Mark Collected',
    requiresConfirmation: true,
  },
}

export interface KitchenSummaryCounts {
  placed: number
  accepted: number
  preparing: number
  ready: number
  totalActive: number
}

export function computeKitchenSummary(
  orders: OrderDetail[],
): KitchenSummaryCounts {
  let placed = 0
  let accepted = 0
  let preparing = 0
  let ready = 0

  for (const order of orders) {
    if (order.status === 'PLACED') placed += 1
    else if (order.status === 'ACCEPTED') accepted += 1
    else if (order.status === 'PREPARING') preparing += 1
    else if (order.status === 'READY') ready += 1
  }

  return {
    placed,
    accepted,
    preparing,
    ready,
    totalActive: placed + accepted + preparing + ready,
  }
}

export interface SlotOrderGroup {
  slotStart: string
  slotEnd: string
  totalPrepUnits: number
  orders: OrderDetail[]
}

export function groupOrdersBySlot(orders: OrderDetail[]): SlotOrderGroup[] {
  const groupsMap = new Map<string, SlotOrderGroup>()

  for (const order of orders) {
    const existing = groupsMap.get(order.pickup_slot_start)
    if (existing) {
      existing.orders.push(order)
      existing.totalPrepUnits += order.total_prep_units
    } else {
      groupsMap.set(order.pickup_slot_start, {
        slotStart: order.pickup_slot_start,
        slotEnd: order.pickup_slot_end,
        totalPrepUnits: order.total_prep_units,
        orders: [order],
      })
    }
  }

  return Array.from(groupsMap.values())
}

export type SlotUrgency = 'due' | 'soon' | 'scheduled'

export function getOrderSlotUrgency(
  pickupSlotStartIso: string,
  status: OrderStatus,
  nowMs = Date.now(),
): SlotUrgency {
  if (status === 'READY' || status === 'COLLECTED' || status === 'CANCELLED') {
    return 'scheduled'
  }
  const slotMs = new Date(pickupSlotStartIso).getTime()
  if (Number.isNaN(slotMs)) {
    return 'scheduled'
  }
  if (nowMs >= slotMs) {
    return 'due'
  }
  if (slotMs - nowMs <= 5 * 60 * 1000) {
    return 'soon'
  }
  return 'scheduled'
}

