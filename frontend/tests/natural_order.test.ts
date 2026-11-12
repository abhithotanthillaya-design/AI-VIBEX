import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  MenuItem,
  NaturalOrderParseResponse,
  ParsedOrderItem,
} from '../src/types/index.ts'
import { mergeParsedItemsIntoCart } from '../src/utils/cart.ts'
import {
  calculatePreviewTotals,
  executeGuardedNaturalParse,
  NATURAL_ORDER_EXAMPLES,
  resolveAmbiguousCandidate,
  updatePreviewItemQuantity,
} from '../src/utils/naturalOrder.ts'

const DOSA: MenuItem = {
  id: 'item_2',
  name: 'Masala Dosa',
  description: 'Crispy crepe with potato masala.',
  category: 'Meals',
  price: 6500,
  prep_minutes: 6,
  available: true,
  is_veg: true,
}

const CHAI: MenuItem = {
  id: 'item_9',
  name: 'Masala Chai',
  description: 'Spiced milk tea.',
  category: 'Beverages',
  price: 2000,
  prep_minutes: 2,
  available: true,
  is_veg: true,
}

const UNAVAILABLE_PAV: MenuItem = {
  id: 'item_12',
  name: 'Butter Pav Bhaji',
  description: 'Temporarily sold out.',
  category: 'Meals',
  price: 8000,
  prep_minutes: 6,
  available: false,
  is_veg: true,
}

function makeParsedDosa(quantity = 1): ParsedOrderItem {
  return {
    menu_item_id: DOSA.id,
    name: DOSA.name,
    category: DOSA.category,
    quantity,
    unit_price: DOSA.price,
    line_total: DOSA.price * quantity,
    prep_minutes: DOSA.prep_minutes,
    available: DOSA.available,
    is_veg: DOSA.is_veg,
    matched_phrase: 'masala dosa',
    match_type: 'exact',
  }
}

test('NATURAL_ORDER_EXAMPLES exposes clickable example prompts', () => {
  assert.ok(NATURAL_ORDER_EXAMPLES.length >= 3)
  for (const example of NATURAL_ORDER_EXAMPLES) {
    assert.ok(example.trim().length > 0)
  }
})

test('executeGuardedNaturalParse rejects empty input and prevents duplicate concurrent submissions', async () => {
  const guard = { current: false }
  let callCount = 0

  const emptyOutcome = await executeGuardedNaturalParse('   ', guard, async () => {
    callCount += 1
    throw new Error('Should not be called')
  })
  assert.equal(emptyOutcome.status, 'empty_input')
  assert.equal(callCount, 0)
  assert.equal(guard.current, false)

  let releasePending: ((value: NaturalOrderParseResponse) => void) | null = null
  const mockResponse: NaturalOrderParseResponse = {
    original_text: 'One masala dosa',
    matched_items: [makeParsedDosa(1)],
    unavailable_items: [],
    ambiguous_items: [],
    unmatched_terms: [],
    warnings: [],
    subtotal_paise: 6500,
    total_prep_units: 6,
    can_add_to_cart: true,
  }

  const firstPromise = executeGuardedNaturalParse('One masala dosa', guard, () => {
    callCount += 1
    return new Promise((resolve) => {
      releasePending = resolve
    })
  })
  const duplicateOutcome = await executeGuardedNaturalParse('One masala dosa', guard, async () => {
    callCount += 1
    return mockResponse
  })

  assert.equal(duplicateOutcome.status, 'ignored_duplicate')
  assert.equal(callCount, 1)
  assert.equal(guard.current, true)

  releasePending!(mockResponse)
  const firstOutcome = await firstPromise
  assert.equal(firstOutcome.status, 'success')
  assert.equal(guard.current, false)

  const errorOutcome = await executeGuardedNaturalParse('Two teas', guard, async () => {
    throw new Error('Backend parse failed')
  })
  assert.equal(errorOutcome.status, 'error')
  if (errorOutcome.status === 'error') {
    assert.equal(errorOutcome.message, 'Backend parse failed')
  }
  assert.equal(guard.current, false)
})

test('updatePreviewItemQuantity and calculatePreviewTotals clamp and recompute totals cleanly', () => {
  const initial = [makeParsedDosa(2)]
  const incremented = updatePreviewItemQuantity(initial, DOSA.id, 1)
  assert.equal(incremented[0].quantity, 3)
  assert.equal(incremented[0].line_total, 19500)

  const totals = calculatePreviewTotals(incremented)
  assert.deepEqual(totals, {
    itemCount: 3,
    subtotalPaise: 19500,
    totalPrepUnits: 18,
  })

  const clamped = updatePreviewItemQuantity(initial, DOSA.id, 50)
  assert.equal(clamped[0].quantity, 20)

  const removed = updatePreviewItemQuantity(initial, DOSA.id, -2)
  assert.equal(removed.length, 0)
})

test('resolveAmbiguousCandidate guards unavailable items and merges duplicate selections', () => {
  const unchanged = resolveAmbiguousCandidate([], UNAVAILABLE_PAV, 1, 'pav bhaji')
  assert.equal(unchanged.length, 0)

  const added = resolveAmbiguousCandidate([], CHAI, 2, 'masala')
  assert.equal(added.length, 1)
  assert.equal(added[0].menu_item_id, CHAI.id)
  assert.equal(added[0].quantity, 2)
  assert.equal(added[0].line_total, 4000)

  const merged = resolveAmbiguousCandidate(added, CHAI, 3, 'masala')
  assert.equal(merged.length, 1)
  assert.equal(merged[0].quantity, 5)
  assert.equal(merged[0].line_total, 10000)
})

test('mergeParsedItemsIntoCart merges confirmed natural-order items into existing cart without duplicating rows', () => {
  const existingCart = [
    { item: DOSA, quantity: 1 },
    { item: UNAVAILABLE_PAV, quantity: 1 },
  ]
  const updated = mergeParsedItemsIntoCart(existingCart, [
    { item: DOSA, quantity: 2 },
    { item: CHAI, quantity: 3 },
    { item: UNAVAILABLE_PAV, quantity: 2 },
    { item: CHAI, quantity: 0 },
  ])

  const dosaRow = updated.find((row) => row.item.id === DOSA.id)
  const chaiRow = updated.find((row) => row.item.id === CHAI.id)
  const pavRow = updated.find((row) => row.item.id === UNAVAILABLE_PAV.id)

  assert.equal(dosaRow?.quantity, 3)
  assert.equal(chaiRow?.quantity, 3)
  assert.equal(pavRow?.quantity, 1)
})

