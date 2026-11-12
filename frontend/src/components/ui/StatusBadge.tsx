import type { ReactNode } from 'react'
import {
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  Sparkles,
  XCircle,
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
    classes: 'border-[#D8D0C1] bg-[#EFEAE0]/80 text-[#3F3B34]',
    icon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  ACCEPTED: {
    label: 'Accepted',
    classes: 'border-[#C2D6E8] bg-[#ECF4FA] text-[#1D4B73]',
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  PREPARING: {
    label: 'Preparing',
    classes: 'border-[#E7D4AF] bg-[#FBF4E4] text-[#7D5214]',
    icon: <ChefHat className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  READY: {
    label: 'Ready for Pickup',
    classes: 'border-[#BDD6C7] bg-[#E3EFE8] text-[#143B2B]',
    icon: <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  COLLECTED: {
    label: 'Collected',
    classes: 'border-[#D8D0C1] bg-[#EFEAE0]/60 text-[#5B564D]',
    icon: <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'border-[#E7BDBD] bg-[#FBEDED] text-[#842323]',
    icon: <XCircle className="h-3.5 w-3.5" aria-hidden="true" />,
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
