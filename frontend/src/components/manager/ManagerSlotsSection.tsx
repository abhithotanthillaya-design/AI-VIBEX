import { useState, type FormEvent } from 'react'
import { AlertCircle, Clock, Lock, Unlock } from 'lucide-react'
import type { ManagerSlotSettings, SlotWorkload } from '../../types'
import { formatTimeWindow } from '../../utils/format'
import { validateCapacityInput } from '../../utils/manager'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface ManagerSlotsSectionProps {
  slotSettings: ManagerSlotSettings | null
  isLoading: boolean
  isSavingCapacity: boolean
  togglingSlotStart: string | null
  onUpdateCapacity: (capacity: number) => Promise<void>
  onRequestCloseSlot: (slot: SlotWorkload) => void
  onReopenSlot: (slot: SlotWorkload) => void
}

export function ManagerSlotsSection({
  slotSettings,
  isLoading,
  isSavingCapacity,
  togglingSlotStart,
  onUpdateCapacity,
  onRequestCloseSlot,
  onReopenSlot,
}: ManagerSlotsSectionProps) {
  const [capacityDraft, setCapacityDraft] = useState<string | null>(null)
  const [capacityError, setCapacityError] = useState<string | null>(null)

  if (isLoading && !slotSettings) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Card className="h-32 animate-pulse bg-stone-100" />
        <Card className="h-56 animate-pulse bg-stone-100" />
      </div>
    )
  }

  if (!slotSettings) {
    return null
  }

  const displayedCapacity =
    capacityDraft ?? String(slotSettings.slot_capacity_units)

  const handleCapacitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSavingCapacity) return

    const validated = validateCapacityInput(displayedCapacity)
    if (!validated.ok) {
      setCapacityError(validated.error)
      return
    }

    setCapacityError(null)
    await onUpdateCapacity(validated.value)
    setCapacityDraft(null)
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Pickup Slot Configuration
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Slot duration is fixed at{' '}
              <strong className="text-stone-900">
                {slotSettings.slot_duration_minutes} minutes
              </strong>
              . Updating default capacity persists in SQLite without changing
              existing orders&apos; assigned pickup windows.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              void handleCapacitySubmit(event)
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div>
              <label
                htmlFor="slot-capacity-input"
                className="block text-xs font-medium text-stone-700"
              >
                Default Capacity (prep units)
              </label>
              <input
                id="slot-capacity-input"
                type="number"
                min="1"
                max="100"
                step="1"
                disabled={isSavingCapacity}
                value={displayedCapacity}
                onChange={(event) => {
                  setCapacityError(null)
                  setCapacityDraft(event.target.value)
                }}
                className="mt-1 w-32 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSavingCapacity}
              disabled={isSavingCapacity}
            >
              Save Capacity
            </Button>
          </form>
        </div>

        {capacityError && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{capacityError}</span>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-stone-900">
              Upcoming &amp; Active Pickup Windows
            </h3>
          </div>
          <span className="text-xs text-stone-500">
            Closed slots reject new bookings while preserving existing orders
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slotSettings.slots.map((slot) => {
            const isToggling = togglingSlotStart === slot.slot_start
            const ratio =
              slot.capacity_units > 0
                ? Math.min(
                    100,
                    Math.round((slot.used_units / slot.capacity_units) * 100),
                  )
                : 0

            return (
              <div
                key={slot.slot_start}
                className={`flex flex-col justify-between rounded-xl border p-4 ${
                  slot.is_closed
                    ? 'border-stone-300 bg-stone-100/80'
                    : slot.is_full
                      ? 'border-rose-200 bg-rose-50/40'
                      : 'border-stone-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-stone-900">
                      {formatTimeWindow(slot.slot_start, slot.slot_end)}
                    </span>

                    {slot.is_closed ? (
                      <span className="rounded-full border border-stone-300 bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-800">
                        Closed
                      </span>
                    ) : slot.is_full ? (
                      <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                        Full
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        Open ({slot.remaining_units} left)
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-200/80">
                    <div
                      className={`h-full rounded-full ${
                        slot.is_full
                          ? 'bg-rose-600'
                          : ratio >= 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                      }`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-stone-600">
                    {slot.used_units} / {slot.capacity_units} units ·{' '}
                    {slot.active_orders}{' '}
                    {slot.active_orders === 1 ? 'order' : 'orders'}
                  </p>
                  {slot.is_closed && slot.close_reason && (
                    <p className="mt-1 text-[11px] text-stone-600">
                      Reason: {slot.close_reason}
                    </p>
                  )}
                </div>

                {slot.is_upcoming && (
                  <div className="mt-3 border-t border-stone-200/70 pt-3">
                    {slot.is_closed ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        loading={isToggling}
                        disabled={isToggling}
                        onClick={() => onReopenSlot(slot)}
                        icon={<Unlock className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        Reopen Slot
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        loading={isToggling}
                        disabled={isToggling}
                        onClick={() => onRequestCloseSlot(slot)}
                        icon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        Close Slot
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
