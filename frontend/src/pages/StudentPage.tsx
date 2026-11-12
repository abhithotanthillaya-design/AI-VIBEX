import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ClipboardList,
  History,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import {
  ApiClientError,
  createOrder,
  fetchAvailableSlots,
  fetchMenu,
} from '../api/client'
import { CartPanel } from '../components/CartPanel'
import { MenuCard } from '../components/MenuCard'
import { MenuFilters } from '../components/MenuFilters'
import { NaturalOrderPanel } from '../components/NaturalOrderPanel'
import { OrderConfirmationCard } from '../components/OrderConfirmationCard'
import { StudentOrderHistory } from '../components/StudentOrderHistory'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type {
  AvailablePickupSlot,
  CartItem,
  CreateOrderResponse,
  DemoPaymentMethod,
  DietaryFilter,
  MenuItem,
  ParsedPickupTime,
} from '../types'
import {
  addItemToCart,
  calculateCartTotals,
  getCartQuantityMap,
  mergeParsedItemsIntoCart,
  removeItemFromCart,
  updateCartItemQuantity,
} from '../utils/cart'
import { formatRupees } from '../utils/format'
import { filterMenuItemsByDietAndCategory } from '../utils/phase10'
import {
  isSlotAllocationErrorCode,
  resolveCheckoutSlotSelection,
  type SlotSelectionMode,
} from '../utils/slots'
import {
  readStoredOrderId,
  recordStoredOrderHistory,
  writeStoredOrderId,
  writeStoredPickupToken,
} from '../utils/storage'
import { OrderTrackingPage } from './OrderTrackingPage'

const CATEGORY_ORDER = ['Meals', 'Fast Food', 'Snacks', 'Beverages']
const MENU_POLL_INTERVAL_MS = 10000

type StudentSubView = 'menu' | 'tracking' | 'history'

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
  notes?: string
}

interface StudentPageProps {
  currentUser?: { full_name: string; student_roll_no?: string | null } | null
}

export function StudentPage({ currentUser }: StudentPageProps) {
  const [subView, setSubView] = useState<StudentSubView>('menu')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('all')
  const [cart, setCart] = useState<CartItem[]>([])

  const [customerName, setCustomerName] = useState<string>(
    () => currentUser?.full_name ?? '',
  )
  const [notes, setNotes] = useState<string>('')
  const [paymentMethod, setPaymentMethod] =
    useState<DemoPaymentMethod>('COUNTER_CASH')
  const [availableSlots, setAvailableSlots] = useState<AvailablePickupSlot[]>(
    [],
  )
  const [recommendedSlotStart, setRecommendedSlotStart] = useState<
    string | null
  >(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [slotSelectionMode, setSlotSelectionMode] =
    useState<SlotSelectionMode>('auto')
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null)
  const [slotNotice, setSlotNotice] = useState<string | null>(null)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderSnapshot | null>(null)
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(() =>
    readStoredOrderId(),
  )
  const submittingGuardRef = useRef<boolean>(false)
  const menuPollInFlightRef = useRef<boolean>(false)
  const slotsPollInFlightRef = useRef<boolean>(false)

  const syncMenuItems = useCallback((items: MenuItem[]) => {
    setMenuItems(items)
    const availableById = new Map(items.map((item) => [item.id, item]))
    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart
      const nextCart: CartItem[] = []
      let removedAny = false
      for (const entry of prevCart) {
        const fresh = availableById.get(entry.item.id)
        if (fresh && fresh.available) {
          nextCart.push({ item: fresh, quantity: entry.quantity })
        } else {
          removedAny = true
        }
      }
      if (removedAny) {
        setSubmitError(
          'One or more items in your cart became unavailable and were removed.',
        )
      }
      return nextCart
    })
  }, [])

  const loadMenu = useCallback(async () => {
    setIsLoadingMenu(true)
    setMenuError(null)
    try {
      const items = await fetchMenu()
      syncMenuItems(items)
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
  }, [syncMenuItems])

  useEffect(() => {
    let active = true

    fetchMenu()
      .then((items) => {
        if (!active) return
        syncMenuItems(items)
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
  }, [syncMenuItems])

  useEffect(() => {
    if (subView !== 'menu' || placedOrder !== null) {
      return
    }

    const timerId = window.setInterval(() => {
      if (menuPollInFlightRef.current) return
      menuPollInFlightRef.current = true
      fetchMenu()
        .then((items) => {
          syncMenuItems(items)
          setMenuError(null)
        })
        .catch(() => {
          // Keep existing menu visible during transient background polling failures.
        })
        .finally(() => {
          menuPollInFlightRef.current = false
        })
    }, MENU_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [subView, placedOrder, syncMenuItems])

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

  const filteredItems = useMemo(
    () =>
      filterMenuItemsByDietAndCategory(menuItems, {
        category: selectedCategory,
        dietary: dietaryFilter,
        search: searchQuery,
      }),
    [menuItems, searchQuery, selectedCategory, dietaryFilter],
  )

  const quantitiesByItemId = useMemo(() => getCartQuantityMap(cart), [cart])
  const cartTotals = useMemo(() => calculateCartTotals(cart), [cart])

  const loadAvailableSlots = useCallback(async (workloadUnits: number) => {
    setIsLoadingSlots(true)
    setSlotsError(null)
    try {
      const response = await fetchAvailableSlots(workloadUnits)
      setAvailableSlots(response.slots)
      setRecommendedSlotStart(response.recommended_slot_start ?? null)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSlotsError(error.message)
      } else {
        setSlotsError('Unable to load pickup slots right now.')
      }
    } finally {
      setIsLoadingSlots(false)
    }
  }, [])

  useEffect(() => {
    if (subView !== 'menu' || placedOrder !== null || cart.length === 0) {
      return
    }

    let active = true
    const workload = cartTotals.totalPrepUnits

    fetchAvailableSlots(workload)
      .then((response) => {
        if (!active) return
        setAvailableSlots(response.slots)
        setRecommendedSlotStart(response.recommended_slot_start ?? null)
        setSlotsError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiClientError) {
          setSlotsError(error.message)
        } else {
          setSlotsError('Unable to load pickup slots right now.')
        }
      })

    const timerId = window.setInterval(() => {
      if (slotsPollInFlightRef.current) return
      slotsPollInFlightRef.current = true
      fetchAvailableSlots(workload)
        .then((response) => {
          setAvailableSlots(response.slots)
          setRecommendedSlotStart(response.recommended_slot_start ?? null)
          setSlotsError(null)
        })
        .catch(() => {
          // Preserve current slots during transient polling errors.
        })
        .finally(() => {
          slotsPollInFlightRef.current = false
        })
    }, MENU_POLL_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(timerId)
    }
  }, [subView, placedOrder, cart.length, cartTotals.totalPrepUnits])

  const resolvedSlot = useMemo(
    () =>
      resolveCheckoutSlotSelection({
        slots: availableSlots,
        selectedSlotStart,
        selectionMode: slotSelectionMode,
        recommendedSlotStart,
        orderWorkloadUnits: cartTotals.totalPrepUnits,
      }),
    [
      availableSlots,
      selectedSlotStart,
      slotSelectionMode,
      recommendedSlotStart,
      cartTotals.totalPrepUnits,
    ],
  )

  const handleSelectSlot = useCallback((slotStart: string) => {
    setSubmitError(null)
    setSlotNotice(null)
    setSlotSelectionMode('manual')
    setSelectedSlotStart(slotStart)
  }, [])

  const handleUseEarliestSlot = useCallback(() => {
    setSubmitError(null)
    setSlotNotice(null)
    setSlotSelectionMode('auto')
    setSelectedSlotStart(null)
  }, [])

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
    setSlotSelectionMode('auto')
    setSelectedSlotStart(null)
    setSlotNotice(null)
  }, [])

  const handleConfirmNaturalItems = useCallback(
    (
      additions: { item: MenuItem; quantity: number }[],
      preferredPickupTime?: ParsedPickupTime | null,
    ) => {
      setSubmitError(null)
      setCart((prev) => mergeParsedItemsIntoCart(prev, additions))

      if (preferredPickupTime) {
        if (preferredPickupTime.matched_slot_start) {
          setSlotSelectionMode('natural')
          setSelectedSlotStart(preferredPickupTime.matched_slot_start)
          setSlotNotice(
            `Preselected ${preferredPickupTime.formatted_time ?? 'requested'} pickup window from your request. Please confirm it before placing your order.`,
          )
        } else {
          setSlotNotice(preferredPickupTime.message)
        }
      }
    },
    [],
  )

  const handleResetFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedCategory('All')
    setDietaryFilter('all')
  }, [])

  const handleOrderIdPersist = useCallback((orderId: string | null) => {
    setTrackedOrderId(orderId)
    writeStoredOrderId(orderId)
  }, [])

  const handlePlaceOrder = useCallback(async () => {
    if (submittingGuardRef.current || cart.length === 0) {
      return
    }

    if (resolvedSlot.unavailableWarning) {
      setSubmitError(resolvedSlot.unavailableWarning)
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
    const slotToReserve = resolvedSlot.effectiveSlotStart

    try {
      const confirmation = await createOrder({
        customer_name: trimmedName,
        items: cartSnapshot.map((entry) => ({
          menu_item_id: entry.item.id,
          quantity: entry.quantity,
        })),
        payment_method: paymentMethod,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        ...(slotToReserve ? { requested_pickup_slot_start: slotToReserve } : {}),
      })

      // Clear cart only after backend confirms successful order creation.
      setCart([])
      setNotes('')
      setPaymentMethod('COUNTER_CASH')
      setSlotSelectionMode('auto')
      setSelectedSlotStart(null)
      setSlotNotice(null)
      writeStoredPickupToken(confirmation.id, confirmation.pickup_token)
      recordStoredOrderHistory(confirmation.id)
      setPlacedOrder({
        confirmation,
        items: cartSnapshot,
        customerName: trimmedName,
        notes: trimmedNotes || undefined,
      })
      handleOrderIdPersist(confirmation.id)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message)
        if (isSlotAllocationErrorCode(error.code)) {
          void loadAvailableSlots(cartTotals.totalPrepUnits)
        }
      } else {
        setSubmitError(
          'Unable to place order right now. Please check your connection and try again.',
        )
      }
    } finally {
      submittingGuardRef.current = false
      setIsSubmittingOrder(false)
    }
  }, [
    cart,
    cartTotals.totalPrepUnits,
    customerName,
    notes,
    paymentMethod,
    resolvedSlot.effectiveSlotStart,
    resolvedSlot.unavailableWarning,
    handleOrderIdPersist,
    loadAvailableSlots,
  ])

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

  if (subView === 'history') {
    return (
      <StudentOrderHistory
        onBackToMenu={() => setSubView('menu')}
        onOpenTracking={handleOpenTracking}
      />
    )
  }

  return (
    <section className="space-y-6 pb-20 lg:pb-6 ql-animate-enter">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#BDD6C7] bg-[#E3EFE8] px-3 py-1 text-xs font-medium text-[#143B2B]">
            <span className="h-2 w-2 rounded-full bg-[#1A4D38]" />
            <span>
              {currentUser
                ? `Signed in as ${currentUser.full_name}${currentUser.student_roll_no ? ` (${currentUser.student_roll_no})` : ''} · Open for Pre-Orders`
                : 'Main Campus Canteen · Open for Pre-Orders'}
            </span>
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-[#1E1D1A] sm:text-3xl">
            {currentUser
              ? `Welcome back, ${currentUser.full_name.split(' ')[0]}`
              : 'Freshly cooked, timed for pickup'}
          </h1>
          <p className="mt-1 text-sm text-[#5B564D]">
            Pre-order your campus meal into a capacity-checked 5-minute pickup
            slot — skip the counter rush.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSubView('history')}
            icon={<History className="h-4 w-4" aria-hidden="true" />}
          >
            Order History
          </Button>
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
          notes={placedOrder.notes}
          onPaymentUpdated={(updated) => {
            setPlacedOrder((prev) =>
              prev
                ? {
                    ...prev,
                    confirmation: {
                      ...prev.confirmation,
                      payment_method: updated.payment_method,
                      payment_status: updated.payment_status,
                      payment_reference: updated.payment_reference,
                    },
                  }
                : prev,
            )
          }}
          onTrackOrder={handleOpenTracking}
          onNewOrder={handleStartNewOrder}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <NaturalOrderPanel
              menuItems={menuItems}
              onConfirmAddToCart={handleConfirmNaturalItems}
            />

            <MenuFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              dietaryFilter={dietaryFilter}
              onDietaryChange={setDietaryFilter}
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
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              availableSlots={availableSlots}
              recommendedSlotStart={recommendedSlotStart}
              effectiveSlotStart={resolvedSlot.effectiveSlotStart}
              selectedSlot={resolvedSlot.selectedSlot}
              isUsingDefaultEarliest={resolvedSlot.isUsingDefaultEarliest}
              slotUnavailableWarning={resolvedSlot.unavailableWarning}
              slotNotice={slotNotice}
              onClearSlotNotice={() => setSlotNotice(null)}
              isLoadingSlots={isLoadingSlots}
              slotsError={slotsError}
              onSelectSlot={handleSelectSlot}
              onUseEarliestSlot={handleUseEarliestSlot}
              onRefreshSlots={() => {
                void loadAvailableSlots(cartTotals.totalPrepUnits)
              }}
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
            className="flex w-full items-center justify-between rounded-2xl bg-[#1A4D38] px-4 py-3 text-[#FCFBF8] shadow-lg transition-colors hover:bg-[#143B2B] cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium tabular-nums">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              <span>
                {cartTotals.itemCount}{' '}
                {cartTotals.itemCount === 1 ? 'item' : 'items'} in tray
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
