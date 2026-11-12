export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COLLECTED'
  | 'CANCELLED'

export interface HealthResponse {
  status: string
  service: string
  database: string
  environment: string
  timestamp: string
}

export interface MenuItem {
  id: string
  name: string
  description: string
  category: string
  price: number
  prep_minutes: number
  available: boolean
  image_url?: string | null
}

export interface OrderItemRequest {
  menu_item_id: string
  quantity: number
}

export interface CreateOrderRequest {
  customer_name: string
  items: OrderItemRequest[]
  notes?: string
}

export interface CreateOrderResponse {
  id: string
  pickup_code: string
  status: OrderStatus
  pickup_slot_start: string
  pickup_slot_end: string
  total_amount: number
  message: string
}

export interface OrderItemDetail {
  id: string
  menu_item_id: string
  item_name: string
  quantity: number
  unit_price: number
  prep_minutes: number
}

export interface OrderDetail {
  id: string
  pickup_code: string
  customer_name: string
  status: OrderStatus
  pickup_slot_start: string
  pickup_slot_end: string
  total_amount: number
  total_prep_units: number
  notes?: string | null
  created_at: string
  updated_at: string
  items: OrderItemDetail[]
}

export interface SlotWorkload {
  slot_start: string
  slot_end: string
  used_units: number
  capacity_units: number
  remaining_units: number
  active_orders: number
}

export interface ApiErrorBody {
  error?: string
  message?: string
  detail?: string
}

export interface CartItem {
  item: MenuItem
  quantity: number
}


