import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonVariant = 'ghost' | 'outline' | 'subtle'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: IconButtonVariant
  size?: 'sm' | 'md'
  children: ReactNode
}

const VARIANT_MAP: Record<IconButtonVariant, string> = {
  ghost: 'text-[#5B564D] hover:bg-[#EFEAE0] hover:text-[#1E1D1A]',
  outline:
    'border border-[#D8D0C1] bg-[#FCFBF8] text-[#1E1D1A] hover:bg-[#EFEAE0]/70',
  subtle: 'bg-[#E3EFE8] text-[#1A4D38] hover:bg-[#D2E6DA]',
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: IconButtonProps) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'

  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${VARIANT_MAP[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

