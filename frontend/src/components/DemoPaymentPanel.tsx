import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { processDemoPayment } from '../api/client'
import type {
  DemoPaymentMethod,
  DemoPaymentOutcome,
  DemoPaymentStatus,
  OrderDetail,
  OrderStatus,
} from '../types'
import { formatRupees } from '../utils/format'
import {
  executeGuardedDemoPayment,
  getPaymentStatusMeta,
} from '../utils/phase10'
import { Button } from './ui/Button'

interface DemoPaymentPanelProps {
  orderId: string
  amountPaise: number
  orderStatus: OrderStatus
  paymentMethod?: DemoPaymentMethod
  paymentStatus?: DemoPaymentStatus
  paymentReference?: string | null
  onPaymentUpdated?: (updatedOrder: OrderDetail) => void
}

const TONE_BADGE_STYLES = {
  emerald: 'border-emerald-200 bg-emerald-100 text-emerald-900',
  amber: 'border-amber-200 bg-amber-100 text-amber-900',
  rose: 'border-rose-200 bg-rose-100 text-rose-900',
  stone: 'border-stone-300 bg-stone-200/80 text-stone-800',
}

export function DemoPaymentPanel({
  orderId,
  amountPaise,
  orderStatus,
  paymentMethod = 'COUNTER_CASH',
  paymentStatus = 'PAY_AT_COUNTER',
  paymentReference,
  onPaymentUpdated,
}: DemoPaymentPanelProps) {
  const [localMethod, setLocalMethod] =
    useState<DemoPaymentMethod>(paymentMethod)
  const [localStatus, setLocalStatus] =
    useState<DemoPaymentStatus>(paymentStatus)
  const [localReference, setLocalReference] = useState<string | null>(
    paymentReference ?? null,
  )
  const [isUpdating, setIsUpdating] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const guardRef = useRef(false)

  const currentMethod =
    paymentStatus !== localStatus || paymentMethod !== localMethod
      ? paymentMethod
      : localMethod
  const currentStatus =
    paymentStatus !== localStatus ? paymentStatus : localStatus
  const currentRef = paymentReference ?? localReference

  const meta = getPaymentStatusMeta(currentStatus, currentMethod)

  const runSimulation = async (
    outcome: DemoPaymentOutcome,
    method: DemoPaymentMethod,
  ) => {
    setActionError(null)
    setActionMessage(null)
    setIsUpdating(true)

    const result = await executeGuardedDemoPayment(
      orderId,
      outcome,
      method,
      guardRef,
      processDemoPayment,
    )

    setIsUpdating(false)

    if (result.status === 'ignored_duplicate') {
      return
    }
    if (result.status === 'error') {
      setActionError(result.message)
      return
    }

    const updated = result.response.order
    setLocalMethod(updated.payment_method ?? method)
    setLocalStatus(updated.payment_status ?? result.response.payment_status)
    setLocalReference(updated.payment_reference ?? null)
    setActionMessage(result.response.message)
    onPaymentUpdated?.(updated)
  }

  const canModifyPayment =
    orderStatus !== 'CANCELLED' && currentStatus !== 'DEMO_PAID'

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-700">
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Demo Payment — No real money is charged</span>
          </div>
          <p className="text-xs text-stone-600">
            Order total: <strong className="text-stone-900">{formatRupees(amountPaise)}</strong> · {meta.description}
          </p>
        </div>

        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_BADGE_STYLES[meta.tone]}`}
        >
          {meta.label}
        </span>
      </div>

      {currentRef && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-950">
          Simulated Reference:{' '}
          <span className="font-mono font-semibold">{currentRef}</span>
        </p>
      )}

      {actionMessage && (
        <p
          role="status"
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950"
        >
          {actionMessage}
        </p>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {canModifyPayment && (
        <div className="space-y-2 border-t border-stone-200/80 pt-3">
          <p className="text-[11px] text-stone-500">
            Simulated hackathon controls (never collects real UPI PINs, cards, or banking credentials):
          </p>
          <div className="flex flex-wrap gap-2">
            {(currentMethod === 'DEMO_UPI' ||
              currentStatus === 'DEMO_FAILED' ||
              currentStatus === 'DEMO_CANCELLED') && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={isUpdating}
                  loading={isUpdating}
                  onClick={() => {
                    void runSimulation('succeed', 'DEMO_UPI')
                  }}
                  icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Simulate Demo UPI Success
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isUpdating}
                  onClick={() => {
                    void runSimulation('fail', 'DEMO_UPI')
                  }}
                  icon={<XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Simulate Failure
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isUpdating}
                  onClick={() => {
                    void runSimulation('cancel', 'DEMO_UPI')
                  }}
                >
                  Cancel Payment
                </Button>
              </>
            )}

            {currentMethod === 'COUNTER_CASH' && currentStatus === 'PAY_AT_COUNTER' ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isUpdating}
                onClick={() => {
                  void runSimulation('succeed', 'DEMO_UPI')
                }}
                icon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Simulate Demo UPI Instead
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isUpdating}
                onClick={() => {
                  void runSimulation('switch_to_counter', 'COUNTER_CASH')
                }}
                icon={<Banknote className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Switch to Cash at Counter
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

