import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/90 bg-white shadow-xs ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

