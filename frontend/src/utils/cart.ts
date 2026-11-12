import type { CartItem, MenuItem } from '../types'

export interface CartTotals {
  itemCount: number
  subtotalPaise: number
  totalPaise: number
  totalPrepUnits: number
}

export function addItemToCart(
  cart: CartItem[],
  item: MenuItem,
): CartItem[] {
  if (!item.available) {
    return cart
  }
  const existing = cart.find((entry) => entry.item.id === item.id)
  if (existing) {
    return cart.map((entry) =>
      entry.item.id === item.id
        ? { ...entry, quantity: entry.quantity + 1 }
        : entry,
    )
  }
  return [...cart, { item, quantity: 1 }]
}

export function updateCartItemQuantity(
  cart: CartItem[],
  itemId: string,
  delta: number,
): CartItem[] {
  return cart
    .map((entry) =>
      entry.item.id === itemId
        ? { ...entry, quantity: entry.quantity + delta }
        : entry,
    )
    .filter((entry) => entry.quantity > 0)
}

export function removeItemFromCart(
  cart: CartItem[],
  itemId: string,
): CartItem[] {
  return cart.filter((entry) => entry.item.id !== itemId)
}

export function calculateCartTotals(cart: CartItem[]): CartTotals {
  let itemCount = 0
  let subtotalPaise = 0
  let totalPrepUnits = 0

  for (const entry of cart) {
    itemCount += entry.quantity
    subtotalPaise += entry.item.price * entry.quantity
    totalPrepUnits += entry.item.prep_minutes * entry.quantity
  }

  return {
    itemCount,
    subtotalPaise,
    totalPaise: subtotalPaise,
    totalPrepUnits,
  }
}

export function getCartQuantityMap(cart: CartItem[]): Record<string, number> {
  const quantities: Record<string, number> = {}
  for (const entry of cart) {
    quantities[entry.item.id] = entry.quantity
  }
  return quantities
}

export function mergeParsedItemsIntoCart(
  cart: CartItem[],
  additions: { item: MenuItem; quantity: number }[],
): CartItem[] {
  let nextCart = [...cart]
  for (const addition of additions) {
    if (!addition.item.available || addition.quantity <= 0) {
      continue
    }
    const existingIndex = nextCart.findIndex(
      (entry) => entry.item.id === addition.item.id,
    )
    if (existingIndex >= 0) {
      nextCart = nextCart.map((entry, idx) =>
        idx === existingIndex
          ? {
              item: addition.item,
              quantity: Math.min(50, entry.quantity + addition.quantity),
            }
          : entry,
      )
    } else {
      nextCart.push({
        item: addition.item,
        quantity: Math.min(50, addition.quantity),
      })
    }
  }
  return nextCart
}

