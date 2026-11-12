import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  isConfirming: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  isConfirming,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, isConfirming, onCancel])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onClick={() => {
        if (!isConfirming) onCancel()
      }}
    >
      <Card
        className="w-full max-w-md p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="text-base font-semibold text-stone-900"
              >
                {title}
              </h2>
              <p
                id="confirm-dialog-description"
                className="mt-1 text-sm leading-relaxed text-stone-600"
              >
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isConfirming}
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            size="md"
            disabled={isConfirming}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isConfirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}

