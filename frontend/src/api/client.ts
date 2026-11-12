import type {
  ApiErrorBody,
  CreateOrderRequest,
  CreateOrderResponse,
  HealthResponse,
  MenuItem,
  OrderDetail,
  OrderStatus,
  SlotWorkload,
} from '../types'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

export class ApiClientError extends Error {
  readonly statusCode: number
  readonly code?: string

  constructor(message: string, statusCode: number, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.statusCode = statusCode
    this.code = code
  }
}

async function parseErrorMessage(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as ApiErrorBody
    const message =
      body.message ||
      body.detail ||
      `Request failed with status ${response.status}`
    return new ApiClientError(message, response.status, body.error)
  } catch {
    return new ApiClientError(
      `Request failed with status ${response.status}`,
      response.status,
    )
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw await parseErrorMessage(response)
  }

  return (await response.json()) as T
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/api/health', { method: 'GET' })
}

export interface MenuQueryParams {
  category?: string
  search?: string
}

export function fetchMenu(params?: MenuQueryParams): Promise<MenuItem[]> {
  const searchParams = new URLSearchParams()
  if (params?.category && params.category !== 'All') {
    searchParams.set('category', params.category)
  }
  if (params?.search && params.search.trim().length > 0) {
    searchParams.set('search', params.search.trim())
  }
  const query = searchParams.toString()
  return apiRequest<MenuItem[]>(`/api/menu${query ? `?${query}` : ''}`, {
    method: 'GET',
  })
}

export function createOrder(
  payload: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  return apiRequest<CreateOrderResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchOrder(orderId: string): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(
    `/api/orders/${encodeURIComponent(orderId.trim())}`,
    {
      method: 'GET',
    },
  )
}

export function fetchKitchenOrders(status = 'active'): Promise<OrderDetail[]> {
  const searchParams = new URLSearchParams({ status })
  return apiRequest<OrderDetail[]>(
    `/api/kitchen/orders?${searchParams.toString()}`,
    {
      method: 'GET',
    },
  )
}

export function updateKitchenOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(
    `/api/kitchen/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  )
}

export function fetchKitchenSlots(): Promise<SlotWorkload[]> {
  return apiRequest<SlotWorkload[]>('/api/kitchen/slots', {
    method: 'GET',
  })
}

