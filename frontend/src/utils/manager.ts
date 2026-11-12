import type {
  MenuCategory,
  MenuItemUpsertRequest,
  OrderDetail,
} from '../types'

export const MENU_CATEGORIES: MenuCategory[] = [
  'Meals',
  'Fast Food',
  'Snacks',
  'Beverages',
]

export const LOCAL_MENU_IMAGE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Veg Grilled Sandwich', value: '/images/menu/veg-grilled-sandwich.jpg' },
  { label: 'Masala Dosa', value: '/images/menu/masala-dosa.jpg' },
  { label: 'Samosa Chaat', value: '/images/menu/samosa-chaat.jpg' },
  { label: 'Paneer Kathi Roll', value: '/images/menu/paneer-kathi-roll.jpg' },
  { label: 'Rajma Chawal Bowl', value: '/images/menu/rajma-chawal.jpg' },
  { label: 'Chole Bhature', value: '/images/menu/chole-bhature.jpg' },
  { label: 'Poha & Peanut Crunch', value: '/images/menu/poha.jpg' },
  { label: 'Schezwan Veg Maggi', value: '/images/menu/schezwan-maggi.jpg' },
  { label: 'Masala Chai', value: '/images/menu/masala-chai.jpg' },
  { label: 'Classic Cold Coffee', value: '/images/menu/cold-coffee.jpg' },
  { label: 'Fresh Lime Soda', value: '/images/menu/fresh-lime-soda.jpg' },
]

export interface MenuFormValues {
  name: string
  description: string
  category: MenuCategory
  priceRupees: string
  prepMinutes: string
  imageUrl: string
  isVeg: boolean
  available: boolean
}

export type MenuFormValidationResult =
  | { ok: true; payload: MenuItemUpsertRequest }
  | { ok: false; error: string }

/**
 * Validate manager menu form input and convert Rupees string safely into integer paise.
 */
export function validateMenuFormInput(
  values: MenuFormValues,
): MenuFormValidationResult {
  const name = values.name.trim()
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Dish name must be between 2 and 80 characters.' }
  }

  const description = values.description.trim()
  if (description.length < 4 || description.length > 300) {
    return {
      ok: false,
      error: 'Description must be between 4 and 300 characters.',
    }
  }

  if (!MENU_CATEGORIES.includes(values.category)) {
    return { ok: false, error: 'Please select a valid menu category.' }
  }

  const parsedRupees = Number(values.priceRupees)
  if (!Number.isFinite(parsedRupees) || parsedRupees <= 0 || parsedRupees > 5000) {
    return { ok: false, error: 'Price must be between ₹1 and ₹5,000.' }
  }
  const pricePaise = Math.round(parsedRupees * 100)
  if (pricePaise <= 0) {
    return { ok: false, error: 'Price must be greater than ₹0.' }
  }

  const parsedPrep = Number(values.prepMinutes)
  if (
    !Number.isInteger(parsedPrep) ||
    parsedPrep < 1 ||
    parsedPrep > 60
  ) {
    return {
      ok: false,
      error: 'Preparation time must be a whole number between 1 and 60 minutes.',
    }
  }

  const trimmedImage = values.imageUrl.trim()
  if (
    trimmedImage &&
    !(
      trimmedImage.startsWith('/') ||
      trimmedImage.startsWith('https://') ||
      trimmedImage.startsWith('http://')
    )
  ) {
    return {
      ok: false,
      error: "Image path must start with '/', 'http://', or 'https://'.",
    }
  }

  return {
    ok: true,
    payload: {
      name,
      description,
      category: values.category,
      price: pricePaise,
      prep_minutes: parsedPrep,
      image_url: trimmedImage || null,
      is_veg: values.isVeg,
      available: values.available,
    },
  }
}

export interface ManagerOrderFilters {
  status: string
  search: string
  date: string
}

export function filterManagerOrdersClient(
  orders: OrderDetail[],
  filters: ManagerOrderFilters,
): OrderDetail[] {
  const statusNorm = filters.status.trim().toUpperCase()
  const searchNorm = filters.search.trim().toLowerCase()
  const dateNorm = filters.date.trim()

  return orders.filter((order) => {
    if (statusNorm && statusNorm !== 'ALL') {
      if (statusNorm === 'ACTIVE') {
        if (order.status === 'COLLECTED' || order.status === 'CANCELLED') {
          return false
        }
      } else if (statusNorm === 'COMPLETED') {
        if (order.status !== 'COLLECTED') return false
      } else if (order.status !== statusNorm) {
        return false
      }
    }

    if (dateNorm) {
      const orderDay = order.created_at.slice(0, 10)
      if (orderDay !== dateNorm) return false
    }

    if (searchNorm) {
      const matches =
        order.id.toLowerCase().includes(searchNorm) ||
        order.pickup_code.toLowerCase().includes(searchNorm) ||
        order.customer_name.toLowerCase().includes(searchNorm)
      if (!matches) return false
    }

    return true
  })
}

export type ManagerSectionTab =
  | 'overview'
  | 'menu'
  | 'orders'
  | 'sales'
  | 'slots'

export function validateCapacityInput(rawValue: string): {
  ok: true
  value: number
} | {
  ok: false
  error: string
} {
  const parsed = Number(rawValue)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    return {
      ok: false,
      error: 'Slot capacity must be a whole number between 1 and 100 prep units.',
    }
  }
  return { ok: true, value: parsed }
}

