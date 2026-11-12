export const LAST_ORDER_STORAGE_KEY = 'queueless_last_order_id'
export const PICKUP_TOKENS_STORAGE_KEY = 'queueless_pickup_tokens'
export const ORDER_HISTORY_STORAGE_KEY = 'queueless_order_history'
const MAX_HISTORY_ENTRIES = 20

export function readStoredOrderId(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }
    return window.localStorage.getItem(LAST_ORDER_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredOrderId(orderId: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }
    if (orderId) {
      window.localStorage.setItem(LAST_ORDER_STORAGE_KEY, orderId)
    } else {
      window.localStorage.removeItem(LAST_ORDER_STORAGE_KEY)
    }
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function readTokenMap(): Record<string, string> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {}
    }
    const raw = window.localStorage.getItem(PICKUP_TOKENS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

export function readStoredPickupToken(orderId: string): string | null {
  if (!orderId) return null
  const map = readTokenMap()
  const token = map[orderId]
  return typeof token === 'string' && token.length > 0 ? token : null
}

export function writeStoredPickupToken(orderId: string, token: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }
    const map = readTokenMap()
    map[orderId] = token
    window.localStorage.setItem(PICKUP_TOKENS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

export function clearStoredPickupTokens(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }
    window.localStorage.removeItem(PICKUP_TOKENS_STORAGE_KEY)
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

export function readStoredOrderHistory(): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return []
    }
    const raw = window.localStorage.getItem(ORDER_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is string =>
        typeof entry === 'string' && entry.trim().length > 0,
    )
  } catch {
    return []
  }
}

export function recordStoredOrderHistory(orderId: string): string[] {
  const cleaned = orderId.trim()
  if (!cleaned) return readStoredOrderHistory()
  const existing = readStoredOrderHistory().filter((id) => id !== cleaned)
  const next = [cleaned, ...existing].slice(0, MAX_HISTORY_ENTRIES)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(next))
    }
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
  return next
}

export function removeStoredOrderHistory(orderId: string): string[] {
  const cleaned = orderId.trim()
  const next = readStoredOrderHistory().filter((id) => id !== cleaned)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(next))
    }
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
  return next
}

export function clearStoredOrderHistory(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }
    window.localStorage.removeItem(ORDER_HISTORY_STORAGE_KEY)
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}
