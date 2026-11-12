import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ClipboardList,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { ApiClientError, createOrder, fetchMenu } from '../api/client'
import { CartPanel } from '../components/CartPanel'
import { MenuCard } from '../components/MenuCard'
import { MenuFilters } from '../components/MenuFilters'
import { OrderConfirmationCard } from '../components/OrderConfirmationCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { CartItem, CreateOrderResponse, MenuItem } from '../types'
import {
  addItemToCart,
  calculateCartTotals,
  getCartQuantityMap,
  removeItemFromCart,
  updateCartItemQuantity,
} from '../utils/cart'
import { formatRupees } from '../utils/format'
import { OrderTrackingPage } from './OrderTrackingPage'

const CATEGORY_ORDER = ['Meals', 'Fast Food', 'Snacks', 'Beverages']
const LAST_ORDER_STORAGE_KEY = 'queueless_last_order_id'

type StudentSubView = 'menu' | 'tracking'

function readStoredOrderId(): string | null {
  try {
    return window.localStorage.getItem(LAST_ORDER_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredOrderId(orderId: string | null): void {
  try {
    if (orderId) {
      window.localStorage.setItem(LAST_ORDER_STORAGE_KEY, orderId)
    } else {
      window.localStorage.removeItem(LAST_ORDER_STORAGE_KEY)
    }
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function MenuGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <div className="aspect-[4/3] animate-pulse bg-stone-200/70" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200/70" />
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-stone-100" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="h-5 w-14 animate-pulse rounded bg-stone-200/70" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-stone-200/70" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

interface PlacedOrderSnapshot {
  confirmation: CreateOrderResponse
  items: CartItem[]
  customerName: string
}

export function StudentPage() {
  const [subView, setSubView] = useState<StudentSubView>('menu')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [cart, setCart] = useState<CartItem[]>([])

  const [customerName, setCustomerName] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderSnapshot | null>(null)
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(() =>
    readStoredOrderId(),
  )
  const submittingGuardRef = useRef<boolean>(false)

  const loadMenu = useCallback(async () => {
    setIsLoadingMenu(true)
    setMenuError(null)
    try {
      const items = await fetchMenu()
      setMenuItems(items)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setMenuError(error.message)
      } else {
        setMenuError(
          'Unable to connect to the canteen backend. Please check that the API server is running.',
        )
      }
    } finally {
      setIsLoadingMenu(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    fetchMenu()
      .then((items) => {
        if (!active) return
        setMenuItems(items)
        setMenuError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiClientError) {
          setMenuError(error.message)
        } else {
          setMenuError(
            'Unable to connect to the canteen backend. Please check that the API server is running.',
          )
        }
      })
      .finally(() => {
        if (!active) return
        setIsLoadingMenu(false)
      })

    return () => {
      active = false
    }
  }, [])

  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of menuItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1
    }
    const ordered = Object.keys(counts).sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a)
      const indexB = CATEGORY_ORDER.indexOf(b)
      if (indexA === -1 && indexB === -1) return a.localeCompare(b)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
    return { categories: ordered, categoryCounts: counts }
  }, [menuItems])

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    return menuItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [menuItems, searchQuery, selectedCategory])

  const quantitiesByItemId = useMemo(() => getCartQuantityMap(cart), [cart])
  const cartTotals = useMemo(() => calculateCartTotals(cart), [cart])

  const handleAddToCart = useCallback((item: MenuItem) => {
    setSubmitError(null)
    setCart((prev) => addItemToCart(prev, item))
  }, [])

  const handleUpdateQuantity = useCallback((itemId: string, delta: number) => {
    setSubmitError(null)
    setCart((prev) => updateCartItemQuantity(prev, itemId, delta))
  }, [])

  const handleRemoveItem = useCallback((itemId: string) => {
    setSubmitError(null)
    setCart((prev) => removeItemFromCart(prev, itemId))
  }, [])

  const handleClearCart = useCallback(() => {
    setSubmitError(null)
    setCart([])
  }, [])

  const handleResetFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedCategory('All')
  }, [])

  const handleOrderIdPersist = useCallback((orderId: string | null) => {
    setTrackedOrderId(orderId)
    writeStoredOrderId(orderId)
  }, [])

  const handlePlaceOrder = useCallback(async () => {
    if (submittingGuardRef.current || cart.length === 0) {
      return
    }

    const trimmedName = customerName.trim()
    if (!trimmedName) {
      setSubmitError('Please enter your name before placing the order.')
      return
    }

    submittingGuardRef.current = true
    setIsSubmittingOrder(true)
    setSubmitError(null)

    const cartSnapshot = cart.map((entry) => ({ ...entry }))
    const trimmedNotes = notes.trim()

    try {
      const confirmation = await createOrder({
        customer_name: trimmedName,
        items: cartSnapshot.map((entry) => ({
          menu_item_id: entry.item.id,
          quantity: entry.quantity,
        })),
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      })

      // Clear cart only after backend confirms successful order creation.
      setCart([])
      setNotes('')
      setPlacedOrder({
        confirmation,
        items: cartSnapshot,
        customerName: trimmedName,
      })
      handleOrderIdPersist(confirmation.id)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message)
      } else {
        setSubmitError(
          'Unable to place order right now. Please check your connection and try again.',
        )
      }
    } finally {
      submittingGuardRef.current = false
      setIsSubmittingOrder(false)
    }
  }, [cart, customerName, notes, handleOrderIdPersist])

  const handleOpenTracking = useCallback(
    (orderId: string) => {
      handleOrderIdPersist(orderId)
      setSubView('tracking')
    },
    [handleOrderIdPersist],
  )

  const handleStartNewOrder = useCallback(() => {
    setPlacedOrder(null)
    setSubView('menu')
  }, [])

  const scrollToCart = useCallback(() => {
    document
      .getElementById('cart-panel')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (subView === 'tracking') {
    return (
      <OrderTrackingPage
        key={trackedOrderId ?? 'lookup'}
        initialOrderId={trackedOrderId}
        onOrderIdChange={handleOrderIdPersist}
        onBackToMenu={() => setSubView('menu')}
      />
    )
  }

  return (
    <section className="space-y-6 pb-20 lg:pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span>Main Campus Canteen · Open for Pre-Orders</span>
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Freshly cooked, timed for pickup
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Pre-order your meal and get a capacity-checked pickup window so you
            skip the counter rush.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSubView('tracking')}
            icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
          >
            {trackedOrderId ? 'Track Current Order' : 'Track Order'}
          </Button>
          {!placedOrder && (
            <Button
              variant="secondary"
              size="sm"
              loading={isLoadingMenu}
              onClick={() => {
                void loadMenu()
              }}
              icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            >
              Refresh Menu
            </Button>
          )}
        </div>
      </div>

      {placedOrder ? (
        <OrderConfirmationCard
          confirmation={placedOrder.confirmation}
          orderedItems={placedOrder.items}
          customerName={placedOrder.customerName}
          onTrackOrder={handleOpenTracking}
          onNewOrder={handleStartNewOrder}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <MenuFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categoryCounts={categoryCounts}
              totalCount={menuItems.length}
            />

            {isLoadingMenu ? (
              <MenuGridSkeleton />
            ) : menuError ? (
              <Card className="border-rose-200 bg-rose-50/50 p-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                      <AlertCircle className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-stone-900">
                        Couldn&apos;t load the menu
                      </h2>
                      <p className="mt-1 text-sm text-stone-600">{menuError}</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      void loadMenu()
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </Card>
            ) : menuItems.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                  <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-base font-semibold text-stone-900">
                  No menu items available right now
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Check back shortly or refresh to fetch updated canteen stock.
                </p>
              </Card>
            ) : filteredItems.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                  <Sparkles className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-base font-semibold text-stone-900">
                  No dishes match your filter
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Try searching for another dish or reset your category filter.
                </p>
                <div className="mt-4">
                  <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                    Reset filters
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    quantity={quantitiesByItemId[item.id] ?? 0}
                    onAdd={handleAddToCart}
                    onUpdateQuantity={handleUpdateQuantity}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24">
            <CartPanel
              items={cart}
              customerName={customerName}
              onCustomerNameChange={(value) => {
                setSubmitError(null)
                setCustomerName(value)
              }}
              notes={notes}
              onNotesChange={setNotes}
              isSubmitting={isSubmittingOrder}
              submitError={submitError}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              onPlaceOrder={() => {
                void handlePlaceOrder()
              }}
            />
          </aside>
        </div>
      )}

      {!placedOrder && cartTotals.itemCount > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-30 lg:hidden">
          <button
            type="button"
            onClick={scrollToCart}
            className="flex w-full items-center justify-between rounded-2xl bg-emerald-800 px-4 py-3 text-white shadow-lg transition-colors hover:bg-emerald-900 cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              <span>
                {cartTotals.itemCount}{' '}
                {cartTotals.itemCount === 1 ? 'item' : 'items'} in cart
              </span>
            </span>
            <span className="text-sm font-semibold">
              {formatRupees(cartTotals.totalPaise)} · Checkout
            </span>
          </button>
        </div>
      )}
    </section>
  )
}
