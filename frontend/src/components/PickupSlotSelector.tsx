import {
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  RefreshCw,
  X,
} from 'lucide-react'
import type { AvailablePickupSlot } from '../types'
import { formatTimeWindow } from '../utils/format'
import {
  getSlotAvailabilityBadge,
  type SlotBadgeTone,
} from '../utils/slots'

interface PickupSlotSelectorProps {
  slots: AvailablePickupSlot[]
  recommendedSlotStart: string | null
  orderWorkloadUnits: number
  effectiveSlotStart: string | null
  selectedSlot: AvailablePickupSlot | null
  isUsingDefaultEarliest: boolean
  unavailableWarning: string | null
  slotNotice: string | null
  onClearSlotNotice?: () => void
  isLoading: boolean
  loadError: string | null
  isSubmitting: boolean
  onSelectSlot: (slotStart: string) => void
  onUseEarliest: () => void
  onRefresh: () => void
}

const BADGE_STYLES: Record<SlotBadgeTone, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  rose: 'border-rose-200 bg-rose-100 text-rose-800',
  stone: 'border-stone-300 bg-stone-200/80 text-stone-700',
}

export function PickupSlotSelector({
  slots,
  recommendedSlotStart,
  orderWorkloadUnits,
  effectiveSlotStart,
  selectedSlot,
  isUsingDefaultEarliest,
  unavailableWarning,
  slotNotice,
  onClearSlotNotice,
  isLoading,
  loadError,
  isSubmitting,
  onSelectSlot,
  onUseEarliest,
  onRefresh,
}: PickupSlotSelectorProps) {
  return (
    <div className="space-y-2.5 border-t border-stone-200/80 pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
          <span className="text-xs font-semibold text-stone-800">
            Pickup Window (IST)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isUsingDefaultEarliest && recommendedSlotStart && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onUseEarliest}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
            >
              Earliest open
            </button>
          )}
          <button
            type="button"
            disabled={isLoading || isSubmitting}
            onClick={onRefresh}
            aria-label="Refresh available pickup slots"
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {selectedSlot && effectiveSlotStart && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-emerald-950">
              {formatTimeWindow(selectedSlot.slot_start, selectedSlot.slot_end)}
            </p>
            <p className="text-[11px] text-emerald-800">
              {isUsingDefaultEarliest
                ? 'Default earliest open slot'
                : 'Selected pickup window'}{' '}
              · {selectedSlot.remaining_units} / {selectedSlot.capacity_units}{' '}
              units free
            </p>
          </div>
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
            <Check className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
      )}

      {unavailableWarning && (
        <div
          role="alert"
          className="space-y-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700"
              aria-hidden="true"
            />
            <p className="leading-relaxed">{unavailableWarning}</p>
          </div>
          {recommendedSlotStart && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onUseEarliest}
              className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100/60 cursor-pointer"
            >
              Switch to Earliest Open Slot
            </button>
          )}
        </div>
      )}

      {slotNotice && !unavailableWarning && (
        <div
          role="status"
          className="flex items-start justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-[11px] leading-relaxed text-sky-950"
        >
          <span>{slotNotice}</span>
          {onClearSlotNotice && (
            <button
              type="button"
              onClick={onClearSlotNotice}
              aria-label="Dismiss pickup slot note"
              className="mt-0.5 shrink-0 text-sky-700 hover:text-sky-950 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {isLoading && slots.length === 0 ? (
        <div className="space-y-1.5" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-11 animate-pulse rounded-xl bg-stone-200/70"
            />
          ))}
        </div>
      ) : loadError && slots.length === 0 ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          <span className="inline-flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 font-semibold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : slots.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs text-stone-500">
          No upcoming pickup windows are currently listed.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label="Available pickup windows"
          className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5"
        >
          {slots.map((slot) => {
            const isSelected = slot.slot_start === effectiveSlotStart
            const isRecommended = slot.slot_start === recommendedSlotStart
            const badge = getSlotAvailabilityBadge(slot, orderWorkloadUnits)
            const disabled = !slot.is_feasible || isSubmitting

            return (
              <button
                key={slot.slot_start}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => onSelectSlot(slot.slot_start)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                    : slot.is_closed
                      ? 'border-stone-200 bg-stone-100/80 text-stone-500 cursor-not-allowed'
                      : slot.is_full
                        ? 'border-rose-200/80 bg-rose-50/40 text-stone-500 cursor-not-allowed'
                        : !slot.is_feasible
                          ? 'border-amber-200/80 bg-amber-50/30 text-stone-600 cursor-not-allowed'
                          : 'border-stone-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 cursor-pointer'
                } ${isSubmitting ? 'opacity-60' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-stone-900">
                      {formatTimeWindow(slot.slot_start, slot.slot_end)}
                    </span>
                    {isRecommended && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                        Earliest
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-stone-500">
                    {slot.is_closed
                      ? slot.close_reason
                        ? `Closed · ${slot.close_reason}`
                        : 'Closed by canteen manager'
                      : `${slot.remaining_units} of ${slot.capacity_units} units free`}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES[badge.tone]}`}
                >
                  {badge.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

