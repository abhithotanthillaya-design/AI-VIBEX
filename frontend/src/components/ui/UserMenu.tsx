import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LayoutDashboard, LogOut, UserCircle2 } from 'lucide-react'
import type { AuthenticatedUser } from '../../types'
import {
  getDefaultDashboardRoute,
  getRoleDisplayLabel,
  type AppRoute,
} from '../../utils/auth'

interface UserMenuProps {
  user: AuthenticatedUser
  onNavigate: (route: AppRoute) => void
  onLogout: () => void
  isLoggingOut: boolean
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'QL'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function UserMenu({
  user,
  onNavigate,
  onLogout,
  isLoggingOut,
}: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const defaultDashboard = getDefaultDashboardRoute(user.role)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="inline-flex items-center gap-2 rounded-xl border border-[#D8D0C1] bg-[#FCFBF8] px-2.5 py-1.5 text-left transition-colors hover:border-[#C2B8A6] hover:bg-[#EFEAE0]/50 cursor-pointer"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1A4D38] text-[11px] font-semibold text-[#FCFBF8]">
          {getInitials(user.full_name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[128px] truncate text-xs font-semibold leading-tight text-[#1E1D1A]">
            {user.full_name}
          </span>
          <span className="block text-[10px] font-medium leading-tight text-[#1A4D38]">
            {getRoleDisplayLabel(user.role)}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#5B564D] transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Signed-in user actions"
          className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-[#E4DED2] bg-[#FCFBF8] p-2 shadow-lg ql-animate-modal"
        >
          <div className="border-b border-[#E4DED2] px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-[#1E1D1A]">
              {user.full_name}
            </p>
            <p className="truncate text-xs text-[#5B564D]">{user.email}</p>
            <span className="mt-1.5 inline-flex rounded-full border border-[#BDD6C7] bg-[#E3EFE8] px-2 py-0.5 text-[10px] font-semibold text-[#143B2B]">
              {getRoleDisplayLabel(user.role)}
            </span>
          </div>

          <div className="mt-1.5 space-y-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onNavigate(defaultDashboard)
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#1E1D1A] transition-colors hover:bg-[#EFEAE0]/70 cursor-pointer"
            >
              <LayoutDashboard className="h-4 w-4 text-[#1A4D38]" aria-hidden="true" />
              <span>My Dashboard</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onNavigate('/profile')
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#1E1D1A] transition-colors hover:bg-[#EFEAE0]/70 cursor-pointer"
            >
              <UserCircle2 className="h-4 w-4 text-[#1A4D38]" aria-hidden="true" />
              <span>Account &amp; Password</span>
            </button>
          </div>

          <div className="mt-1.5 border-t border-[#E4DED2] pt-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={isLoggingOut}
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#9F2D2D] transition-colors hover:bg-[#FBEDED] disabled:opacity-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

