import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChefHat,
  Clock,
  RefreshCw,
} from 'lucide-react'
import {
  ApiClientError,
  fetchKitchenOrders,
  fetchKitchenSlots,
  updateKitchenOrderStatus,
} from '../api/client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { KitchenOrderCard } from '../components/KitchenOrderCard'
import {
  KitchenSummaryCards,
  type KitchenQueueFilter,
} from '../components/KitchenSummaryCards'
import { SlotWorkloadPanel } from '../components/SlotWorkloadPanel'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { OrderDetail, OrderStatus, SlotWorkload } from '../types'
import { formatTimeWindow } from '../utils/format'
import {
  computeKitchenSummary,
  groupOrdersBySlot,
} from '../utils/kitchen'

const KITCHEN_POLL_INTERVAL_MS = 4000

const FILTER_OPTIONS: { value: KitchenQueueFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'All Active' },
  { value: 'PLACED', label: 'New' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'COLLECTED', label: 'Collected' },
]

function KitchenQueueSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="h-7 w-20 animate-pulse rounded-lg bg-stone-200/70" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-stone-100" />
          </div>
          <div className="h-9 w-full animate-pulse rounded-xl bg-stone-100" />
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-stone-100" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-lg bg-stone-200/70" />
        </Card>
      ))}
    </div>
  )
}

export function KitchenPage() {
  const [activeOrders, setActiveOrders] = useState<OrderDetail[]>([])
  const [collectedOrders, setCollectedOrders] = useState<OrderDetail[]>([])
  const [slots, setSlots] = useState<SlotWorkload[]>([])
  const [statusFilter, setStatusFilter] = useState<KitchenQueueFilter>('ACTIVE')
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({})
  const [pendingCollectionOrder, setPendingCollectionOrder] =
    useState<OrderDetail | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const inFlightRef = useRef<boolean>(false)
  const mountedRef = useRef<boolean>(true)

  const syncKitchenData = useCallback(
    async (filterForView: KitchenQueueFilter) => {
      if (inFlightRef.current) {
        return
      }
      inFlightRef.current = true

      try {
        const requests: [
          Promise<OrderDetail[]>,
          Promise<SlotWorkload[]>,
          Promise<OrderDetail[]>?,
        ] = [
          fetchKitchenOrders('active'),
          fetchKitchenSlots(),
          filterForView === 'COLLECTED'
            ? fetchKitchenOrders('COLLECTED')
            : undefined,
        ]

        const [fetchedActive, fetchedSlots, fetchedCollected] =
          await Promise.all([
            requests[0],
            requests[1],
            requests[2] ?? Promise.resolve<OrderDetail[] | null>(null),
          ])

        if (!mountedRef.current) return

        setActiveOrders(fetchedActive)
        setSlots(fetchedSlots)
        if (fetchedCollected !== null) {
          setCollectedOrders(fetchedCollected)
        }
        setError(null)
        setLastUpdatedAt(
          new Intl.DateTimeFormat('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }).format(new Date()),
        )
      } catch (err) {
        if (!mountedRef.current) return
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Unable to reach the kitchen backend. Please verify FastAPI is running.'
        setError(message)
      } finally {
        inFlightRef.current = false
        if (mountedRef.current) {
          setIsInitialLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    mountedRef.current = true
    let active = true

    const loadInitial = () => {
      if (inFlightRef.current) return
      inFlightRef.current = true

      const collectedPromise =
        statusFilter === 'COLLECTED'
          ? fetchKitchenOrders('COLLECTED')
          : Promise.resolve<OrderDetail[] | null>(null)

      Promise.all([
        fetchKitchenOrders('active'),
        fetchKitchenSlots(),
        collectedPromise,
      ])
        .then(([fetchedActive, fetchedSlots, fetchedCollected]) => {
          if (!active || !mountedRef.current) return
          setActiveOrders(fetchedActive)
          setSlots(fetchedSlots)
          if (fetchedCollected !== null) {
            setCollectedOrders(fetchedCollected)
          }
          setError(null)
          setLastUpdatedAt(
            new Intl.DateTimeFormat('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            }).format(new Date()),
          )
        })
        .catch((err: unknown) => {
          if (!active || !mountedRef.current) return
          const message =
            err instanceof ApiClientError
              ? err.message
              : 'Unable to reach the kitchen backend. Please verify FastAPI is running.'
          setError(message)
        })
        .finally(() => {
          inFlightRef.current = false
          if (!active || !mountedRef.current) return
          setIsInitialLoading(false)
          setIsRefreshing(false)
        })
    }

    loadInitial()

    const timerId = window.setInterval(() => {
      void syncKitchenData(statusFilter)
    }, KITCHEN_POLL_INTERVAL_MS)

    return () => {
      active = false
      mountedRef.current = false
      window.clearInterval(timerId)
    }
  }, [statusFilter, syncKitchenData])

  const handleManualRefresh = useCallback(() => {
    if (inFlightRef.current) {
      return
    }
    setError(null)
    setIsRefreshing(true)
    void syncKitchenData(statusFilter)
  }, [statusFilter, syncKitchenData])

  const handleAdvanceStatus = useCallback(
    async (order: OrderDetail, nextStatus: OrderStatus) => {
      if (updatingOrderIds[order.id]) {
        return
      }

      setActionError(null)
      setUpdatingOrderIds((prev) => ({ ...prev, [order.id]: true }))

      try {
        const updatedOrder = await updateKitchenOrderStatus(order.id, nextStatus)

        if (nextStatus === 'COLLECTED') {
          setActiveOrders((prev) =>
            prev.filter((item) => item.id !== updatedOrder.id),
          )
          setCollectedOrders((prev) => [
            updatedOrder,
            ...prev.filter((item) => item.id !== updatedOrder.id),
          ])
        } else {
          setActiveOrders((prev) =>
            prev.map((item) =>
              item.id === updatedOrder.id ? updatedOrder : item,
            ),
          )
        }

        const refreshedSlots = await fetchKitchenSlots()
        setSlots(refreshedSlots)
        setPendingCollectionOrder(null)
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Failed to update order status.'
        setActionError(message)
        // Re-sync queue immediately in case another kitchen screen changed this order.
        void syncKitchenData(statusFilter)
      } finally {
        setUpdatingOrderIds((prev) => {
          const next = { ...prev }
          delete next[order.id]
          return next
        })
      }
    },
    [statusFilter, syncKitchenData, updatingOrderIds],
  )

  const summary = useMemo(
    () => computeKitchenSummary(activeOrders),
    [activeOrders],
  )

  const displayedOrders = useMemo(() => {
    if (statusFilter === 'ACTIVE') {
      return activeOrders
    }
    if (statusFilter === 'COLLECTED') {
      return collectedOrders
    }
    return activeOrders.filter((order) => order.status === statusFilter)
  }, [activeOrders, collectedOrders, statusFilter])

  const slotGroups = useMemo(
    () => groupOrdersBySlot(displayedOrders),
    [displayedOrders],
  )

  const slotLookup = useMemo(() => {
    const map = new Map<string, SlotWorkload>()
    for (const slot of slots) {
      map.set(slot.slot_start, slot)
    }
    return map
  }, [slots])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            <span>
              Live · Auto-refreshing every 4s
              {lastUpdatedAt ? ` · Updated ${lastUpdatedAt}` : ''}
            </span>
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Kitchen Live Queue
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Monitor slot capacity, accept incoming pre-orders, and update
            preparation progress in real time.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={isRefreshing}
          onClick={handleManualRefresh}
          icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          Refresh Queue
        </Button>
      </div>

      <KitchenSummaryCards
        summary={summary}
        selectedFilter={statusFilter}
        onSelectFilter={setStatusFilter}
      />

      <SlotWorkloadPanel slots={slots} isLoading={isInitialLoading} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Filter kitchen orders by status"
        >
          {FILTER_OPTIONS.map((option) => {
            const isSelected = statusFilter === option.value
            const count =
              option.value === 'ACTIVE'
                ? summary.totalActive
                : option.value === 'PLACED'
                  ? summary.placed
                  : option.value === 'ACCEPTED'
                    ? summary.accepted
                    : option.value === 'PREPARING'
                      ? summary.preparing
                      : option.value === 'READY'
                        ? summary.ready
                        : collectedOrders.length

            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setStatusFilter(option.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <span>{option.label}</span>
                {(option.value !== 'COLLECTED' || isSelected) && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                      isSelected
                        ? 'bg-emerald-800 text-emerald-50'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && activeOrders.length > 0 && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
        >
          <span>Live polling warning: {error}</span>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="font-semibold underline cursor-pointer"
          >
            Retry now
          </button>
        </div>
      )}

      {isInitialLoading ? (
        <KitchenQueueSkeleton />
      ) : error && activeOrders.length === 0 ? (
        <Card className="border-rose-200 bg-rose-50/50 p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Couldn&apos;t load kitchen orders
                </h2>
                <p className="mt-1 text-sm text-stone-600">{error}</p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualRefresh}
            >
              Retry
            </Button>
          </div>
        </Card>
      ) : displayedOrders.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <ChefHat className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-stone-900">
            {statusFilter === 'ACTIVE'
              ? 'Kitchen queue is clear'
              : `No ${statusFilter.toLowerCase()} orders right now`}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {statusFilter === 'ACTIVE'
              ? 'New student pre-orders will appear here automatically every few seconds.'
              : 'Switch back to All Active orders to monitor incoming tickets.'}
          </p>
          {statusFilter !== 'ACTIVE' && (
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStatusFilter('ACTIVE')}
              >
                Show All Active Orders
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {slotGroups.map((group) => {
            const slotMeta = slotLookup.get(group.slotStart)
            return (
              <div key={group.slotStart} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-stone-900">
                      Pickup Window: {formatTimeWindow(group.slotStart, group.slotEnd)}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <span>
                      {group.orders.length}{' '}
                      {group.orders.length === 1 ? 'order' : 'orders'}
                    </span>
                    <span>·</span>
                    <span>
                      {slotMeta
                        ? `${slotMeta.used_units}/${slotMeta.capacity_units} slot units`
                        : `${group.totalPrepUnits} prep units`}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.orders.map((order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      isUpdating={Boolean(updatingOrderIds[order.id])}
                      onAdvanceStatus={(targetOrder, next) => {
                        void handleAdvanceStatus(targetOrder, next)
                      }}
                      onRequestCollect={setPendingCollectionOrder}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingCollectionOrder !== null}
        title="Confirm order collection"
        description={
          pendingCollectionOrder
            ? `Mark pickup code ${pendingCollectionOrder.pickup_code} (${pendingCollectionOrder.customer_name}) as Collected? This removes the order from the active queue and releases ${pendingCollectionOrder.total_prep_units} prep units in its slot.`
            : ''
        }
        confirmLabel="Confirm Collected"
        isConfirming={
          pendingCollectionOrder
            ? Boolean(updatingOrderIds[pendingCollectionOrder.id])
            : false
        }
        onCancel={() => setPendingCollectionOrder(null)}
        onConfirm={() => {
          if (pendingCollectionOrder) {
            void handleAdvanceStatus(pendingCollectionOrder, 'COLLECTED')
          }
        }}
      />
    </section>
  )
}
