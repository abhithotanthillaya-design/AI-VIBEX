export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COLLECTED'
  | 'CANCELLED'

export type MenuCategory = 'Meals' | 'Fast Food' | 'Snacks' | 'Beverages'

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
  is_veg: boolean
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
  is_full: boolean
  is_upcoming: boolean
  is_closed: boolean
  close_reason?: string | null
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

export interface DemoResetResponse {
  status: string
  deleted_orders: number
  deleted_order_items: number
  available_menu_items: number
  message: string
}

export interface MenuItemUpsertRequest {
  name: string
  description: string
  category: MenuCategory
  price: number
  prep_minutes: number
  image_url?: string | null
  is_veg: boolean
  available: boolean
}

export interface MenuItemDeleteResponse {
  status: string
  id: string
  archived: boolean
  message: string
}

export interface ManagerDashboard {
  today_date: string
  today_sales_paise: number
  today_orders: number
  active_orders: number
  completed_orders: number
  cancelled_orders: number
  total_menu_items: number
  available_menu_items: number
  unavailable_menu_items: number
  current_slot: SlotWorkload | null
  busiest_slot: SlotWorkload | null
}

export interface DailySalesPoint {
  date: string
  label: string
  order_count: number
  revenue_paise: number
}

export interface PopularMenuItemStat {
  menu_item_id: string
  item_name: string
  quantity_sold: number
  revenue_paise: number
}

export interface ManagerSalesSummary {
  today_sales_paise: number
  total_collected_orders: number
  total_collected_revenue_paise: number
  average_order_value_paise: number
  daily_sales: DailySalesPoint[]
  top_items: PopularMenuItemStat[]
}

export interface ManagerSlotSettings {
  slot_capacity_units: number
  slot_duration_minutes: number
  slots: SlotWorkload[]
}

export interface SlotClosureRequest {
  slot_start: string
  is_closed: boolean
  reason?: string | null
}
