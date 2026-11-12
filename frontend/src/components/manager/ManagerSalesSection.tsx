import { BarChart3, IndianRupee, Receipt, TrendingUp } from 'lucide-react'
import type { ManagerSalesSummary } from '../../types'
import { formatRupees } from '../../utils/format'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/States'

interface ManagerSalesSectionProps {
  sales: ManagerSalesSummary | null
  isLoading: boolean
}

export function ManagerSalesSection({
  sales,
  isLoading,
}: ManagerSalesSectionProps) {
  if (isLoading && !sales) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-60" />
      </div>
    )
  }

  if (!sales) {
    return null
  }

  const maxDayRevenue = Math.max(
    1,
    ...sales.daily_sales.map((day) => day.revenue_paise),
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#E4DED2] bg-[#FCFBF8] px-4 py-2.5 text-xs text-[#5B564D]">
        Sales figures count finalized{' '}
        <strong className="text-[#1E1D1A]">COLLECTED</strong> orders only.
        Cancelled and in-progress orders are excluded.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5B564D]">
              Today&apos;s Sales
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
              <IndianRupee className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[#1E1D1A] tabular-nums">
            {formatRupees(sales.today_sales_paise)}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5B564D]">
              Total Collected Orders
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFEAE0] text-[#3F3B34]">
              <Receipt className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[#1E1D1A] tabular-nums">
            {sales.total_collected_orders}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5B564D]">
              Average Order Value
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[#1E1D1A] tabular-nums">
            {formatRupees(sales.average_order_value_paise)}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5B564D]">
              Total Finalized Revenue
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F9ECE6] text-[#C25E3A]">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-[#1E1D1A] tabular-nums">
            {formatRupees(sales.total_collected_revenue_paise)}
          </p>
        </Card>
      </div>

      {sales.total_collected_orders === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
          title="No finalized sales recorded yet"
          description="Once kitchen staff mark orders as Collected, daily revenue trends and top items will appear here automatically."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#1E1D1A]">
                Recent 7-Day Sales (IST)
              </h3>
              <span className="text-[11px] font-medium text-[#787166]">
                Revenue distribution
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {sales.daily_sales.map((day) => {
                const widthPct =
                  day.revenue_paise > 0
                    ? Math.max(
                        6,
                        Math.round((day.revenue_paise / maxDayRevenue) * 100),
                      )
                    : 0
                return (
                  <div key={day.date} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs tabular-nums">
                      <span className="font-medium text-[#3F3B34]">
                        {day.label}
                      </span>
                      <span className="text-[#5B564D]">
                        {day.order_count}{' '}
                        {day.order_count === 1 ? 'order' : 'orders'} ·{' '}
                        <strong className="text-[#1E1D1A]">
                          {formatRupees(day.revenue_paise)}
                        </strong>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#EFEAE0]">
                      <div
                        className="h-full rounded-full bg-[#1A4D38] transition-all duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-[#1E1D1A]">
              Most Frequently Ordered Items
            </h3>
            <ul className="mt-4 divide-y divide-[#E4DED2]">
              {sales.top_items.map((item, index) => (
                <li
                  key={`${item.menu_item_id}-${item.item_name}`}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E3EFE8] text-xs font-semibold text-[#143B2B] tabular-nums">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-[#1E1D1A]">
                        {item.item_name}
                      </p>
                      <p className="text-xs text-[#5B564D] tabular-nums">
                        {item.quantity_sold} sold
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-[#1E1D1A] tabular-nums">
                    {formatRupees(item.revenue_paise)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}
