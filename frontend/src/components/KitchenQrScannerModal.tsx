import jsQR from 'jsqr'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Keyboard,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiClientError, verifyPickupToken } from '../api/client'
import type { VerifyPickupResponse } from '../types'
import { formatRupees, formatTimeWindow } from '../utils/format'
import {
  classifyCameraError,
  extractPickupTokenFromScan,
  shouldAcceptScannedToken,
  stopMediaStreamTracks,
} from '../utils/qr'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

interface KitchenQrScannerModalProps {
  open: boolean
  onClose: () => void
  onVerified: (response: VerifyPickupResponse) => void
}

type ScanMode = 'camera' | 'manual'
type CameraState = 'idle' | 'starting' | 'active' | 'error'

export function KitchenQrScannerModal({
  open,
  onClose,
  onVerified,
}: KitchenQrScannerModalProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('camera')
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyPickupResponse | null>(
    null,
  )
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const inFlightVerifyRef = useRef(false)
  const lastAttemptedTokenRef = useRef<string | null>(null)
  const lastAttemptedAtRef = useRef(0)
  const mountedRef = useRef(true)

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      stopMediaStreamTracks(streamRef.current)
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const submitTokenForVerification = useCallback(
    async (rawToken: string) => {
      const cleaned = extractPickupTokenFromScan(rawToken)
      if (!cleaned) {
        setVerifyError('Please enter or scan a valid pickup verification token.')
        return
      }
      if (inFlightVerifyRef.current) {
        return
      }

      inFlightVerifyRef.current = true
      lastAttemptedTokenRef.current = cleaned
      lastAttemptedAtRef.current = Date.now()
      setIsVerifying(true)
      setVerifyError(null)
      setVerifyResult(null)
      stopCamera()

      try {
        const result = await verifyPickupToken(cleaned)
        if (!mountedRef.current) return
        setVerifyResult(result)
        onVerified(result)
      } catch (err) {
        if (!mountedRef.current) return
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Unable to verify pickup token. Check backend connection and retry.'
        setVerifyError(message)
      } finally {
        inFlightVerifyRef.current = false
        if (mountedRef.current) {
          setIsVerifying(false)
        }
      }
    },
    [onVerified, stopCamera],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isVerifying) {
        stopCamera()
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, isVerifying, onClose, stopCamera])

  useEffect(() => {
    if (!open || scanMode !== 'camera' || verifyResult || verifyError) {
      stopCamera()
      return
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      Promise.resolve().then(() => {
        if (!mountedRef.current) return
        setCameraState('error')
        setCameraError(
          'Camera scanning is unsupported in this browser or requires HTTPS outside localhost. Use manual token entry below.',
        )
      })
      return
    }

    let cancelled = false

    Promise.resolve()
      .then(() => {
        if (cancelled) return null
        setCameraState('starting')
        setCameraError(null)
        return navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      })
      .then((stream) => {
        if (!stream) return
        if (cancelled || !mountedRef.current) {
          for (const track of stream.getTracks()) {
            track.stop()
          }
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream

        return video.play().then(() => {
          if (cancelled || !mountedRef.current) return
          setCameraState('active')

          const scanFrame = () => {
            if (cancelled || !mountedRef.current) return
            const activeVideo = videoRef.current
            const canvas = canvasRef.current
            if (
              activeVideo &&
              canvas &&
              activeVideo.readyState >= activeVideo.HAVE_ENOUGH_DATA &&
              activeVideo.videoWidth > 0 &&
              activeVideo.videoHeight > 0
            ) {
              canvas.width = activeVideo.videoWidth
              canvas.height = activeVideo.videoHeight
              const ctx = canvas.getContext('2d', { willReadFrequently: true })
              if (ctx) {
                ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height)
                const imgData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                )
                const decoded = jsQR(
                  imgData.data,
                  imgData.width,
                  imgData.height,
                )
                if (
                  decoded?.data &&
                  shouldAcceptScannedToken(
                    decoded.data,
                    lastAttemptedTokenRef.current,
                    lastAttemptedAtRef.current,
                  )
                ) {
                  void submitTokenForVerification(decoded.data)
                  return
                }
              }
            }
            rafRef.current = window.requestAnimationFrame(scanFrame)
          }

          rafRef.current = window.requestAnimationFrame(scanFrame)
        })
      })
      .catch((error: unknown) => {
        if (cancelled || !mountedRef.current) return
        stopCamera()
        setCameraState('error')
        setCameraError(classifyCameraError(error))
      })

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [open, scanMode, verifyResult, verifyError, stopCamera, submitTokenForVerification])

  if (!open) {
    return null
  }

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitTokenForVerification(manualToken)
  }

  const handleScanNext = () => {
    setVerifyResult(null)
    setVerifyError(null)
    setManualToken('')
    lastAttemptedTokenRef.current = null
    lastAttemptedAtRef.current = 0
  }

  const handleCloseModal = () => {
    if (isVerifying) return
    stopCamera()
    handleScanNext()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
      onClick={handleCloseModal}
    >
      <Card
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="qr-scanner-title"
                className="text-base font-semibold text-stone-900"
              >
                Scan Pickup QR
              </h2>
              <p className="text-xs text-stone-500">
                Verify student pickup token and mark READY orders as collected
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isVerifying}
            onClick={handleCloseModal}
            aria-label="Close QR scanner"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {verifyResult ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <span className="text-sm font-semibold">
                      {verifyResult.message}
                    </span>
                  </div>
                  <StatusBadge status={verifyResult.order.status} />
                </div>

                <div className="mt-4 grid gap-3 rounded-xl border border-emerald-200/70 bg-white p-3.5 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                      Customer &amp; Code
                    </p>
                    <p className="mt-1 text-base font-semibold text-stone-900">
                      {verifyResult.order.customer_name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-stone-600">
                      Code: <strong>{verifyResult.order.pickup_code}</strong> ·{' '}
                      {verifyResult.order.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                      Pickup Slot
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                      <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      <span>
                        {formatTimeWindow(
                          verifyResult.order.pickup_slot_start,
                          verifyResult.order.pickup_slot_end,
                        )}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-stone-600">
                      Total: {formatRupees(verifyResult.order.total_amount)}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-emerald-100 rounded-xl border border-emerald-200/70 bg-white px-3.5 text-sm">
                  {verifyResult.order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span>
                        <strong>{item.quantity}×</strong> {item.item_name}
                      </span>
                      <span className="text-xs text-stone-500">
                        {formatRupees(item.unit_price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  onClick={handleScanNext}
                  icon={<QrCode className="h-4 w-4" aria-hidden="true" />}
                >
                  Scan Next Order
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleCloseModal}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="inline-flex w-full rounded-xl border border-stone-200 bg-stone-100/80 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setVerifyError(null)
                    setScanMode('camera')
                  }}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors cursor-pointer ${
                    scanMode === 'camera'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  <span>Camera Scanner</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera()
                    setVerifyError(null)
                    setScanMode('manual')
                  }}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors cursor-pointer ${
                    scanMode === 'manual'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Keyboard className="h-4 w-4" aria-hidden="true" />
                  <span>Manual Token Fallback</span>
                </button>
              </div>

              {verifyError && (
                <div
                  role="alert"
                  className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className="mt-0.5 h-5 w-5 shrink-0 text-rose-700"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold">Verification Failed</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-rose-800">
                        {verifyError}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleScanNext}
                    icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {scanMode === 'camera' && !verifyError && (
                <div className="space-y-3">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-900">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {cameraState === 'active' && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <div className="h-48 w-48 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                      </div>
                    )}

                    {(cameraState === 'starting' || isVerifying) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/75 text-white">
                        <RefreshCw
                          className="h-6 w-6 animate-spin text-emerald-400"
                          aria-hidden="true"
                        />
                        <p className="mt-2 text-xs font-medium">
                          {isVerifying
                            ? 'Verifying pickup token...'
                            : 'Requesting rear camera access...'}
                        </p>
                      </div>
                    )}

                    {cameraState === 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/95 p-6 text-center text-white">
                        <AlertCircle
                          className="h-8 w-8 text-amber-400"
                          aria-hidden="true"
                        />
                        <p className="mt-2 text-sm font-semibold">
                          Camera Unavailable
                        </p>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone-300">
                          {cameraError}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-center text-xs text-stone-500">
                    Point the rear camera at the student&apos;s QR code. HTTPS
                    is required on non-localhost devices.
                  </p>
                </div>
              )}

              <form
                onSubmit={handleManualSubmit}
                className="space-y-3 border-t border-stone-100 pt-4"
              >
                <div>
                  <label
                    htmlFor="manual-pickup-token"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Manual QR Token Entry
                  </label>
                  <input
                    id="manual-pickup-token"
                    type="text"
                    disabled={isVerifying}
                    value={manualToken}
                    onChange={(event) => setManualToken(event.target.value)}
                    placeholder="Paste student QR token (e.g. qlp_...)"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-mono text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-stone-500">
                    4-character pickup codes cannot replace the cryptographic QR
                    token here. Use the order card&apos;s manual Collect button if
                    only the 4-character code is shown.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={isVerifying}
                  disabled={isVerifying || manualToken.trim().length === 0}
                >
                  Verify &amp; Mark Collected
                </Button>
              </form>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
