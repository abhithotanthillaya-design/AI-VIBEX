import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Maximize2,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { OrderStatus } from '../types'
import { generatePickupQrDataUrl } from '../utils/qr'
import { Button } from './ui/Button'

interface PickupQrCardProps {
  token: string | null
  pickupCode: string
  orderId: string
  orderStatus: OrderStatus
  onRetryToken?: () => void
}

export function PickupQrCard({
  token,
  pickupCode,
  orderId,
  orderStatus,
  onRetryToken,
}: PickupQrCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isEnlarged, setIsEnlarged] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true

    generatePickupQrDataUrl(token)
      .then((dataUrl) => {
        if (!active) return
        setQrDataUrl(dataUrl)
        setQrError(null)
      })
      .catch(() => {
        if (!active) return
        setQrDataUrl(null)
        setQrError('Unable to generate QR image in this browser.')
      })

    return () => {
      active = false
    }
  }, [token, retryCount])

  useEffect(() => {
    if (!isEnlarged) return
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEnlarged(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isEnlarged])

  const handleRetry = () => {
    setQrError(null)
    setQrDataUrl(null)
    setRetryCount((count) => count + 1)
    onRetryToken?.()
  }

  const handleCopyToken = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopiedToken(true)
      window.setTimeout(() => setCopiedToken(false), 1800)
    } catch {
      // Ignore clipboard failures on restricted contexts.
    }
  }

  const isRendering = Boolean(token) && qrDataUrl === null && qrError === null
  const isCollected = orderStatus === 'COLLECTED'
  const isCancelled = orderStatus === 'CANCELLED'

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-stone-900">
            Counter Pickup QR
          </h3>
        </div>
        {isCollected ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            <span>Collected · Redeemed</span>
          </span>
        ) : isCancelled ? (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-800">
            Cancelled · Inactive
          </span>
        ) : qrDataUrl ? (
          <button
            type="button"
            onClick={() => setIsEnlarged(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Enlarge QR</span>
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {token && isRendering ? (
          <div
            className="h-44 w-44 shrink-0 animate-pulse rounded-2xl bg-stone-100"
            aria-label="Generating QR code"
          />
        ) : token && qrDataUrl ? (
          <button
            type="button"
            onClick={() => setIsEnlarged(true)}
            aria-label="Enlarge pickup QR code"
            className={`group relative shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2.5 shadow-2xs transition-transform hover:scale-[1.01] cursor-pointer ${
              isCollected || isCancelled ? 'opacity-60' : ''
            }`}
          >
            <img
              src={qrDataUrl}
              alt={`Pickup verification QR code for order ${pickupCode}`}
              className="h-40 w-40 object-contain"
            />
          </button>
        ) : (
          <div className="flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <p className="font-semibold">
                {qrError ?? 'QR verification token unavailable in this session.'}
              </p>
              <p className="text-amber-900">
                Show your Pickup Code{' '}
                <strong className="font-mono">{pickupCode}</strong> (Order{' '}
                <span className="font-mono">{orderId}</span>) at the counter as
                fallback.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRetry}
                icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Retry QR
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2.5 text-center sm:text-left">
          <p className="text-sm font-medium text-stone-900">
            Show this QR code at the canteen counter when collecting your order.
          </p>
          <p className="text-xs leading-relaxed text-stone-600">
            One-time cryptographic verification token. Your fallback Pickup Code{' '}
            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono font-semibold text-stone-900">
              {pickupCode}
            </span>{' '}
            and Order ID{' '}
            <span className="font-mono text-stone-800">{orderId}</span> remain
            valid at the counter.
          </p>

          {token && !isCollected && !isCancelled && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  void handleCopyToken()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                {copiedToken ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    <span>Verification token copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy verification token</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {isEnlarged && qrDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enlarged-qr-title"
          onClick={() => setIsEnlarged(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2
                id="enlarged-qr-title"
                className="text-base font-semibold text-stone-900"
              >
                Counter Pickup QR
              </h2>
              <button
                type="button"
                onClick={() => setIsEnlarged(false)}
                aria-label="Close enlarged QR code"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex justify-center rounded-2xl border border-stone-200 bg-white p-4">
              <img
                src={qrDataUrl}
                alt={`Enlarged pickup QR for ${pickupCode}`}
                className="h-64 w-64 object-contain"
              />
            </div>

            <p className="mt-4 font-mono text-2xl font-bold tracking-widest text-stone-900">
              {pickupCode}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Show this QR code at the canteen counter when collecting your
              order.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

