import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'muted' | 'forest'
  children?: ReactNode
}

const TONE_MAP = {
  default: 'border-[#E4DED2] bg-[#FCFBF8]',
  muted: 'border-[#E4DED2] bg-[#EFEAE0]/55',
  forest: 'border-[#C5DACD] bg-[#E3EFE8]/45',
}

export function Card({
  tone = 'default',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border shadow-[0_1px_2px_rgba(30,29,26,0.04)] ${TONE_MAP[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
