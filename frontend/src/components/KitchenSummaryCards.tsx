import { CheckCircle2, ChefHat, Clock, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { OrderStatus } from '../types'
import type { KitchenSummaryCounts } from '../utils/kitchen'

export type KitchenQueueFilter = 'ACTIVE' | OrderStatus

interface SummaryCardConfig {
  filter: OrderStatus
  label: string
  count: number
  icon: ReactNode
  iconBg: string
  activeRing: string
}

interface KitchenSummaryCardsProps {
  summary: KitchenSummaryCounts
  selectedFilter: KitchenQueueFilter
  onSelectFilter: (filter: KitchenQueueFilter) => void
}

export function KitchenSummaryCards({
  summary,
  selectedFilter,
  onSelectFilter,
}: KitchenSummaryCardsProps) {
  const cards: SummaryCardConfig[] = [
    {
      filter: 'PLACED',
      label: 'New Orders',
      count: summary.placed,
      icon: <Clock className="h-4 w-4" aria-hidden="true" />,
      iconBg: 'bg-stone-100 text-stone-700',
      activeRing: 'border-stone-400 ring-2 ring-stone-200',
    },
    {
      filter: 'ACCEPTED',
      label: 'Accepted',
      count: summary.accepted,
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
      iconBg: 'bg-sky-50 text-sky-700',
      activeRing: 'border-sky-400 ring-2 ring-sky-100',
    },
    {
      filter: 'PREPARING',
      label: 'Preparing',
      count: summary.preparing,
      icon: <ChefHat className="h-4 w-4" aria-hidden="true" />,
      iconBg: 'bg-amber-50 text-amber-700',
      activeRing: 'border-amber-400 ring-2 ring-amber-100',
    },
    {
      filter: 'READY',
      label: 'Ready',
      count: summary.ready,
      icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
      iconBg: 'bg-emerald-50 text-emerald-700',
      activeRing: 'border-emerald-500 ring-2 ring-emerald-100',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const isSelected = selectedFilter === card.filter
        return (
          <button
            key={card.filter}
            type="button"
            onClick={() =>
              onSelectFilter(isSelected ? 'ACTIVE' : card.filter)
            }
            aria-pressed={isSelected}
            className={`rounded-2xl border bg-white p-4 text-left shadow-xs transition-all hover:border-stone-300 cursor-pointer ${
              isSelected ? card.activeRing : 'border-stone-200/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-stone-600">
                {card.label}
              </span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                {card.icon}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
              {card.count}
            </p>
          </button>
        )
      })}
    </div>
  )
}

