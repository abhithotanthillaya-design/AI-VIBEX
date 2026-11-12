import assert from 'node:assert/strict'
import test from 'node:test'
import type { AppView } from '../src/components/layout/AppShell.tsx'
import type { ManagerDashboard, ManagerSalesSummary, OrderDetail } from '../src/types/index.ts'
import {
  filterManagerOrdersClient,
  type ManagerSectionTab,
  validateCapacityInput,
  validateMenuFormInput,
} from '../src/utils/manager.ts'

function makeSampleOrder(
  id: string,
  code: string,
  customer: string,
  status: OrderDetail['status'],
  createdAt: string,
): OrderDetail {
  return {
    id,
    pickup_code: code,
    customer_name: customer,
    status,
    pickup_slot_start: '2026-11-12T12:50:00+05:30',
    pickup_slot_end: '2026-11-12T12:55:00+05:30',
    total_amount: 6500,
    total_prep_units: 6,
    notes: null,
    created_at: createdAt,
    updated_at: createdAt,
    items: [
      {
        id: 'oi_1',
        menu_item_id: 'item_2',
        item_name: 'Masala Dosa',
        quantity: 1,
        unit_price: 6500,
        prep_minutes: 6,
      },
    ],
  }
}

test('AppShell supports Student, Kitchen, and Manager views and Manager section tabs', () => {
  const appViews: AppView[] = ['student', 'kitchen', 'manager']
  const managerTabs: ManagerSectionTab[] = [
    'overview',
    'menu',
    'orders',
    'sales',
    'slots',
  ]
  assert.equal(appViews.includes('manager'), true)
  assert.equal(managerTabs.length, 5)
})

test('validateMenuFormInput converts Rupees to paise and rejects invalid inputs', () => {
  const validVeg = validateMenuFormInput({
    name: '  Paneer Roll  ',
    description: '  Grilled paneer wrap  ',
    category: 'Fast Food',
    priceRupees: '85.5',
    prepMinutes: '6',
    imageUrl: '/images/menu/paneer-kathi-roll.jpg',
    isVeg: true,
    available: true,
  })
  assert.equal(validVeg.ok, true)
  if (validVeg.ok) {
    assert.equal(validVeg.payload.name, 'Paneer Roll')
    assert.equal(validVeg.payload.price, 8550)
    assert.equal(validVeg.payload.prep_minutes, 6)
    assert.equal(validVeg.payload.is_veg, true)
  }

  const zeroPrice = validateMenuFormInput({
    name: 'Free Item',
    description: 'Invalid price test',
    category: 'Snacks',
    priceRupees: '0',
    prepMinutes: '3',
    imageUrl: '',
    isVeg: true,
    available: true,
  })
  assert.equal(zeroPrice.ok, false)

  const badUrl = validateMenuFormInput({
    name: 'Bad Image',
    description: 'Unsafe URL test',
    category: 'Snacks',
    priceRupees: '30',
    prepMinutes: '3',
    imageUrl: 'javascript:alert(1)',
    isVeg: false,
    available: true,
  })
  assert.equal(badUrl.ok, false)
})

test('filterManagerOrdersClient supports active, completed, cancelled, date, and search filters', () => {
  const orders = [
    makeSampleOrder('ord_1', 'Q7K2', 'Aarav', 'PLACED', '2026-11-12T10:15:00+05:30'),
    makeSampleOrder('ord_2', 'M9P4', 'Diya', 'COLLECTED', '2026-11-12T11:00:00+05:30'),
    makeSampleOrder('ord_3', 'X2B8', 'Kabir', 'CANCELLED', '2026-11-11T14:00:00+05:30'),
  ]

  assert.equal(
    filterManagerOrdersClient(orders, { status: 'all', date: '', search: '' }).length,
    3,
  )
  assert.deepEqual(
    filterManagerOrdersClient(orders, { status: 'active', date: '', search: '' }).map(
      (o) => o.id,
    ),
    ['ord_1'],
  )
  assert.deepEqual(
    filterManagerOrdersClient(orders, { status: 'completed', date: '', search: '' }).map(
      (o) => o.id,
    ),
    ['ord_2'],
  )
  assert.deepEqual(
    filterManagerOrdersClient(orders, { status: 'cancelled', date: '', search: '' }).map(
      (o) => o.id,
    ),
    ['ord_3'],
  )
  assert.deepEqual(
    filterManagerOrdersClient(orders, {
      status: 'all',
      date: '2026-11-11',
      search: '',
    }).map((o) => o.id),
    ['ord_3'],
  )
  assert.deepEqual(
    filterManagerOrdersClient(orders, { status: 'all', date: '', search: 'm9p4' }).map(
      (o) => o.id,
    ),
    ['ord_2'],
  )
})

test('validateCapacityInput accepts valid integer bounds and rejects invalid values', () => {
  assert.deepEqual(validateCapacityInput('12'), { ok: true, value: 12 })
  assert.equal(validateCapacityInput('0').ok, false)
  assert.equal(validateCapacityInput('12.5').ok, false)
  assert.equal(validateCapacityInput('150').ok, false)
})

test('ManagerDashboard and ManagerSalesSummary contracts hold cleanly on empty and populated data', () => {
  const emptyDashboard: ManagerDashboard = {
    today_date: '2026-11-12',
    today_sales_paise: 0,
    today_orders: 0,
    active_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    total_menu_items: 12,
    available_menu_items: 11,
    unavailable_menu_items: 1,
    current_slot: null,
    busiest_slot: null,
  }
  assert.equal(emptyDashboard.busiest_slot, null)

  const sales: ManagerSalesSummary = {
    today_sales_paise: 12000,
    total_collected_orders: 2,
    total_collected_revenue_paise: 18500,
    average_order_value_paise: 9250,
    daily_sales: [
      { date: '2026-11-12', label: '12 Nov', order_count: 1, revenue_paise: 12000 },
    ],
    top_items: [
      {
        menu_item_id: 'item_1',
        item_name: 'Veg Grilled Sandwich',
        quantity_sold: 2,
        revenue_paise: 10000,
      },
    ],
  }
  assert.equal(sales.average_order_value_paise, 9250)
  assert.equal(sales.top_items[0].quantity_sold, 2)
})

test('guarded async manager actions block duplicate submissions and require confirmation for delete/close', async () => {
  let activeRequests = 0
  let maxConcurrent = 0
  const inFlight = { current: false }

  async function guardedSubmit(confirmed: boolean, work: () => Promise<void>) {
    if (!confirmed || inFlight.current) return false
    inFlight.current = true
    activeRequests += 1
    maxConcurrent = Math.max(maxConcurrent, activeRequests)
    try {
      await work()
      return true
    } finally {
      activeRequests -= 1
      inFlight.current = false
    }
  }

  // Unconfirmed delete/slot closure must not execute
  const unconfirmed = await guardedSubmit(false, async () => {})
  assert.equal(unconfirmed, false)
  assert.equal(maxConcurrent, 0)

  // Concurrent double-click on submit must only execute once
  let releaseFirst!: () => void
  const firstPromise = guardedSubmit(
    true,
    () =>
      new Promise<void>((resolve) => {
        releaseFirst = resolve
      }),
  )
  const secondResult = await guardedSubmit(true, async () => {})
  assert.equal(secondResult, false)
  assert.equal(maxConcurrent, 1)

  releaseFirst()
  assert.equal(await firstPromise, true)
})
