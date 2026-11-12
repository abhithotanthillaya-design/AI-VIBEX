import type {
  ApiErrorBody,
  AuthSessionResponse,
  AuthenticatedUser,
  AvailableSlotsResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  DemoPaymentRequest,
  DemoPaymentResponse,
  DemoResetResponse,
  DietaryFilter,
  HealthResponse,
  LoginRequest,
  LogoutResponse,
  ManagerDashboard,
  ManagerSalesSummary,
  ManagerSlotSettings,
  MenuItem,
  MenuItemDeleteResponse,
  MenuItemUpsertRequest,
  NaturalOrderParseResponse,
  OrderDetail,
  OrderStatus,
  ProfileUpdateRequest,
  SlotClosureRequest,
  SlotWorkload,
  StaffCreateRequest,
  StudentRegisterRequest,
  VerifyPickupResponse,
} from '../types'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

let activeCsrfToken: string | null = null
let onSessionExpiredCallback: (() => void) | null = null

export function setApiCsrfToken(token: string | null): void {
  activeCsrfToken = token
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpiredCallback = handler
}

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
  const method = (init?.method ?? 'GET').toUpperCase()
  const isMutation =
    method === 'POST' ||
    method === 'PATCH' ||
    method === 'PUT' ||
    method === 'DELETE'

  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(isMutation && activeCsrfToken
        ? { 'X-CSRF-Token': activeCsrfToken }
        : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== '/api/auth/login' &&
      path !== '/api/auth/register' &&
      path !== '/api/auth/me'
    ) {
      activeCsrfToken = null
      onSessionExpiredCallback?.()
    }
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

export async function registerStudent(
  payload: StudentRegisterRequest,
): Promise<AuthSessionResponse> {
  const session = await apiRequest<AuthSessionResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setApiCsrfToken(session.csrf_token)
  return session
}

export async function loginUser(
  payload: LoginRequest,
): Promise<AuthSessionResponse> {
  const session = await apiRequest<AuthSessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setApiCsrfToken(session.csrf_token)
  return session
}

export async function fetchCurrentSession(): Promise<AuthSessionResponse> {
  const session = await apiRequest<AuthSessionResponse>('/api/auth/me', {
    method: 'GET',
  })
  setApiCsrfToken(session.csrf_token)
  return session
}

export async function logoutUser(): Promise<LogoutResponse> {
  try {
    return await apiRequest<LogoutResponse>('/api/auth/logout', {
      method: 'POST',
    })
  } finally {
    setApiCsrfToken(null)
  }
}

export function fetchProfile(): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>('/api/auth/profile', {
    method: 'GET',
  })
}

export function updateProfile(
  payload: ProfileUpdateRequest,
): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchMyOrders(): Promise<OrderDetail[]> {
  return apiRequest<OrderDetail[]>('/api/orders/mine', {
    method: 'GET',
  })
}

export function fetchManagerStaff(): Promise<AuthenticatedUser[]> {
  return apiRequest<AuthenticatedUser[]>('/api/manager/staff', {
    method: 'GET',
  })
}

export function createManagerStaff(
  payload: StaffCreateRequest,
): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>('/api/manager/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateManagerStaffStatus(
  userId: string,
  isActive: boolean,
): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>(
    `/api/manager/staff/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    },
  )
}
