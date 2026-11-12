import QRCode from 'qrcode'

export const DUPLICATE_SCAN_COOLDOWN_MS = 3000

/**
 * Render a bearer pickup token as a crisp PNG Data URL using the local qrcode library.
 */
export async function generatePickupQrDataUrl(token: string): Promise<string> {
  const cleaned = token.trim()
  if (!cleaned) {
    throw new Error('Pickup verification token is missing.')
  }
  return QRCode.toDataURL(cleaned, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1c1917',
      light: '#ffffff',
    },
  })
}

export function extractPickupTokenFromScan(rawValue: string): string {
  return rawValue.trim()
}

/**
 * Prevent accidental duplicate verification requests for the same scanned QR code
 * within the cooldown window.
 */
export function shouldAcceptScannedToken(
  rawValue: string,
  lastAttemptedToken: string | null,
  lastAttemptedAtMs: number,
  nowMs = Date.now(),
  cooldownMs = DUPLICATE_SCAN_COOLDOWN_MS,
): boolean {
  const cleaned = extractPickupTokenFromScan(rawValue)
  if (!cleaned) {
    return false
  }
  if (
    lastAttemptedToken === cleaned &&
    nowMs - lastAttemptedAtMs < cooldownMs
  ) {
    return false
  }
  return true
}

/**
 * Translate browser getUserMedia errors into clear, actionable guidance for kitchen staff.
 */
export function classifyCameraError(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) {
    const name = error.name
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Camera permission was denied. Enable camera access in your browser settings or use manual token entry below.'
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera was found on this device. Use manual token entry below to verify pickup.'
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Camera is currently in use by another application. Close other camera apps or use manual token entry.'
    }
    if (name === 'SecurityError') {
      return 'Camera access requires HTTPS outside localhost. Use manual token entry below.'
    }
    if (name === 'OverconstrainedError') {
      return 'Requested rear camera is unavailable on this device. Use manual token entry below.'
    }
  }
  return 'Unable to start camera on this browser. Use manual token entry below.'
}

export interface StoppableTrack {
  stop: () => void
}

export interface StoppableStream {
  getTracks: () => StoppableTrack[]
}

/**
 * Stop every media track on an active camera stream to release hardware immediately.
 */
export function stopMediaStreamTracks(stream: StoppableStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}
