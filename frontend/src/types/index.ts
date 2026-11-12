export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COLLECTED'
  | 'CANCELLED'

export type MenuCategory = 'Meals' | 'Fast Food' | 'Snacks' | 'Beverages'

export type DietaryFilter = 'all' | 'veg' | 'vegan' | 'jain' | 'non_veg'

export type DemoPaymentMethod = 'DEMO_UPI' | 'COUNTER_CASH'

export type DemoPaymentStatus =
  | 'PAY_AT_COUNTER'
  | 'PENDING'
  | 'DEMO_PAID'
  | 'DEMO_FAILED'
  | 'DEMO_CANCELLED'

export type DemoPaymentOutcome =
  | 'succeed'
  | 'fail'
  | 'cancel'
  | 'switch_to_counter'

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
  is_vegan?: boolean
  is_jain?: boolean
  allergen_info?: string | null
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
  requested_pickup_slot_start?: string | null
  payment_method?: DemoPaymentMethod
}

export interface CreateOrderResponse {
  id: string
  pickup_code: string
  pickup_token: string
  status: OrderStatus
  pickup_slot_start: string
  pickup_slot_end: string
  total_amount: number
  payment_method?: DemoPaymentMethod
  payment_status?: DemoPaymentStatus
  payment_reference?: string | null
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
  payment_method?: DemoPaymentMethod
  payment_status?: DemoPaymentStatus
  payment_reference?: string | null
  created_at: string
  updated_at: string
  items: OrderItemDetail[]
}

export interface DemoPaymentRequest {
  outcome: DemoPaymentOutcome
  method: DemoPaymentMethod
}

export interface DemoPaymentResponse {
  status: string
  payment_status: DemoPaymentStatus
  message: string
  order: OrderDetail
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
  is_vegan?: boolean
  is_jain?: boolean
  allergen_info?: string | null
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

export interface VerifyPickupResponse {
  status: string
  verified: boolean
  message: string
  order: OrderDetail
}

export interface ParsedOrderItem {
  menu_item_id: string
  name: string
  category: string
  quantity: number
  unit_price: number
  line_total: number
  prep_minutes: number
  available: boolean
  is_veg: boolean
  matched_phrase: string
  match_type: 'exact' | 'synonym' | 'fuzzy'
}

export interface AmbiguousOrderTerm {
  phrase: string
  quantity: number
  candidates: MenuItem[]
}

export interface ParsedPickupTime {
  raw_text: string
  requested_time_iso?: string | null
  formatted_time?: string | null
  status: 'valid_note' | 'unavailable' | 'past' | 'invalid'
  message: string
  matched_slot_start?: string | null
  suggested_slots: SlotWorkload[]
}

export type SlotAvailabilityState = 'available' | 'limited' | 'full' | 'closed'

export interface AvailablePickupSlot {
  slot_start: string
  slot_end: string
  capacity_units: number
  used_units: number
  remaining_units: number
  active_orders: number
  availability_state: SlotAvailabilityState
  is_closed: boolean
  close_reason?: string | null
  is_full: boolean
  is_feasible: boolean
}

export interface AvailableSlotsResponse {
  slot_duration_minutes: number
  slot_capacity_units: number
  requested_workload_units: number
  recommended_slot_start?: string | null
  slots: AvailablePickupSlot[]
}

export interface NaturalOrderParseResponse {
  original_text: string
  matched_items: ParsedOrderItem[]
  unavailable_items: ParsedOrderItem[]
  ambiguous_items: AmbiguousOrderTerm[]
  unmatched_terms: string[]
  warnings: string[]
  requested_pickup_time?: ParsedPickupTime | null
  subtotal_paise: number
  total_prep_units: number
  can_add_to_cart: boolean
}
