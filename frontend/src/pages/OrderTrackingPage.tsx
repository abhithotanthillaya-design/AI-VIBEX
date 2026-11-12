import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  RefreshCw,
  Search,
  Ticket,
} from 'lucide-react'
import { ApiClientError, fetchOrder } from '../api/client'
import { OrderTimeline } from '../components/OrderTimeline'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { OrderDetail } from '../types'
import {
  formatRupees,
  formatShortDateTime,
  formatTimeWindow,
} from '../utils/format'

const POLL_INTERVAL_MS = 4000

interface OrderTrackingPageProps {
  initialOrderId: string | null
  onOrderIdChange: (orderId: string | null) => void
  onBackToMenu: () => void
}

export function OrderTrackingPage({
  initialOrderId,
  onOrderIdChange,
  onBackToMenu,
}: OrderTrackingPageProps) {
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(
    initialOrderId,
  )
  const [lookupInput, setLookupInput] = useState<string>(initialOrderId ?? '')
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(initialOrderId))
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const inFlightRef = useRef<boolean>(false)

  const loadOrder = useCallback(async (orderId: string, background = false) => {
    if (inFlightRef.current) {
      return
    }
    inFlightRef.current = true

    if (background) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
      setError(null)
    }

    try {
      const detail = await fetchOrder(orderId)
      setOrder(detail)
      setError(null)
      setLastSyncedAt(
        new Intl.DateTimeFormat('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(new Date()),
      )
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Unable to connect to backend while fetching order status.'
      setError(message)
      if (!background) {
        setOrder(null)
      }
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!trackedOrderId) {
      return
    }

    let active = true

    fetchOrder(trackedOrderId)
      .then((detail) => {
        if (!active) return
        setOrder(detail)
        setError(null)
        setLastSyncedAt(
          new Intl.DateTimeFormat('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }).format(new Date()),
        )
      })
      .catch((err: unknown) => {
        if (!active) return
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Unable to connect to backend while fetching order status.'
        setOrder(null)
        setError(message)
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [trackedOrderId])

  useEffect(() => {
    if (
      !trackedOrderId ||
      order?.status === 'COLLECTED' ||
      order?.status === 'CANCELLED'
    ) {
      return
    }

    const timerId = window.setInterval(() => {
      void loadOrder(trackedOrderId, true)
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [trackedOrderId, order?.status, loadOrder])

  const handleLookupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleaned = lookupInput.trim()
    if (!cleaned) {
      return
    }
    setError(null)
    setOrder(null)
    setIsLoading(true)
    setTrackedOrderId(cleaned)
    onOrderIdChange(cleaned)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBackToMenu}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-900 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Menu</span>
          </button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Live Order Tracking
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Track your pickup code, assigned slot window, and kitchen preparation
            progress in real time.
          </p>
        </div>

        <form
          onSubmit={handleLookupSubmit}
          className="flex w-full gap-2 sm:w-auto sm:min-w-[320px]"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={lookupInput}
              onChange={(event) => setLookupInput(event.target.value)}
              placeholder="Enter Order ID (e.g. ord_...)"
              aria-label="Order ID to track"
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm font-mono text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Track
          </Button>
        </form>
      </div>

      {!trackedOrderId ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Ticket className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-stone-900">
            No order selected yet
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Place a pre-order from the canteen menu or enter an existing Order ID
            above to view live status updates.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="md" onClick={onBackToMenu}>
              Browse Canteen Menu
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Card className="space-y-4 p-6" aria-busy="true">
          <div className="h-6 w-48 animate-pulse rounded bg-stone-200/70" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-2xl bg-stone-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-stone-100" />
          </div>
          <div className="h-44 animate-pulse rounded-2xl bg-stone-100" />
        </Card>
      ) : error && !order ? (
        <Card className="border-rose-200 bg-rose-50/50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Unable to load order
                </h2>
                <p className="mt-1 text-sm text-stone-600">{error}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void loadOrder(trackedOrderId, false)
                }}
              >
                Retry
              </Button>
              <Button variant="primary" size="sm" onClick={onBackToMenu}>
                Back to Menu
              </Button>
            </div>
          </div>
        </Card>
      ) : order ? (
        <div className="space-y-5">
          {error && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
            >
              <span>Live refresh delayed: {error}</span>
              <button
                type="button"
                onClick={() => {
                  void loadOrder(order.id, true)
                }}
                className="font-semibold underline cursor-pointer"
              >
                Retry now
              </button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Card className="p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <p className="text-xs font-medium text-stone-500">
                    Order ID:{' '}
                    <span className="font-mono font-semibold text-stone-900">
                      {order.id}
                    </span>
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-stone-900">
                    {order.customer_name}
                  </h2>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Placed {formatShortDateTime(order.created_at)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={order.status} />
                  <div className="flex items-center gap-2 text-[11px] text-stone-500">
                    <span>
                      {order.status === 'COLLECTED' || order.status === 'CANCELLED'
                        ? 'Final state reached'
                        : 'Auto-refreshing every 4s'}
                      {lastSyncedAt ? ` · ${lastSyncedAt}` : ''}
                    </span>
                    <button
                      type="button"
                      disabled={isRefreshing}
                      onClick={() => {
                        void loadOrder(order.id, true)
                      }}
                      aria-label="Refresh order status"
                      className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-stone-700 hover:bg-stone-50 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                    Pickup Code
                  </p>
                  <p className="mt-1.5 font-mono text-3xl font-bold tracking-widest text-stone-900">
                    {order.pickup_code}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Show this token at the counter
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
                    Pickup Window
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-stone-900">
                    <Clock className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <span className="text-lg font-semibold">
                      {formatTimeWindow(
                        order.pickup_slot_start,
                        order.pickup_slot_end,
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    Estimated kitchen load: {order.total_prep_units} units
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-stone-900">
                  Preparation Progress
                </h3>
                <OrderTimeline status={order.status} />
              </div>
            </Card>

            <Card className="flex flex-col justify-between overflow-hidden">
              <div>
                <div className="border-b border-stone-100 px-5 py-4">
                  <h3 className="text-base font-semibold text-stone-900">
                    Ordered Items
                  </h3>
                  <p className="text-xs text-stone-500">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                    items in this ticket
                  </p>
                </div>

                <ul className="divide-y divide-stone-100 px-5">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 py-3.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-stone-900">
                          {item.quantity}× {item.item_name}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {formatRupees(item.unit_price)} each ·{' '}
                          {item.prep_minutes * item.quantity}m prep load
                        </p>
                      </div>
                      <span className="font-semibold text-stone-900">
                        {formatRupees(item.unit_price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <div className="mx-5 mb-4 rounded-xl border border-stone-200/80 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-700">
                    <span className="font-semibold text-stone-900">Notes: </span>
                    {order.notes}
                  </div>
                )}
              </div>

              <div className="border-t border-stone-200/80 bg-stone-50/70 px-5 py-4">
                <div className="flex items-center justify-between text-base font-semibold text-stone-900">
                  <span>Total Amount</span>
                  <span>{formatRupees(order.total_amount)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  )
}

