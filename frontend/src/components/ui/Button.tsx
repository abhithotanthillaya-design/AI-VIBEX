import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1A4D38] text-[#FCFBF8] hover:bg-[#143B2B] active:bg-[#0F2E21] shadow-xs hover:-translate-y-[0.5px] active:translate-y-0',
  secondary:
    'bg-[#FCFBF8] text-[#1E1D1A] border border-[#D8D0C1] hover:bg-[#EFEAE0]/70 hover:border-[#C7BFA9] active:bg-[#EFEAE0]',
  ghost:
    'bg-transparent text-[#5B564D] hover:bg-[#EFEAE0]/70 hover:text-[#1E1D1A] active:bg-[#EFEAE0]',
  danger:
    'bg-[#9F2D2D] text-[#FCFBF8] hover:bg-[#842323] active:bg-[#6E1C1C] shadow-xs',
  accent:
    'bg-[#C25E3A] text-[#FCFBF8] hover:bg-[#AA4E2E] active:bg-[#934226] shadow-xs hover:-translate-y-[0.5px] active:translate-y-0',
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
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 disabled:translate-y-0 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
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
