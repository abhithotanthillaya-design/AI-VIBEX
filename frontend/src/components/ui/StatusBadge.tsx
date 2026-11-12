import type { ReactNode } from 'react'
import {
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  Sparkles,
} from 'lucide-react'
import type { OrderStatus } from '../../types'

interface StatusStyle {
  label: string
  classes: string
  icon: ReactNode
}

const ORDER_STATUS_STYLES: Record<OrderStatus, StatusStyle> = {
  PLACED: {
    label: 'Placed',
    classes: 'bg-stone-100 text-stone-800 border-stone-200',
    icon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  ACCEPTED: {
    label: 'Accepted',
    classes: 'bg-sky-50 text-sky-800 border-sky-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  PREPARING: {
    label: 'Preparing',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: <ChefHat className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  READY: {
    label: 'Ready for Pickup',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  COLLECTED: {
    label: 'Collected',
    classes: 'bg-stone-100 text-stone-600 border-stone-200',
    icon: <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />,
  },
}

interface StatusBadgeProps {
  status: OrderStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = ORDER_STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.classes}`}
    >
      {style.icon}
      <span>{style.label}</span>
    </span>
  )
}

