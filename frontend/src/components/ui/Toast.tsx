import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastViewportProps {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

const TONE_MAP: Record<ToastTone, { container: string; icon: typeof CheckCircle2 }> = {
  success: {
    container: 'border-[#BDD6C7] bg-[#FCFBF8] text-[#143B2B]',
    icon: CheckCircle2,
  },
  error: {
    container: 'border-[#E7BDBD] bg-[#FBEDED] text-[#842323]',
    icon: AlertCircle,
  },
  info: {
    container: 'border-[#D8D0C1] bg-[#FCFBF8] text-[#1E1D1A]',
    icon: Info,
  },
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:bottom-5 sm:right-5 sm:px-0"
    >
      {toasts.map((toast) => {
        const meta = TONE_MAP[toast.tone]
        const Icon = meta.icon
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium shadow-md ql-animate-enter ${meta.container}`}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-current opacity-65 hover:opacity-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

