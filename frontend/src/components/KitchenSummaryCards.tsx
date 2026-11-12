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
      iconBg: 'bg-[#EFEAE0] text-[#3F3B34]',
      activeRing: 'border-[#787166] ring-2 ring-[#E4DED2]',
    },
    {
      filter: 'ACCEPTED',
      label: 'Accepted',
      count: summary.accepted,
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
      iconBg: 'bg-[#ECF4FA] text-[#1D4B73]',
      activeRing: 'border-[#5D8CB8] ring-2 ring-[#DCEAF5]',
    },
    {
      filter: 'PREPARING',
      label: 'Preparing',
      count: summary.preparing,
      icon: <ChefHat className="h-4 w-4" aria-hidden="true" />,
      iconBg: 'bg-[#FBF4E4] text-[#7D5214]',
      activeRing: 'border-[#A87122] ring-2 ring-[#F5E7C8]',
    },
    {
      filter: 'READY',
      label: 'Ready',
      count: summary.ready,
      icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
      iconBg: 'bg-[#E3EFE8] text-[#143B2B]',
      activeRing: 'border-[#1A4D38] ring-2 ring-[#D0E4D8]',
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
            className={`rounded-2xl border bg-[#FCFBF8] p-4 text-left shadow-xs transition-all hover:border-[#C7BFA9] cursor-pointer ${
              isSelected ? card.activeRing : 'border-[#E4DED2]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#5B564D]">
                {card.label}
              </span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                {card.icon}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1E1D1A] tabular-nums">
              {card.count}
            </p>
          </button>
        )
      })}
    </div>
  )
}
