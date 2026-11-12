import { BarChart3, IndianRupee, Receipt, TrendingUp } from 'lucide-react'
import type { ManagerSalesSummary } from '../../types'
import { formatRupees } from '../../utils/format'
import { Card } from '../ui/Card'

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
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={idx} className="h-24 animate-pulse bg-stone-100" />
          ))}
        </div>
        <Card className="h-60 animate-pulse bg-stone-100" />
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
      <div className="rounded-xl border border-stone-200/80 bg-white px-4 py-2.5 text-xs text-stone-600">
        Sales figures count finalized <strong className="text-stone-900">COLLECTED</strong> orders only. Cancelled and in-progress orders are excluded.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Today&apos;s Sales
            </span>
            <IndianRupee className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {formatRupees(sales.today_sales_paise)}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Total Collected Orders
            </span>
            <Receipt className="h-4 w-4 text-stone-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {sales.total_collected_orders}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Average Order Value
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {formatRupees(sales.average_order_value_paise)}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">
              Total Finalized Revenue
            </span>
            <BarChart3 className="h-4 w-4 text-stone-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {formatRupees(sales.total_collected_revenue_paise)}
          </p>
        </Card>
      </div>

      {sales.total_collected_orders === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <BarChart3 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-stone-900">
            No finalized sales recorded yet
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Once kitchen staff mark orders as Collected, daily revenue and top
            items will appear here automatically.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-stone-900">
              Recent 7-Day Sales (IST)
            </h3>
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
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-medium text-stone-700">
                        {day.label}
                      </span>
                      <span className="text-stone-600">
                        {day.order_count}{' '}
                        {day.order_count === 1 ? 'order' : 'orders'} ·{' '}
                        <strong className="text-stone-900">
                          {formatRupees(day.revenue_paise)}
                        </strong>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-stone-900">
              Most Frequently Ordered Items
            </h3>
            <ul className="mt-4 divide-y divide-stone-100">
              {sales.top_items.map((item, index) => (
                <li
                  key={`${item.menu_item_id}-${item.item_name}`}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-700">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-stone-900">
                        {item.item_name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {item.quantity_sold} sold
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-stone-900">
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

