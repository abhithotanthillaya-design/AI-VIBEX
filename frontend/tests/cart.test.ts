import assert from 'node:assert/strict'
import test from 'node:test'
import type { MenuItem } from '../src/types/index.ts'
import {
  addItemToCart,
  calculateCartTotals,
  getCartQuantityMap,
  removeItemFromCart,
  updateCartItemQuantity,
} from '../src/utils/cart.ts'
import { formatRupees } from '../src/utils/format.ts'

const SANDWICH: MenuItem = {
  id: 'item_1',
  name: 'Veg Grilled Sandwich',
  description: 'Crisp toast',
  category: 'Fast Food',
  price: 5000,
  prep_minutes: 4,
  available: true,
  image_url: '/images/menu/veg-grilled-sandwich.jpg',
}

const CHAI: MenuItem = {
  id: 'item_9',
  name: 'Masala Chai',
  description: 'Ginger tea',
  category: 'Beverages',
  price: 2000,
  prep_minutes: 2,
  available: true,
  image_url: '/images/menu/masala-chai.jpg',
}

const UNAVAILABLE_ITEM: MenuItem = {
  id: 'item_12',
  name: 'Butter Pav Bhaji',
  description: 'Unavailable item',
  category: 'Meals',
  price: 8000,
  prep_minutes: 6,
  available: false,
  image_url: '/images/menu/pav-bhaji.jpg',
}

test('cart operations, quantity updates, and price calculations work accurately', () => {
  let cart = addItemToCart([], SANDWICH)
  assert.equal(cart.length, 1)
  assert.equal(cart[0].quantity, 1)

  // Unavailable items cannot be added
  cart = addItemToCart(cart, UNAVAILABLE_ITEM)
  assert.equal(cart.length, 1)

  // Adding same item increments quantity
  cart = addItemToCart(cart, SANDWICH)
  assert.equal(cart[0].quantity, 2)

  // Adding second item
  cart = addItemToCart(cart, CHAI)
  let totals = calculateCartTotals(cart)
  assert.equal(totals.itemCount, 3)
  assert.equal(totals.subtotalPaise, 12000)
  assert.equal(totals.totalPaise, 12000)
  assert.equal(totals.totalPrepUnits, 10)

  const qtyMap = getCartQuantityMap(cart)
  assert.deepEqual(qtyMap, { item_1: 2, item_9: 1 })

  // Decrementing below 1 removes item
  cart = updateCartItemQuantity(cart, CHAI.id, -1)
  assert.equal(cart.length, 1)
  totals = calculateCartTotals(cart)
  assert.equal(totals.totalPaise, 10000)

  // Explicit removal clears remaining item
  cart = removeItemFromCart(cart, SANDWICH.id)
  assert.equal(cart.length, 0)
  totals = calculateCartTotals(cart)
  assert.equal(totals.itemCount, 0)
  assert.equal(totals.totalPaise, 0)
})

test('formatRupees formats whole and fractional paise cleanly', () => {
  assert.equal(formatRupees(5000), '₹50')
  assert.equal(formatRupees(5050), '₹50.50')
  assert.equal(formatRupees(0), '₹0')
})

