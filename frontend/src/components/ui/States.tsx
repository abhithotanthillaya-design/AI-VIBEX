import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card className="px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFEAE0] text-[#5B564D]">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-[#1E1D1A]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-[#5B564D]">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  )
}

interface ErrorStateProps {
  title: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
}: ErrorStateProps) {
  return (
    <Card className="border-[#E7BDBD] bg-[#FBEDED]/75 p-5 sm:p-6" role="alert">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#9F2D2D]/10 text-[#9F2D2D]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1E1D1A]">{title}</h2>
            <p className="mt-1 text-sm text-[#5B564D]">{message}</p>
          </div>
        </div>
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </Card>
  )
}

