import { AlertCircle, ArrowRight, Banknote, Clock, CreditCard, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import type {
  AvailablePickupSlot,
  CartItem,
  DemoPaymentMethod,
} from '../types'
import { calculateCartTotals } from '../utils/cart'
import { formatRupees } from '../utils/format'
import { PickupSlotSelector } from './PickupSlotSelector'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface CartPanelProps {
  items: CartItem[]
  customerName: string
  onCustomerNameChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  paymentMethod: DemoPaymentMethod
  onPaymentMethodChange: (method: DemoPaymentMethod) => void
  availableSlots: AvailablePickupSlot[]
  recommendedSlotStart: string | null
  effectiveSlotStart: string | null
  selectedSlot: AvailablePickupSlot | null
  isUsingDefaultEarliest: boolean
  slotUnavailableWarning: string | null
  slotNotice: string | null
  onClearSlotNotice: () => void
  isLoadingSlots: boolean
  slotsError: string | null
  onSelectSlot: (slotStart: string) => void
  onUseEarliestSlot: () => void
  onRefreshSlots: () => void
  isSubmitting: boolean
  submitError: string | null
  onUpdateQuantity: (itemId: string, delta: number) => void
  onRemoveItem: (itemId: string) => void
  onClearCart: () => void
  onPlaceOrder: () => void
}

export function CartPanel({
  items,
  customerName,
  onCustomerNameChange,
  notes,
  onNotesChange,
  paymentMethod,
  onPaymentMethodChange,
  availableSlots,
  recommendedSlotStart,
  effectiveSlotStart,
  selectedSlot,
  isUsingDefaultEarliest,
  slotUnavailableWarning,
  slotNotice,
  onClearSlotNotice,
  isLoadingSlots,
  slotsError,
  onSelectSlot,
  onUseEarliestSlot,
  onRefreshSlots,
  isSubmitting,
  submitError,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
}: CartPanelProps) {
  const totals = calculateCartTotals(items)
  const slotBlocksSubmit =
    Boolean(slotUnavailableWarning) ||
    (availableSlots.length > 0 && effectiveSlotStart === null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || items.length === 0 || slotBlocksSubmit) {
      return
    }
    onPlaceOrder()
  }

  return (
    <Card id="cart-panel" className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">Your Cart</h2>
            <p className="text-xs text-stone-500">
              {totals.itemCount === 0
                ? 'No items selected'
                : `${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'} added`}
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClearCart}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50 cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <ShoppingBag className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-stone-800">
            Your canteen tray is empty
          </p>
          <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-stone-500">
            Select dishes from the menu to place a pre-order and receive an
            assigned pickup window.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <ul className="max-h-[280px] divide-y divide-stone-100 overflow-y-auto px-5">
            {items.map(({ item, quantity }) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {formatRupees(item.price)} each · {item.prep_minutes * quantity}m prep load
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5"
                      role="group"
                      aria-label={`Cart quantity for ${item.name}`}
                    >
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        aria-label={`Decrease cart quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-stone-700 hover:bg-white disabled:opacity-50 cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-6 text-center text-xs font-semibold text-stone-900">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        aria-label={`Increase cart quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-stone-700 hover:bg-white disabled:opacity-50 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <span className="shrink-0 text-sm font-semibold text-stone-900">
                  {formatRupees(item.price * quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-4 border-t border-stone-200/80 bg-stone-50/70 px-5 py-4">
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="customer-name"
                  className="block text-xs font-medium text-stone-700"
                >
                  Student Name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerName}
                  disabled={isSubmitting}
                  onChange={(event) => onCustomerNameChange(event.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  maxLength={80}
                  required
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="order-notes"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Special Instructions &amp; Allergy Notes (optional)
                  </label>
                  <span className="text-[11px] text-stone-400">
                    {notes.length}/300
                  </span>
                </div>
                <textarea
                  id="order-notes"
                  rows={2}
                  value={notes}
                  disabled={isSubmitting}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder="e.g. Less spicy, no onion, no added sugar, peanut sensitivity"
                  maxLength={300}
                  className="mt-1 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
                />
                <p className="mt-1 text-[11px] leading-snug text-stone-500">
                  Special instructions are shared with kitchen staff, but
                  allergen-free preparation cannot be guaranteed unless confirmed
                  at the counter.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-stone-700">
                  Payment Method (Demo Only)
                </span>
                <div
                  className="grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label="Simulated demo payment method"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === 'COUNTER_CASH'}
                    disabled={isSubmitting}
                    onClick={() => onPaymentMethodChange('COUNTER_CASH')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      paymentMethod === 'COUNTER_CASH'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <Banknote className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Cash at Counter</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === 'DEMO_UPI'}
                    disabled={isSubmitting}
                    onClick={() => onPaymentMethodChange('DEMO_UPI')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      paymentMethod === 'DEMO_UPI'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Demo UPI</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  Demo Payment — No real money is charged. Never asks for real
                  UPI PINs or card details.
                </p>
              </div>
            </div>

            <PickupSlotSelector
              slots={availableSlots}
              recommendedSlotStart={recommendedSlotStart}
              orderWorkloadUnits={totals.totalPrepUnits}
              effectiveSlotStart={effectiveSlotStart}
              selectedSlot={selectedSlot}
              isUsingDefaultEarliest={isUsingDefaultEarliest}
              unavailableWarning={slotUnavailableWarning}
              slotNotice={slotNotice}
              onClearSlotNotice={onClearSlotNotice}
              isLoading={isLoadingSlots}
              loadError={slotsError}
              isSubmitting={isSubmitting}
              onSelectSlot={onSelectSlot}
              onUseEarliest={onUseEarliestSlot}
              onRefresh={onRefreshSlots}
            />

            <div className="space-y-1.5 border-t border-stone-200/80 pt-3 text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>Subtotal ({totals.itemCount} items)</span>
                <span>{formatRupees(totals.subtotalPaise)}</span>
              </div>
              <div className="flex items-center justify-between text-stone-600">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                  <span>Est. kitchen workload</span>
                </span>
                <span className="font-medium text-stone-800">
                  {totals.totalPrepUnits} prep units
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-stone-200 pt-2.5 text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatRupees(totals.totalPaise)}</span>
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={items.length === 0 || isSubmitting || slotBlocksSubmit}
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              {isSubmitting ? 'Validating Pickup Slot...' : 'Place Order'}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-stone-500">
              Demo pre-order mode · Prices and selected pickup slot capacity are
              verified atomically on the server.
            </p>
          </div>
        </form>
      )}
    </Card>
  )
}
