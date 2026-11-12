import { Clock } from 'lucide-react'
import type { SlotWorkload } from '../types'
import { formatTimeWindow } from '../utils/format'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'
import { Skeleton } from './ui/Skeleton'

interface SlotWorkloadPanelProps {
  slots: SlotWorkload[]
  isLoading: boolean
}

export function SlotWorkloadPanel({ slots, isLoading }: SlotWorkloadPanelProps) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#1A4D38]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[#1E1D1A]">
            Pickup Slot Capacity
          </h2>
        </div>
        <p className="text-xs text-[#5B564D]">
          5-minute windows · live kitchen preparation units
        </p>
      </div>

      {isLoading ? (
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <p className="mt-3 text-sm text-[#5B564D]">
          No upcoming pickup slots available.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => {
            const ratio =
              slot.capacity_units > 0
                ? Math.min(100, Math.round((slot.used_units / slot.capacity_units) * 100))
                : 0
            const barColor = slot.is_full
              ? 'bg-[#9F2D2D]'
              : ratio >= 75
                ? 'bg-[#A87122]'
                : 'bg-[#1A4D38]'

            return (
              <div
                key={slot.slot_start}
                className={`rounded-xl border p-3.5 transition-colors ${
                  slot.is_full
                    ? 'border-[#E7BDBD] bg-[#FBEDED]/55'
                    : slot.active_orders > 0
                      ? 'border-[#D8D0C1] bg-[#F7F4ED]'
                      : 'border-[#E4DED2] bg-[#FCFBF8]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#1E1D1A] tabular-nums">
                    {formatTimeWindow(slot.slot_start, slot.slot_end)}
                  </span>
                  {slot.is_closed ? (
                    <Badge tone="neutral">Closed</Badge>
                  ) : slot.is_full ? (
                    <Badge tone="danger">Full</Badge>
                  ) : !slot.is_upcoming && slot.active_orders > 0 ? (
                    <Badge tone="saffron">Past Window</Badge>
                  ) : (
                    <Badge tone="forest" className="tabular-nums">
                      {slot.remaining_units} left
                    </Badge>
                  )}
                </div>

                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E4DED2]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-[#5B564D] tabular-nums">
                  <span>
                    {slot.used_units} / {slot.capacity_units} units
                  </span>
                  <span>
                    {slot.active_orders}{' '}
                    {slot.active_orders === 1 ? 'order' : 'orders'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
