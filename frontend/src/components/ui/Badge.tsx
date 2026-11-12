import type { ReactNode } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'forest'
  | 'sage'
  | 'saffron'
  | 'terracotta'
  | 'danger'
  | 'info'

interface BadgeProps {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-[#D8D0C1] bg-[#EFEAE0]/70 text-[#5B564D]',
  forest: 'border-[#BDD6C7] bg-[#E3EFE8] text-[#143B2B]',
  sage: 'border-[#C5D4CA] bg-[#ECF3EE] text-[#2F533E]',
  saffron: 'border-[#E7D4AF] bg-[#FBF4E4] text-[#7D5214]',
  terracotta: 'border-[#E8C6B8] bg-[#F9ECE6] text-[#8E3F23]',
  danger: 'border-[#E7BDBD] bg-[#FBEDED] text-[#842323]',
  info: 'border-[#C2D6E8] bg-[#ECF4FA] text-[#1D4B73]',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight ${TONE_CLASSES[tone]} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  )
}

