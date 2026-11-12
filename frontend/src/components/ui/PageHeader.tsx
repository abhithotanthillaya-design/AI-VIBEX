import type { ReactNode } from 'react'

interface PageHeaderProps {
  badge?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({
  badge,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {badge && <div>{badge}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-[#1E1D1A] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-[#5B564D]">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  icon,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon && <span className="text-[#1A4D38]">{icon}</span>}
        <div>
          <h2 className="text-sm font-semibold text-[#1E1D1A] sm:text-base">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#5B564D]">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

