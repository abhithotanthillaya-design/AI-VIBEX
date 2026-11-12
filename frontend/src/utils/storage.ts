export const LAST_ORDER_STORAGE_KEY = 'queueless_last_order_id'

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

