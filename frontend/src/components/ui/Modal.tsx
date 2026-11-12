import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Card } from './Card'

interface ModalProps {
  open: boolean
  title: string
  subtitle?: string
  titleId: string
  descriptionId?: string
  maxWidthClass?: string
  disableClose?: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({
  open,
  title,
  subtitle,
  titleId,
  descriptionId,
  maxWidthClass = 'max-w-lg',
  disableClose = false,
  onClose,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disableClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, disableClose, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1D1A]/45 p-4 backdrop-blur-[2px] ql-animate-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={() => {
        if (!disableClose) onClose()
      }}
    >
      <Card
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto p-6 shadow-xl ql-animate-modal`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[#1E1D1A]">
              {title}
            </h2>
            {subtitle && (
              <p
                id={descriptionId}
                className="mt-1 text-xs leading-relaxed text-[#5B564D]"
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={disableClose}
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#787166] transition-colors hover:bg-[#EFEAE0] hover:text-[#1E1D1A] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </Card>
    </div>
  )
}

