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
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'

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
            <Skeleton key={idx} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
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
            <span className="text-xs font-medium text-[#5B564D]">
              Today&apos;s Total Sales
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
              <IndianRupee className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1E1D1A] tabular-nums">
            {formatRupees(dashboard.today_sales_paise)}
          </p>
          <p className="mt-1 text-xs text-[#787166]">
            Collected orders on {dashboard.today_date} (IST)
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5B564D]">
              Orders Today
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFEAE0] text-[#3F3B34]">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1E1D1A] tabular-nums">
            {dashboard.today_orders}
          </p>
          <p className="mt-1 text-xs text-[#787166] tabular-nums">
            {dashboard.active_orders} active · {dashboard.completed_orders}{' '}
            collected
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5B564D]">
              Active vs Completed
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FBF4E4] text-[#7D5214]">
              <Package className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1E1D1A] tabular-nums">
            {dashboard.active_orders} active
          </p>
          <p className="mt-1 text-xs text-[#787166] tabular-nums">
            {dashboard.completed_orders} collected · {dashboard.cancelled_orders}{' '}
            cancelled
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5B564D]">
              Menu Catalog Status
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
              <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1E1D1A] tabular-nums">
            {dashboard.available_menu_items} / {dashboard.total_menu_items}
          </p>
          <p className="mt-1 text-xs text-[#787166] tabular-nums">
            Available · {dashboard.unavailable_menu_items} sold out
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#1A4D38]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#1E1D1A]">
                Current Pickup Slot Workload
              </h2>
            </div>
            {dashboard.current_slot && (
              <Badge
                tone={
                  dashboard.current_slot.is_closed
                    ? 'neutral'
                    : dashboard.current_slot.is_full
                      ? 'danger'
                      : 'forest'
                }
                className="tabular-nums"
              >
                {dashboard.current_slot.is_closed
                  ? 'Closed'
                  : dashboard.current_slot.is_full
                    ? 'Full'
                    : `${dashboard.current_slot.remaining_units} units open`}
              </Badge>
            )}
          </div>

          {dashboard.current_slot ? (
            <div className="mt-4 space-y-2.5">
              <p className="text-lg font-semibold text-[#1E1D1A] tabular-nums">
                {formatTimeWindow(
                  dashboard.current_slot.slot_start,
                  dashboard.current_slot.slot_end,
                )}
              </p>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E4DED2]">
                <div
                  className={`h-full rounded-full ${
                    dashboard.current_slot.is_full
                      ? 'bg-[#9F2D2D]'
                      : 'bg-[#1A4D38]'
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
              <p className="text-xs text-[#5B564D] tabular-nums">
                {dashboard.current_slot.used_units} /{' '}
                {dashboard.current_slot.capacity_units} prep units ·{' '}
                {dashboard.current_slot.active_orders} active orders
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#5B564D]">
              No active slot data available.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#C25E3A]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#1E1D1A]">
                Busiest Pickup Slot
              </h2>
            </div>
            {dashboard.busiest_slot && (
              <Badge
                tone="saffron"
                icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
              >
                Peak Load
              </Badge>
            )}
          </div>

          {dashboard.busiest_slot ? (
            <div className="mt-4 space-y-2">
              <p className="text-lg font-semibold text-[#1E1D1A] tabular-nums">
                {formatTimeWindow(
                  dashboard.busiest_slot.slot_start,
                  dashboard.busiest_slot.slot_end,
                )}
              </p>
              <p className="text-sm text-[#5B564D] tabular-nums">
                <span className="font-semibold text-[#1E1D1A]">
                  {dashboard.busiest_slot.used_units}
                </span>{' '}
                / {dashboard.busiest_slot.capacity_units} prep units occupied
              </p>
              <p className="text-xs text-[#787166] tabular-nums">
                {dashboard.busiest_slot.active_orders} active orders queued in
                this window
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[#E4DED2] bg-[#F7F4ED] p-3.5 text-xs text-[#5B564D]">
              No active pickup slot demand yet. As students place pre-orders, the
              busiest 5-minute window will highlight here.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
