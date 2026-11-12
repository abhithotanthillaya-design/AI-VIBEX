import type {
  DemoPaymentMethod,
  DemoPaymentOutcome,
  DemoPaymentRequest,
  DemoPaymentResponse,
  DemoPaymentStatus,
  DietaryFilter,
  MenuItem,
} from '../types/index.ts'

export const DIETARY_FILTER_OPTIONS: { value: DietaryFilter; label: string }[] = [
  { value: 'all', label: 'All Diets' },
  { value: 'veg', label: 'Veg' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain-Friendly' },
  { value: 'non_veg', label: 'Non-Veg' },
]

export function filterMenuItemsByDietAndCategory(
  items: MenuItem[],
  params: {
    category: string
    dietary: DietaryFilter
    search: string
  },
): MenuItem[] {
  const normalizedSearch = params.search.trim().toLowerCase()
  return items.filter((item) => {
    if (params.category !== 'All' && item.category !== params.category) {
      return false
    }
    if (params.dietary === 'veg' && !item.is_veg) {
      return false
    }
    if (params.dietary === 'non_veg' && item.is_veg) {
      return false
    }
    if (params.dietary === 'vegan' && !item.is_vegan) {
      return false
    }
    if (params.dietary === 'jain' && !item.is_jain) {
      return false
    }
    if (!normalizedSearch) {
      return true
    }
    const allergenMatch = item.allergen_info
      ? item.allergen_info.toLowerCase().includes(normalizedSearch)
      : false
    return (
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.description.toLowerCase().includes(normalizedSearch) ||
      item.category.toLowerCase().includes(normalizedSearch) ||
      allergenMatch
    )
  })
}

export interface PaymentStatusMeta {
  label: string
  tone: 'emerald' | 'amber' | 'rose' | 'stone'
  description: string
}

export function getPaymentStatusMeta(
  status?: DemoPaymentStatus,
  method?: DemoPaymentMethod,
): PaymentStatusMeta {
  if (status === 'DEMO_PAID') {
    return {
      label: 'Demo Paid',
      tone: 'emerald',
      description: 'Simulated payment succeeded. No real money was charged.',
    }
  }
  if (status === 'PENDING') {
    return {
      label: 'Demo UPI Pending',
      tone: 'amber',
      description: 'Awaiting simulated payment confirmation or switch to counter cash.',
    }
  }
  if (status === 'DEMO_FAILED') {
    return {
      label: 'Demo Payment Failed',
      tone: 'rose',
      description: 'Simulated payment failed. Retry Demo UPI or switch to Cash at Counter.',
    }
  }
  if (status === 'DEMO_CANCELLED') {
    return {
      label: 'Demo Payment Cancelled',
      tone: 'stone',
      description: 'Simulated payment cancelled. Retry Demo UPI or pay Cash at Counter.',
    }
  }
  return {
    label: method === 'COUNTER_CASH' || !status ? 'Pay at Counter (Demo)' : 'Pay at Counter',
    tone: 'stone',
    description: 'Cash at Counter (Demo). No real online charge.',
  }
}

export type GuardedDemoPaymentResult =
  | { status: 'ignored_duplicate' }
  | { status: 'success'; response: DemoPaymentResponse }
  | { status: 'error'; message: string }

export async function executeGuardedDemoPayment(
  orderId: string,
  outcome: DemoPaymentOutcome,
  method: DemoPaymentMethod,
  guard: { current: boolean },
  apiFn: (id: string, payload: DemoPaymentRequest) => Promise<DemoPaymentResponse>,
): Promise<GuardedDemoPaymentResult> {
  if (guard.current) {
    return { status: 'ignored_duplicate' }
  }
  guard.current = true
  try {
    const response = await apiFn(orderId, { outcome, method })
    return { status: 'success', response }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to update demo payment status right now.'
    return { status: 'error', message }
  } finally {
    guard.current = false
  }
}

