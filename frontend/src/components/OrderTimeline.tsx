import {
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { OrderStatus } from '../types'

interface TimelineStep {
  status: Exclude<OrderStatus, 'CANCELLED'>
  title: string
  description: string
  icon: ReactNode
}

const STEPS: TimelineStep[] = [
  {
    status: 'PLACED',
    title: 'Order Placed',
    description: 'Pre-order logged and pickup window assigned.',
    icon: <Clock className="h-4 w-4" aria-hidden="true" />,
  },
  {
    status: 'ACCEPTED',
    title: 'Accepted by Kitchen',
    description: 'Canteen staff acknowledged your ticket.',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  },
  {
    status: 'PREPARING',
    title: 'Preparing',
    description: 'Your dishes are being freshly prepared.',
    icon: <ChefHat className="h-4 w-4" aria-hidden="true" />,
  },
  {
    status: 'READY',
    title: 'Ready for Pickup',
    description: 'Head to the counter with your QR or pickup code.',
    icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
  },
  {
    status: 'COLLECTED',
    title: 'Collected',
    description: 'Order picked up. Enjoy your meal!',
    icon: <PackageCheck className="h-4 w-4" aria-hidden="true" />,
  },
]

interface OrderTimelineProps {
  status: OrderStatus
}

export function OrderTimeline({ status }: OrderTimelineProps) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-[#E7BDBD] bg-[#FBEDED] p-4 text-[#842323]">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Order Cancelled</p>
          <p className="mt-0.5 text-xs">
            This order was cancelled and its pickup-slot capacity has been
            released.
          </p>
        </div>
      </div>
    )
  }

  const activeIndex = STEPS.findIndex((step) => step.status === status)

  return (
    <ol className="space-y-3" aria-label="Order progress timeline">
      {STEPS.map((step, index) => {
        const isCompleted = index < activeIndex || status === 'COLLECTED'
        const isCurrent = index === activeIndex && status !== 'COLLECTED'

        return (
          <li key={step.status} className="relative flex items-start gap-3.5">
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-4 top-8 h-[calc(100%-0.5rem)] w-0.5 ${
                  index < activeIndex ? 'bg-[#1A4D38]' : 'bg-[#D8D0C1]'
                }`}
              />
            )}

            <div
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                isCompleted
                  ? 'border-[#1A4D38] bg-[#1A4D38] text-[#FCFBF8]'
                  : isCurrent
                    ? 'border-[#1A4D38] bg-[#E3EFE8] text-[#1A4D38] ring-4 ring-[#E3EFE8]'
                    : 'border-[#D8D0C1] bg-[#FCFBF8] text-[#8E867B]'
              }`}
            >
              {step.icon}
            </div>

            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-semibold ${
                    isCompleted || isCurrent ? 'text-[#1E1D1A]' : 'text-[#787166]'
                  }`}
                >
                  {step.title}
                </p>
                {isCurrent && (
                  <span className="rounded-full bg-[#E3EFE8] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#143B2B]">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[#5B564D]">{step.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
