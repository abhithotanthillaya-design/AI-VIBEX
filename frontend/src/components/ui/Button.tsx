import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900 shadow-xs',
  secondary:
    'bg-white text-stone-900 border border-stone-300 hover:bg-stone-50 active:bg-stone-100',
  ghost:
    'bg-transparent text-stone-700 hover:bg-stone-100 active:bg-stone-200',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg min-h-9',
  md: 'px-4 py-2.5 text-sm rounded-xl min-h-10',
  lg: 'px-5 py-3 text-base rounded-xl min-h-12',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  )
}

