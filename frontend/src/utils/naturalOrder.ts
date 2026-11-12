import type {
  MenuItem,
  NaturalOrderParseResponse,
  ParsedOrderItem,
} from '../types'

export const NATURAL_ORDER_EXAMPLES: string[] = [
  'One masala dosa and two teas.',
  'Two veg sandwiches and one cold coffee.',
  'One pav bhaji and one poha.',
  'I need two idlis and one masala chai around 1:30 PM.',
]

export function updatePreviewItemQuantity(
  items: ParsedOrderItem[],
  menuItemId: string,
  delta: number,
): ParsedOrderItem[] {
  return items
    .map((item) => {
      if (item.menu_item_id !== menuItemId) return item
      const nextQty = Math.min(20, item.quantity + delta)
      return {
        ...item,
        quantity: nextQty,
        line_total: item.unit_price * nextQty,
      }
    })
    .filter((item) => item.quantity > 0)
}

export function calculatePreviewTotals(items: ParsedOrderItem[]): {
  itemCount: number
  subtotalPaise: number
  totalPrepUnits: number
} {
  let itemCount = 0
  let subtotalPaise = 0
  let totalPrepUnits = 0

  for (const item of items) {
    itemCount += item.quantity
    subtotalPaise += item.unit_price * item.quantity
    totalPrepUnits += item.prep_minutes * item.quantity
  }

  return { itemCount, subtotalPaise, totalPrepUnits }
}

export function resolveAmbiguousCandidate(
  items: ParsedOrderItem[],
  candidate: MenuItem,
  quantity: number,
  phrase: string,
): ParsedOrderItem[] {
  if (!candidate.available || quantity <= 0) {
    return items
  }
  const existing = items.find((entry) => entry.menu_item_id === candidate.id)
  if (existing) {
    const nextQty = Math.min(20, existing.quantity + quantity)
    return items.map((entry) =>
      entry.menu_item_id === candidate.id
        ? {
            ...entry,
            quantity: nextQty,
            line_total: entry.unit_price * nextQty,
          }
        : entry,
    )
  }
  return [
    ...items,
    {
      menu_item_id: candidate.id,
      name: candidate.name,
      category: candidate.category,
      quantity,
      unit_price: candidate.price,
      line_total: candidate.price * quantity,
      prep_minutes: candidate.prep_minutes,
      available: candidate.available,
      is_veg: candidate.is_veg,
      matched_phrase: phrase,
      match_type: 'synonym',
    },
  ]
}

export type GuardedParseOutcome =
  | { status: 'empty_input'; message: string }
  | { status: 'ignored_duplicate' }
  | { status: 'success'; result: NaturalOrderParseResponse }
  | { status: 'error'; message: string }

export async function executeGuardedNaturalParse(
  rawText: string,
  guard: { current: boolean },
  parseFn: (text: string) => Promise<NaturalOrderParseResponse>,
): Promise<GuardedParseOutcome> {
  const cleaned = rawText.trim()
  if (!cleaned) {
    return {
      status: 'empty_input',
      message: 'Please describe the items you want to order first.',
    }
  }
  if (guard.current) {
    return { status: 'ignored_duplicate' }
  }

  guard.current = true
  try {
    const result = await parseFn(cleaned)
    return { status: 'success', result }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to interpret your request right now. Please try again.'
    return { status: 'error', message }
  } finally {
    guard.current = false
  }
}

