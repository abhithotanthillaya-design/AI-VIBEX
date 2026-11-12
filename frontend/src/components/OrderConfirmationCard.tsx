import { CheckCircle2, Clock, Copy, Check, ArrowRight, PlusCircle } from 'lucide-react'
import { useState } from 'react'
import type { CartItem, CreateOrderResponse, OrderDetail } from '../types'
import { formatRupees, formatTimeWindow } from '../utils/format'
import { showToast } from '../utils/toast'
import { DemoPaymentPanel } from './DemoPaymentPanel'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'
import { PickupQrCard } from './PickupQrCard'

interface OrderConfirmationCardProps {
  confirmation: CreateOrderResponse
  orderedItems: CartItem[]
  customerName: string
  notes?: string
  onPaymentUpdated?: (updatedOrder: OrderDetail) => void
  onTrackOrder: (orderId: string) => void
  onNewOrder: () => void
}

export function OrderConfirmationCard({
  confirmation,
  orderedItems,
  customerName,
  notes,
  onPaymentUpdated,
  onTrackOrder,
  onNewOrder,
}: OrderConfirmationCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(confirmation.pickup_code)
      setCopied(true)
      showToast(`Pickup code ${confirmation.pickup_code} copied`, 'success')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard may be unavailable in non-HTTPS contexts; ignore silently.
    }
  }

  return (
    <Card className="mx-auto max-w-2xl overflow-hidden border-[#BDD6C7] ql-animate-enter">
      <div className="border-b border-[#BDD6C7] bg-[#E3EFE8]/75 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A4D38] text-[#FCFBF8]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#143B2B]">
                Pre-Order Confirmed
              </p>
              <h2 className="text-lg font-semibold text-[#1E1D1A]">
                Thanks, {customerName}
              </h2>
            </div>
          </div>

          <StatusBadge status={confirmation.status} />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#143B2B]">
          {confirmation.message}
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#D8D0C1] bg-[#F7F4ED] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#5B564D]">
              Pickup Code
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-3xl font-bold tracking-widest text-[#1E1D1A] tabular-nums">
                {confirmation.pickup_code}
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleCopyCode()
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D8D0C1] bg-[#FCFBF8] px-2.5 py-1.5 text-xs font-medium text-[#1E1D1A] transition-colors hover:bg-[#EFEAE0] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#1A4D38]" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#5B564D]">
              Order ID:{' '}
              <span className="font-mono text-[#1E1D1A]">{confirmation.id}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-[#BDD6C7] bg-[#E3EFE8]/45 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#143B2B]">
              Assigned Pickup Window
            </p>
            <div className="mt-2 flex items-center gap-2 text-[#1E1D1A]">
              <Clock className="h-5 w-5 text-[#1A4D38]" aria-hidden="true" />
              <span className="text-xl font-semibold tracking-tight tabular-nums">
                {formatTimeWindow(
                  confirmation.pickup_slot_start,
                  confirmation.pickup_slot_end,
                )}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#2F533E]">
              Reserved atomically against kitchen slot capacity.
            </p>
          </div>
        </div>

        <PickupQrCard
          token={confirmation.pickup_token}
          pickupCode={confirmation.pickup_code}
          orderId={confirmation.id}
          orderStatus={confirmation.status}
        />

        <DemoPaymentPanel
          orderId={confirmation.id}
          amountPaise={confirmation.total_amount}
          orderStatus={confirmation.status}
          paymentMethod={confirmation.payment_method}
          paymentStatus={confirmation.payment_status}
          paymentReference={confirmation.payment_reference}
          onPaymentUpdated={onPaymentUpdated}
        />

        <div className="overflow-hidden rounded-2xl border border-[#D8D0C1] bg-[#FCFBF8]">
          <div className="border-b border-[#E4DED2] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#1E1D1A]">
              Order Summary
            </h3>
          </div>
          <ul className="divide-y divide-[#E4DED2] px-4">
            {orderedItems.map(({ item, quantity }) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-[#5B564D]">
                  <span className="font-semibold text-[#1E1D1A] tabular-nums">
                    {quantity}×
                  </span>{' '}
                  {item.name}
                </span>
                <span className="font-medium text-[#1E1D1A] tabular-nums">
                  {formatRupees(item.price * quantity)}
                </span>
              </li>
            ))}
          </ul>
          {notes && (
            <div className="border-t border-[#E4DED2] bg-[#FBF4E4]/70 px-4 py-2.5 text-xs text-[#7D5214]">
              <strong className="font-semibold">Special Instructions:</strong>{' '}
              {notes}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[#D8D0C1] bg-[#F7F4ED] px-4 py-3 text-base font-semibold text-[#1E1D1A] tabular-nums">
            <span>Verified Total</span>
            <span>{formatRupees(confirmation.total_amount)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => onTrackOrder(confirmation.id)}
            icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            Track Live Order
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={onNewOrder}
            icon={<PlusCircle className="h-4 w-4" aria-hidden="true" />}
          >
            Order More Items
          </Button>
        </div>
      </div>
    </Card>
  )
}
