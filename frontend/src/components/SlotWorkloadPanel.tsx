import { Clock } from 'lucide-react'
import type { SlotWorkload } from '../types'
import { formatTimeWindow } from '../utils/format'
import { Card } from './ui/Card'

interface SlotWorkloadPanelProps {
  slots: SlotWorkload[]
  isLoading: boolean
}

export function SlotWorkloadPanel({ slots, isLoading }: SlotWorkloadPanelProps) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-stone-900">
            Pickup Slot Capacity
          </h2>
        </div>
        <p className="text-xs text-stone-500">
          5-minute windows · live kitchen preparation units
        </p>
      </div>

      {isLoading ? (
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl bg-stone-100"
            />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">
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
              ? 'bg-rose-600'
              : ratio >= 75
                ? 'bg-amber-500'
                : 'bg-emerald-600'

            return (
              <div
                key={slot.slot_start}
                className={`rounded-xl border p-3.5 transition-colors ${
                  slot.is_full
                    ? 'border-rose-200 bg-rose-50/40'
                    : slot.active_orders > 0
                      ? 'border-stone-200 bg-stone-50/60'
                      : 'border-stone-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-900">
                    {formatTimeWindow(slot.slot_start, slot.slot_end)}
                  </span>
                  {slot.is_full ? (
                    <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                      Full
                    </span>
                  ) : !slot.is_upcoming && slot.active_orders > 0 ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Past Window
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      {slot.remaining_units} left
                    </span>
                  )}
                </div>

                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-200/80">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-stone-600">
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

