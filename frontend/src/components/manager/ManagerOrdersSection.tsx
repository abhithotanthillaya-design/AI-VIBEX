import { useEffect, useState } from 'react'
import { ArrowRight, Calendar, Eye, Search, Ticket, X } from 'lucide-react'
import type { OrderDetail, OrderStatus } from '../../types'
import {
  formatRupees,
  formatShortDateTime,
  formatTimeWindow,
} from '../../utils/format'
import { NEXT_KITCHEN_ACTION } from '../../utils/kitchen'
import { OrderTimeline } from '../OrderTimeline'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { StatusBadge } from '../ui/StatusBadge'

interface ManagerOrdersSectionProps {
  orders: OrderDetail[]
  isLoading: boolean
  statusFilter: string
  dateFilter: string
  searchQuery: string
  updatingOrderId: string | null
  onStatusFilterChange: (value: string) => void
  onDateFilterChange: (value: string) => void
  onSearchQueryChange: (value: string) => void
  onResetFilters: () => void
  onAdvanceOrderStatus: (order: OrderDetail, nextStatus: OrderStatus) => Promise<void>
}

const QUICK_STATUS_FILTERS = [
  { value: 'all', label: 'All Orders' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SPECIFIC_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any Status' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'COLLECTED', label: 'Collected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function ManagerOrdersSection({
  orders,
  isLoading,
  statusFilter,
  dateFilter,
  searchQuery,
  updatingOrderId,
  onStatusFilterChange,
  onDateFilterChange,
  onSearchQueryChange,
  onResetFilters,
  onAdvanceOrderStatus,
}: ManagerOrdersSectionProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null

  useEffect(() => {
    if (!selectedOrder) return
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedOrderId(null)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [selectedOrder])

  const selectedNextAction = selectedOrder
    ? NEXT_KITCHEN_ACTION[selectedOrder.status]
    : undefined

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_STATUS_FILTERS.map((opt) => {
            const active = statusFilter.toLowerCase() === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusFilterChange(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search order ID, code, or student..."
              aria-label="Search orders"
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="relative flex items-center gap-2">
            <Calendar
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => onDateFilterChange(event.target.value)}
              aria-label="Filter orders by creation date"
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => onDateFilterChange('')}
                aria-label="Clear date filter"
                className="rounded-lg border border-stone-200 px-2.5 py-2 text-xs text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <select
            value={
              SPECIFIC_STATUS_OPTIONS.some((o) => o.value === statusFilter)
                ? statusFilter
                : 'all'
            }
            onChange={(event) => onStatusFilterChange(event.target.value)}
            aria-label="Filter by exact order status"
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-emerald-600 focus:outline-none"
          >
            {SPECIFIC_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {isLoading && orders.length === 0 ? (
        <Card className="space-y-3 p-5" aria-busy="true">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-14 animate-pulse rounded-xl bg-stone-100" />
          ))}
        </Card>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Ticket className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-stone-900">
            No orders match your filters
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Clear your search, date, or status filter to inspect all orders.
          </p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onResetFilters}>
              Reset Filters
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50/80 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Pickup Slot</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-stone-50/60">
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                          {order.pickup_code}
                        </span>
                        <p className="mt-1 font-mono text-[11px] text-stone-500">
                          {order.id}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900">
                        {order.customer_name}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-700">
                        {order.items
                          .map((i) => `${i.quantity}× ${i.item_name}`)
                          .join(', ')}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-stone-800">
                        {formatTimeWindow(
                          order.pickup_slot_start,
                          order.pickup_slot_end,
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        {formatRupees(order.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {formatShortDateTime(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedOrderId(order.id)}
                          icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-3 lg:hidden">
            {orders.map((order) => (
              <Card key={order.id} className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                        {order.pickup_code}
                      </span>
                      <span className="font-semibold text-stone-900">
                        {order.customer_name}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-stone-500">
                      {order.id} · {formatShortDateTime(order.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <p className="text-xs text-stone-700">
                  {order.items
                    .map((i) => `${i.quantity}× ${i.item_name}`)
                    .join(', ')}
                </p>

                <div className="flex items-center justify-between border-t border-stone-100 pt-2.5">
                  <div className="text-xs text-stone-600">
                    <span className="font-semibold text-stone-900">
                      {formatRupees(order.total_amount)}
                    </span>{' '}
                    ·{' '}
                    {formatTimeWindow(
                      order.pickup_slot_start,
                      order.pickup_slot_end,
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedOrderId(order.id)}
                    icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manager-order-detail-title"
          onClick={() => setSelectedOrderId(null)}
        >
          <Card
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-stone-900 px-2.5 py-1 font-mono text-sm font-bold text-white">
                    {selectedOrder.pickup_code}
                  </span>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <h2
                  id="manager-order-detail-title"
                  className="mt-2 text-lg font-semibold text-stone-900"
                >
                  {selectedOrder.customer_name}
                </h2>
                <p className="text-xs text-stone-500">
                  <span className="font-mono">{selectedOrder.id}</span> · Placed{' '}
                  {formatShortDateTime(selectedOrder.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                aria-label="Close order details"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div className="grid gap-3 rounded-xl border border-stone-200/80 bg-stone-50/70 p-3.5 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-stone-500">Pickup Window</span>
                  <p className="mt-0.5 font-semibold text-stone-900">
                    {formatTimeWindow(
                      selectedOrder.pickup_slot_start,
                      selectedOrder.pickup_slot_end,
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500">Total &amp; Workload</span>
                  <p className="mt-0.5 font-semibold text-stone-900">
                    {formatRupees(selectedOrder.total_amount)} ·{' '}
                    {selectedOrder.total_prep_units} prep units
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Item Snapshots
                </h3>
                <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200/80 px-4">
                  {selectedOrder.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between py-2.5 text-sm"
                    >
                      <span>
                        <span className="font-semibold text-stone-900">
                          {item.quantity}×
                        </span>{' '}
                        {item.item_name}{' '}
                        <span className="text-xs text-stone-500">
                          ({formatRupees(item.unit_price)} each)
                        </span>
                      </span>
                      <span className="font-semibold text-stone-900">
                        {formatRupees(item.unit_price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedOrder.notes && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950">
                  <span className="font-semibold">Notes: </span>
                  {selectedOrder.notes}
                </div>
              )}

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Order Timeline
                </h3>
                <OrderTimeline status={selectedOrder.status} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
                {selectedNextAction ? (
                  <Button
                    variant="primary"
                    size="md"
                    loading={updatingOrderId === selectedOrder.id}
                    disabled={updatingOrderId === selectedOrder.id}
                    onClick={() => {
                      void onAdvanceOrderStatus(
                        selectedOrder,
                        selectedNextAction.nextStatus,
                      )
                    }}
                    icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  >
                    {selectedNextAction.label}
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-stone-500">
                    Order is in final status ({selectedOrder.status})
                  </span>
                )}

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedOrderId(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

