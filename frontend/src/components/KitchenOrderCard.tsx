import { ArrowRight, Clock, MessageSquareText } from 'lucide-react'
import type { OrderDetail, OrderStatus } from '../types'
import { formatRupees, formatTimeWindow } from '../utils/format'
import { getOrderSlotUrgency, NEXT_KITCHEN_ACTION } from '../utils/kitchen'
import { getPaymentStatusMeta } from '../utils/phase10'
import { Badge } from './ui/Badge'
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
          ? 'border-[#BDD6C7] bg-[#E3EFE8]/30'
          : urgency === 'due'
            ? 'border-[#E8C6B8] bg-[#F9ECE6]/35'
            : ''
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[#1E1D1A] px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-[#FCFBF8] tabular-nums">
                {order.pickup_code}
              </span>
              {urgency === 'due' && (
                <Badge tone="terracotta">Pickup Due</Badge>
              )}
              {urgency === 'soon' && <Badge tone="info">Due Soon</Badge>}
            </div>
            <h3 className="mt-2 text-base font-semibold text-[#1E1D1A]">
              {order.customer_name}
            </h3>
            <p className="font-mono text-xs text-[#787166]">{order.id}</p>
          </div>

          <StatusBadge status={order.status} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[#E4DED2] bg-[#F7F4ED] px-3 py-2 text-xs tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1E1D1A]">
            <Clock className="h-3.5 w-3.5 text-[#1A4D38]" aria-hidden="true" />
            <span>
              {formatTimeWindow(order.pickup_slot_start, order.pickup_slot_end)}
            </span>
          </span>
          <span className="font-medium text-[#5B564D]">
            {order.total_prep_units} prep units
          </span>
        </div>

        <ul className="space-y-1.5 border-t border-[#E4DED2] pt-3 text-sm">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 text-[#1E1D1A]"
            >
              <span>
                <span className="font-semibold tabular-nums">
                  {item.quantity}×
                </span>{' '}
                {item.item_name}
              </span>
              <span className="text-xs text-[#787166] tabular-nums">
                {item.prep_minutes * item.quantity}m
              </span>
            </li>
          ))}
        </ul>

        {order.notes && (
          <div className="flex items-start gap-2 rounded-xl border border-[#E7D4AF] bg-[#FBF4E4]/85 px-3 py-2 text-xs text-[#7D5214]">
            <MessageSquareText
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              <strong className="font-semibold">Special Instructions: </strong>
              {order.notes}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4DED2] pt-4">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-[#1E1D1A] tabular-nums">
            {formatRupees(order.total_amount)}
          </span>
          <p className="text-[11px] text-[#5B564D]">
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
          <span className="text-xs font-medium text-[#787166]">
            Completed
          </span>
        )}
      </div>
    </Card>
  )
}
