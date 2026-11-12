import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  History,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { ApiClientError, fetchOrder } from '../api/client'
import type { OrderDetail } from '../types'
import {
  formatRupees,
  formatShortDateTime,
  formatTimeWindow,
} from '../utils/format'
import { getPaymentStatusMeta } from '../utils/phase10'
import {
  readStoredOrderHistory,
  readStoredPickupToken,
  recordStoredOrderHistory,
  removeStoredOrderHistory,
} from '../utils/storage'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

interface StudentOrderHistoryProps {
  onBackToMenu: () => void
  onOpenTracking: (orderId: string) => void
}

interface HistoryEntry {
  orderId: string
  order: OrderDetail | null
  error: string | null
  hasQrToken: boolean
}

export function StudentOrderHistory({
  onBackToMenu,
  onOpenTracking,
}: StudentOrderHistoryProps) {
  const [storedIds, setStoredIds] = useState<string[]>(() =>
    readStoredOrderHistory(),
  )
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(storedIds.length > 0)
  const [lookupInput, setLookupInput] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const syncHistoryOrders = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setEntries([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const results = await Promise.all(
      ids.map(async (orderId): Promise<HistoryEntry> => {
        try {
          const order = await fetchOrder(orderId)
          return {
            orderId,
            order,
            error: null,
            hasQrToken: Boolean(readStoredPickupToken(orderId)),
          }
        } catch (err) {
          const message =
            err instanceof ApiClientError && err.statusCode === 404
              ? 'Order no longer exists on the server (e.g. cleared during demo reset).'
              : err instanceof ApiClientError
                ? err.message
                : 'Unable to sync order status.'
          return {
            orderId,
            order: null,
            error: message,
            hasQrToken: Boolean(readStoredPickupToken(orderId)),
          }
        }
      }),
    )
    setEntries(results)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    if (storedIds.length === 0) {
      return
    }
    Promise.all(
      storedIds.map(async (orderId): Promise<HistoryEntry> => {
        try {
          const order = await fetchOrder(orderId)
          return {
            orderId,
            order,
            error: null,
            hasQrToken: Boolean(readStoredPickupToken(orderId)),
          }
        } catch (err) {
          const message =
            err instanceof ApiClientError && err.statusCode === 404
              ? 'Order no longer exists on the server (e.g. cleared during demo reset).'
              : err instanceof ApiClientError
                ? err.message
                : 'Unable to sync order status.'
          return {
            orderId,
            order: null,
            error: message,
            hasQrToken: Boolean(readStoredPickupToken(orderId)),
          }
        }
      }),
    )
      .then((results) => {
        if (!active) return
        setEntries(results)
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [storedIds])

  const handleManualLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleaned = lookupInput.trim()
    if (!cleaned || isLookingUp) return
    setLookupError(null)
    setIsLookingUp(true)
    try {
      await fetchOrder(cleaned)
      const nextIds = recordStoredOrderHistory(cleaned)
      setStoredIds(nextIds)
      setLookupInput('')
      await syncHistoryOrders(nextIds)
    } catch (err) {
      setLookupError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to look up this Order ID right now.',
      )
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleRemoveEntry = (orderId: string) => {
    const nextIds = removeStoredOrderHistory(orderId)
    setStoredIds(nextIds)
    setEntries((prev) => prev.filter((e) => e.orderId !== orderId))
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
            Your Order History
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Reopen tracking or pickup codes for orders placed or looked up in this
            browser.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={isLoading}
          disabled={storedIds.length === 0}
          onClick={() => {
            void syncHistoryOrders(storedIds)
          }}
          icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          Refresh History
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <p className="text-xs leading-relaxed text-stone-600">
          <strong className="text-stone-900">Demo Privacy Note:</strong> This
          prototype does not use student accounts; order references are stored
          locally in your browser and verified individually from the backend. Enter
          any Order ID to fetch and bookmark its status.
        </p>

        <form
          onSubmit={(event) => {
            void handleManualLookup(event)
          }}
          className="flex flex-col gap-2 sm:flex-row"
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
              placeholder="Look up Order ID (e.g. ord_a1b2c3d4e5)"
              aria-label="Look up Order ID for history"
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm font-mono text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isLookingUp}
            disabled={!lookupInput.trim() || isLookingUp}
          >
            Find Order
          </Button>
        </form>

        {lookupError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{lookupError}</span>
          </div>
        )}
      </Card>

      {isLoading && entries.length === 0 ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 2 }).map((_, idx) => (
            <Card key={idx} className="h-32 animate-pulse bg-stone-100" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <History className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-stone-900">
            No saved orders in this browser yet
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Place a canteen pre-order or enter an Order ID above to view live order
            history.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="md" onClick={onBackToMenu}>
              Browse Canteen Menu
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            if (!entry.order) {
              return (
                <Card
                  key={entry.orderId}
                  className="flex flex-col gap-3 border-amber-200 bg-amber-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-stone-800">
                      {entry.orderId}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-900">
                      {entry.error ?? 'Order unavailable'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(entry.orderId)}
                    aria-label={`Remove ${entry.orderId} from browser history`}
                    className="inline-flex items-center gap-1 self-start rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Remove</span>
                  </button>
                </Card>
              )
            }

            const order = entry.order
            const paymentMeta = getPaymentStatusMeta(
              order.payment_status,
              order.payment_method,
            )

            return (
              <Card key={order.id} className="p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-stone-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                        Code: {order.pickup_code}
                      </span>
                      <span className="font-mono text-xs text-stone-500">
                        {order.id}
                      </span>
                      {entry.hasQrToken && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          <QrCode className="h-3 w-3" aria-hidden="true" />
                          <span>QR Saved</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-stone-900">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-stone-500">
                      Ordered {formatShortDateTime(order.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={order.status} />
                    <span className="text-[11px] font-medium text-stone-600">
                      {paymentMeta.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200/80 bg-stone-50/70 px-3 py-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-stone-800">
                    <Clock className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    <span>
                      Pickup Window:{' '}
                      {formatTimeWindow(
                        order.pickup_slot_start,
                        order.pickup_slot_end,
                      )}
                    </span>
                  </span>
                  <span className="font-semibold text-stone-900">
                    Total: {formatRupees(order.total_amount)}
                  </span>
                </div>

                <ul className="space-y-1 text-sm text-stone-700">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        <strong className="text-stone-900">{item.quantity}×</strong>{' '}
                        {item.item_name}
                      </span>
                      <span className="text-xs text-stone-500">
                        {formatRupees(item.unit_price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs text-amber-950">
                    <strong>Special Instructions:</strong> {order.notes}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(order.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Remove from browser history</span>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => onOpenTracking(order.id)}
                    icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    Open Live Tracking &amp; QR
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}

