import { ArrowRight, Clock, MessageSquareText } from 'lucide-react'
import type { OrderDetail, OrderStatus } from '../types'
import { formatRupees, formatTimeWindow } from '../utils/format'
import { getOrderSlotUrgency, NEXT_KITCHEN_ACTION } from '../utils/kitchen'
import { getPaymentStatusMeta } from '../utils/phase10'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

interface KitchenOrderCardProps {
  order: OrderDetail
  isUpdating: boolean
  onAdvanceStatus: (order: OrderDetail, nextStatus: OrderStatus) => void
  onRequestCollect: (order: OrderDetail) => void
}

export function KitchenOrderCard({
  order,
  isUpdating,
  onAdvanceStatus,
  onRequestCollect,
}: KitchenOrderCardProps) {
  const nextAction = NEXT_KITCHEN_ACTION[order.status]
  const urgency = getOrderSlotUrgency(order.pickup_slot_start, order.status)

  return (
    <Card
      className={`flex flex-col justify-between p-5 transition-colors ${
        order.status === 'READY'
          ? 'border-emerald-300 bg-emerald-50/20'
          : urgency === 'due'
            ? 'border-amber-300 bg-amber-50/20'
            : ''
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-stone-900 px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-white">
                {order.pickup_code}
              </span>
              {urgency === 'due' && (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  Pickup Due
                </span>
              )}
              {urgency === 'soon' && (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                  Due Soon
                </span>
              )}
            </div>
            <h3 className="mt-2 text-base font-semibold text-stone-900">
              {order.customer_name}
            </h3>
            <p className="text-xs font-mono text-stone-500">{order.id}</p>
          </div>

          <StatusBadge status={order.status} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-stone-800">
            <Clock className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            <span>
              {formatTimeWindow(order.pickup_slot_start, order.pickup_slot_end)}
            </span>
          </span>
          <span className="font-medium text-stone-600">
            {order.total_prep_units} prep units
          </span>
        </div>

        <ul className="space-y-1.5 border-t border-stone-100 pt-3 text-sm">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 text-stone-800"
            >
              <span>
                <span className="font-semibold text-stone-900">
                  {item.quantity}×
                </span>{' '}
                {item.item_name}
              </span>
              <span className="text-xs text-stone-500">
                {item.prep_minutes * item.quantity}m
              </span>
            </li>
          ))}
        </ul>

        {order.notes && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
            <MessageSquareText
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <span>
              <strong className="font-semibold">Special Instructions: </strong>
              {order.notes}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-stone-900">
            {formatRupees(order.total_amount)}
          </span>
          <p className="text-[11px] text-stone-500">
            {
              getPaymentStatusMeta(order.payment_status, order.payment_method)
                .label
            }
          </p>
        </div>

        {nextAction ? (
          <Button
            size="sm"
            variant={
              nextAction.nextStatus === 'COLLECTED' ? 'secondary' : 'primary'
            }
            loading={isUpdating}
            disabled={isUpdating}
            onClick={() => {
              if (nextAction.requiresConfirmation) {
                onRequestCollect(order)
              } else {
                onAdvanceStatus(order, nextAction.nextStatus)
              }
            }}
            icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {nextAction.label}
          </Button>
        ) : (
          <span className="text-xs font-medium text-stone-500">
            Completed
          </span>
        )}
      </div>
    </Card>
  )
}

