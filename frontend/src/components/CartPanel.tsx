import { Clock, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import type { CartItem } from '../types'
import { calculateCartTotals } from '../utils/cart'
import { formatRupees } from '../utils/format'
import { Card } from './ui/Card'

interface CartPanelProps {
  items: CartItem[]
  onUpdateQuantity: (itemId: string, delta: number) => void
  onRemoveItem: (itemId: string) => void
  onClearCart: () => void
}

export function CartPanel({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartPanelProps) {
  const totals = calculateCartTotals(items)

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
            onClick={onClearCart}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
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
            Select dishes from the menu to build your order and preview your
            total and prep workload.
          </p>
        </div>
      ) : (
        <>
          <ul className="max-h-[360px] divide-y divide-stone-100 overflow-y-auto px-5">
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
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        aria-label={`Decrease cart quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-stone-700 hover:bg-white cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-6 text-center text-xs font-semibold text-stone-900">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        aria-label={`Increase cart quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-stone-700 hover:bg-white cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
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

          <div className="border-t border-stone-200/80 bg-stone-50/70 px-5 py-4 space-y-3">
            <div className="space-y-1.5 text-sm">
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

            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-900">
              Checkout and capacity-aware pickup slot allocation connect here in
              Phase 3.
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

