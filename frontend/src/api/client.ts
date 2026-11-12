import type {
  ApiErrorBody,
  AvailableSlotsResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  DemoPaymentRequest,
  DemoPaymentResponse,
  DemoResetResponse,
  DietaryFilter,
  HealthResponse,
  ManagerDashboard,
  ManagerSalesSummary,
  ManagerSlotSettings,
  MenuItem,
  MenuItemDeleteResponse,
  MenuItemUpsertRequest,
  NaturalOrderParseResponse,
  OrderDetail,
  OrderStatus,
  SlotClosureRequest,
  SlotWorkload,
  VerifyPickupResponse,
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
  dietary?: DietaryFilter
}

export function fetchMenu(params?: MenuQueryParams): Promise<MenuItem[]> {
  const searchParams = new URLSearchParams()
  if (params?.category && params.category !== 'All') {
    searchParams.set('category', params.category)
  }
  if (params?.search && params.search.trim().length > 0) {
    searchParams.set('search', params.search.trim())
  }
  if (params?.dietary && params.dietary !== 'all') {
    searchParams.set('dietary', params.dietary)
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

export function processDemoPayment(
  orderId: string,
  payload: DemoPaymentRequest,
): Promise<DemoPaymentResponse> {
  return apiRequest<DemoPaymentResponse>(
    `/api/orders/${encodeURIComponent(orderId.trim())}/demo-payment`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
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

export function verifyPickupToken(
  token: string,
): Promise<VerifyPickupResponse> {
  return apiRequest<VerifyPickupResponse>('/api/kitchen/verify-pickup', {
    method: 'POST',
    body: JSON.stringify({ token: token.trim() }),
  })
}

export function parseNaturalOrder(
  text: string,
): Promise<NaturalOrderParseResponse> {
  return apiRequest<NaturalOrderParseResponse>('/api/natural-order/parse', {
    method: 'POST',
    body: JSON.stringify({ text: text.trim() }),
  })
}

export function resetDemo(): Promise<DemoResetResponse> {
  return apiRequest<DemoResetResponse>('/api/demo/reset', {
    method: 'POST',
  })
}

export function fetchManagerDashboard(): Promise<ManagerDashboard> {
  return apiRequest<ManagerDashboard>('/api/manager/dashboard', {
    method: 'GET',
  })
}

export function fetchManagerMenu(): Promise<MenuItem[]> {
  return apiRequest<MenuItem[]>('/api/manager/menu', {
    method: 'GET',
  })
}

export function createManagerMenuItem(
  payload: MenuItemUpsertRequest,
): Promise<MenuItem> {
  return apiRequest<MenuItem>('/api/manager/menu', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateManagerMenuItem(
  itemId: string,
  payload: MenuItemUpsertRequest,
): Promise<MenuItem> {
  return apiRequest<MenuItem>(
    `/api/manager/menu/${encodeURIComponent(itemId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}

export function toggleManagerMenuAvailability(
  itemId: string,
  available: boolean,
): Promise<MenuItem> {
  return apiRequest<MenuItem>(
    `/api/manager/menu/${encodeURIComponent(itemId)}/availability`,
    {
      method: 'PATCH',
      body: JSON.stringify({ available }),
    },
  )
}

export function deleteManagerMenuItem(
  itemId: string,
): Promise<MenuItemDeleteResponse> {
  return apiRequest<MenuItemDeleteResponse>(
    `/api/manager/menu/${encodeURIComponent(itemId)}`,
    {
      method: 'DELETE',
    },
  )
}

export interface ManagerOrderQueryParams {
  status?: string
  date?: string
  search?: string
}

export function fetchManagerOrders(
  params?: ManagerOrderQueryParams,
): Promise<OrderDetail[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) {
    searchParams.set('status', params.status)
  }
  if (params?.date && params.date.trim()) {
    searchParams.set('date', params.date.trim())
  }
  if (params?.search && params.search.trim()) {
    searchParams.set('search', params.search.trim())
  }
  const query = searchParams.toString()
  return apiRequest<OrderDetail[]>(
    `/api/manager/orders${query ? `?${query}` : ''}`,
    {
      method: 'GET',
    },
  )
}

export function fetchManagerSales(): Promise<ManagerSalesSummary> {
  return apiRequest<ManagerSalesSummary>('/api/manager/sales', {
    method: 'GET',
  })
}

export function fetchManagerSlots(): Promise<ManagerSlotSettings> {
  return apiRequest<ManagerSlotSettings>('/api/manager/slots', {
    method: 'GET',
  })
}

export function updateManagerCapacity(
  slotCapacityUnits: number,
): Promise<ManagerSlotSettings> {
  return apiRequest<ManagerSlotSettings>('/api/manager/settings/capacity', {
    method: 'PATCH',
    body: JSON.stringify({ slot_capacity_units: slotCapacityUnits }),
  })
}

export function updateManagerSlotStatus(
  payload: SlotClosureRequest,
): Promise<SlotWorkload> {
  return apiRequest<SlotWorkload>('/api/manager/slots/status', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchAvailableSlots(
  workloadUnits = 0,
): Promise<AvailableSlotsResponse> {
  const searchParams = new URLSearchParams()
  if (workloadUnits > 0) {
    searchParams.set('workload_units', String(Math.floor(workloadUnits)))
  }
  const query = searchParams.toString()
  return apiRequest<AvailableSlotsResponse>(
    `/api/slots/available${query ? `?${query}` : ''}`,
    {
      method: 'GET',
    },
  )
}
