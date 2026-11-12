import assert from 'node:assert/strict'
import test from 'node:test'
import type { DemoPaymentResponse, MenuItem } from '../src/types/index.ts'
import { validateMenuFormInput } from '../src/utils/manager.ts'
import {
  executeGuardedDemoPayment,
  filterMenuItemsByDietAndCategory,
  getPaymentStatusMeta,
} from '../src/utils/phase10.ts'
import {
  clearStoredOrderHistory,
  readStoredOrderHistory,
  recordStoredOrderHistory,
  removeStoredOrderHistory,
} from '../src/utils/storage.ts'

const ITEMS: MenuItem[] = [
  {
    id: 'item_vegan',
    name: 'Steamed Jain Idli',
    description: 'No onion, no garlic rice cakes.',
    category: 'Meals',
    price: 5000,
    prep_minutes: 3,
    available: true,
    is_veg: true,
    is_vegan: true,
    is_jain: true,
    allergen_info: 'May contain sesame',
  },
  {
    id: 'item_veg_dairy',
    name: 'Paneer Roll',
    description: 'Contains fresh paneer.',
    category: 'Fast Food',
    price: 8500,
    prep_minutes: 6,
    available: true,
    is_veg: true,
    is_vegan: false,
    is_jain: false,
    allergen_info: 'Contains dairy and gluten',
  },
  {
    id: 'item_unlisted_allergen',
    name: 'Masala Chai',
    description: 'Spiced milk tea.',
    category: 'Beverages',
    price: 2000,
    prep_minutes: 2,
    available: true,
    is_veg: true,
    is_vegan: false,
    is_jain: false,
    allergen_info: null,
  },
]

test('filterMenuItemsByDietAndCategory filters veg, vegan, jain, non_veg, and allergen keywords', () => {
  assert.equal(
    filterMenuItemsByDietAndCategory(ITEMS, {
      category: 'All',
      dietary: 'vegan',
      search: '',
    }).length,
    1,
  )
  assert.equal(
    filterMenuItemsByDietAndCategory(ITEMS, {
      category: 'All',
      dietary: 'jain',
      search: '',
    })[0].id,
    'item_vegan',
  )
  assert.equal(
    filterMenuItemsByDietAndCategory(ITEMS, {
      category: 'All',
      dietary: 'veg',
      search: 'dairy',
    })[0].id,
    'item_veg_dairy',
  )
  assert.equal(
    filterMenuItemsByDietAndCategory(ITEMS, {
      category: 'All',
      dietary: 'non_veg',
      search: '',
    }).length,
    0,
  )
})

test('validateMenuFormInput enforces vegetarian consistency for vegan/jain and optional allergen info', () => {
  const invalid = validateMenuFormInput({
    name: 'Chicken Roll',
    description: 'Spiced grilled chicken wrap.',
    category: 'Fast Food',
    priceRupees: '95',
    prepMinutes: '5',
    imageUrl: '',
    isVeg: false,
    isVegan: true,
    isJain: false,
    allergenInfo: 'Contains gluten',
    available: true,
  })
  assert.equal(invalid.ok, false)

  const valid = validateMenuFormInput({
    name: 'Jain Poha',
    description: 'Light flattened rice without onion.',
    category: 'Snacks',
    priceRupees: '40',
    prepMinutes: '3',
    imageUrl: '',
    isVeg: true,
    isVegan: true,
    isJain: true,
    allergenInfo: '   ',
    available: true,
  })
  assert.equal(valid.ok, true)
  if (valid.ok) {
    assert.equal(valid.payload.is_vegan, true)
    assert.equal(valid.payload.is_jain, true)
    assert.equal(valid.payload.allergen_info, null)
  }
})

test('student local order history persists newest-first, deduplicates, removes, and clears cleanly', () => {
  const backing = new Map<string, string>()
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (k: string) => backing.get(k) ?? null,
        setItem: (k: string, v: string) => backing.set(k, v),
        removeItem: (k: string) => backing.delete(k),
      },
    },
  })

  try {
    clearStoredOrderHistory()
    assert.deepEqual(readStoredOrderHistory(), [])

    recordStoredOrderHistory('ord_1')
    recordStoredOrderHistory('ord_2')
    recordStoredOrderHistory('ord_1')
    assert.deepEqual(readStoredOrderHistory(), ['ord_1', 'ord_2'])

    removeStoredOrderHistory('ord_1')
    assert.deepEqual(readStoredOrderHistory(), ['ord_2'])

    clearStoredOrderHistory()
    assert.deepEqual(readStoredOrderHistory(), [])
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  }
})

test('getPaymentStatusMeta and executeGuardedDemoPayment keep text statuses clear and prevent duplicates', async () => {
  assert.equal(getPaymentStatusMeta('DEMO_PAID', 'DEMO_UPI').label, 'Demo Paid')
  assert.equal(getPaymentStatusMeta('PENDING', 'DEMO_UPI').label, 'Demo UPI Pending')
  assert.equal(getPaymentStatusMeta('DEMO_FAILED', 'DEMO_UPI').label, 'Demo Payment Failed')
  assert.equal(getPaymentStatusMeta('DEMO_CANCELLED', 'DEMO_UPI').label, 'Demo Payment Cancelled')
  assert.equal(getPaymentStatusMeta('PAY_AT_COUNTER', 'COUNTER_CASH').label, 'Pay at Counter (Demo)')

  const guard = { current: false }
  let releasePending: ((val: DemoPaymentResponse) => void) | null = null
  let calls = 0

  const mockResponse: DemoPaymentResponse = {
    status: 'ok',
    payment_status: 'DEMO_PAID',
    message: 'Demo Payment completed.',
    order: {
      id: 'ord_1',
      pickup_code: 'AB12',
      customer_name: 'Aarav',
      status: 'PLACED',
      pickup_slot_start: '2026-11-12T12:20:00+05:30',
      pickup_slot_end: '2026-11-12T12:25:00+05:30',
      total_amount: 6500,
      total_prep_units: 6,
      payment_method: 'DEMO_UPI',
      payment_status: 'DEMO_PAID',
      payment_reference: 'DEMO-UPI-1234ABCD',
      created_at: '2026-11-12T12:15:00+05:30',
      updated_at: '2026-11-12T12:15:10+05:30',
      items: [],
    },
  }

  const p1 = executeGuardedDemoPayment('ord_1', 'succeed', 'DEMO_UPI', guard, () => {
    calls += 1
    return new Promise((resolve) => {
      releasePending = resolve
    })
  })

  const dup = await executeGuardedDemoPayment('ord_1', 'succeed', 'DEMO_UPI', guard, async () => {
    calls += 1
    return mockResponse
  })
  assert.equal(dup.status, 'ignored_duplicate')
  assert.equal(calls, 1)

  releasePending!(mockResponse)
  const res1 = await p1
  assert.equal(res1.status, 'success')
  assert.equal(guard.current, false)
})

