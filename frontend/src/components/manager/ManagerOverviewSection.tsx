import {
  CheckCircle2,
  Clock,
  Flame,
  IndianRupee,
  Package,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react'
import type { ManagerDashboard } from '../../types'
import { formatRupees, formatTimeWindow } from '../../utils/format'
import { Card } from '../ui/Card'

interface ManagerOverviewSectionProps {
  dashboard: ManagerDashboard | null
  isLoading: boolean
}

export function ManagerOverviewSection({
  dashboard,
  isLoading,
}: ManagerOverviewSectionProps) {
  if (isLoading && !dashboard) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="h-28 animate-pulse bg-stone-100" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-36 animate-pulse bg-stone-100" />
          <Card className="h-36 animate-pulse bg-stone-100" />
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return null
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Today&apos;s Total Sales
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <IndianRupee className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            {formatRupees(dashboard.today_sales_paise)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Collected orders on {dashboard.today_date} (IST)
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Orders Today
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            {dashboard.today_orders}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {dashboard.active_orders} active · {dashboard.completed_orders}{' '}
            collected
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Active vs Completed
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Package className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            {dashboard.active_orders} active
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {dashboard.completed_orders} collected · {dashboard.cancelled_orders}{' '}
            cancelled
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Menu Catalog Status
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            {dashboard.available_menu_items} / {dashboard.total_menu_items}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Available · {dashboard.unavailable_menu_items} sold out
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-stone-900">
                Current Pickup Slot Workload
              </h2>
            </div>
            {dashboard.current_slot && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                  dashboard.current_slot.is_closed
                    ? 'border-stone-300 bg-stone-200 text-stone-800'
                    : dashboard.current_slot.is_full
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {dashboard.current_slot.is_closed
                  ? 'Closed'
                  : dashboard.current_slot.is_full
                    ? 'Full'
                    : `${dashboard.current_slot.remaining_units} units open`}
              </span>
            )}
          </div>

          {dashboard.current_slot ? (
            <div className="mt-4 space-y-2">
              <p className="text-lg font-semibold text-stone-900">
                {formatTimeWindow(
                  dashboard.current_slot.slot_start,
                  dashboard.current_slot.slot_end,
                )}
              </p>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className={`h-full rounded-full ${
                    dashboard.current_slot.is_full
                      ? 'bg-rose-600'
                      : 'bg-emerald-600'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (dashboard.current_slot.used_units /
                          Math.max(1, dashboard.current_slot.capacity_units)) *
                          100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-stone-600">
                {dashboard.current_slot.used_units} /{' '}
                {dashboard.current_slot.capacity_units} prep units ·{' '}
                {dashboard.current_slot.active_orders} active orders
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">
              No active slot data available.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-stone-900">
                Busiest Pickup Slot
              </h2>
            </div>
            {dashboard.busiest_slot && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                <span>Peak Load</span>
              </span>
            )}
          </div>

          {dashboard.busiest_slot ? (
            <div className="mt-4 space-y-2">
              <p className="text-lg font-semibold text-stone-900">
                {formatTimeWindow(
                  dashboard.busiest_slot.slot_start,
                  dashboard.busiest_slot.slot_end,
                )}
              </p>
              <p className="text-sm text-stone-700">
                <span className="font-semibold text-stone-900">
                  {dashboard.busiest_slot.used_units}
                </span>{' '}
                / {dashboard.busiest_slot.capacity_units} prep units occupied
              </p>
              <p className="text-xs text-stone-500">
                {dashboard.busiest_slot.active_orders} active orders queued in
                this window
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-stone-200/70 bg-stone-50 p-3.5 text-xs text-stone-600">
              No active pickup slot demand yet. As students place pre-orders, the
              busiest 5-minute window will highlight here.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

