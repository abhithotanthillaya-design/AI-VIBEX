import type { ReactNode } from 'react'

interface NavigationItemProps {
  label: string
  active: boolean
  icon?: ReactNode
  onClick: () => void
  fullWidth?: boolean
}

export function NavigationItem({
  label,
  active,
  icon,
  onClick,
  fullWidth = false,
}: NavigationItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
        fullWidth ? 'w-full justify-start px-3.5 py-2.5' : ''
      } ${
        active
          ? 'bg-[#FCFBF8] text-[#1A4D38] shadow-xs ring-1 ring-[#D8D0C1]'
          : 'text-[#5B564D] hover:bg-[#FCFBF8]/60 hover:text-[#1E1D1A]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

