import { useState, type ReactNode } from 'react'
import {
  ChefHat,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  UserCircle2,
  UserPlus,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import type { AuthenticatedUser } from '../../types'
import {
  getDefaultDashboardRoute,
  getRoleDisplayLabel,
  type AppRoute,
} from '../../utils/auth'
import { BrandMark, BrandWordmark } from '../brand/BrandMark'
import { NavigationItem } from '../ui/NavigationItem'
import { UserMenu } from '../ui/UserMenu'

export type AppView = 'student' | 'kitchen' | 'manager'

interface AppShellProps {
  currentUser: AuthenticatedUser | null
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  onLogout: () => void
  isLoggingOut?: boolean
  apiConnected: boolean | null
  children: ReactNode
}

export function AppShell({
  currentUser,
  activeRoute,
  onNavigate,
  onLogout,
  isLoggingOut = false,
  apiConnected,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems: {
    route: AppRoute
    label: string
    icon: typeof UtensilsCrossed
  }[] = !currentUser
    ? [
        { route: '/', label: 'Home', icon: Home },
        { route: '/login', label: 'Sign In', icon: LogIn },
        { route: '/register', label: 'Register', icon: UserPlus },
      ]
    : currentUser.role === 'STUDENT'
      ? [
          { route: '/student', label: 'Menu & Orders', icon: UtensilsCrossed },
          { route: '/profile', label: 'Profile', icon: UserCircle2 },
        ]
      : currentUser.role === 'CANTEEN_STAFF'
        ? [
            { route: '/kitchen', label: 'Kitchen Queue', icon: ChefHat },
            { route: '/profile', label: 'Profile', icon: UserCircle2 },
          ]
        : [
            { route: '/kitchen', label: 'Kitchen', icon: ChefHat },
            { route: '/manager', label: 'Manager', icon: LayoutDashboard },
            { route: '/profile', label: 'Profile', icon: UserCircle2 },
          ]

  const handleNavClick = (route: AppRoute) => {
    setMobileMenuOpen(false)
    onNavigate(route)
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#F7F4ED] text-[#1E1D1A]">
      <header className="sticky top-0 z-30 border-b border-[#E4DED2] bg-[#FCFBF8]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() =>
              handleNavClick(
                currentUser ? getDefaultDashboardRoute(currentUser.role) : '/',
              )
            }
            className="flex items-center gap-3 text-left cursor-pointer"
          >
            <BrandMark size="md" />
            <BrandWordmark showTagline />
          </button>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-3 md:flex">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                apiConnected === true
                  ? 'border-[#BDD6C7] bg-[#E3EFE8] text-[#143B2B]'
                  : apiConnected === false
                    ? 'border-[#E7BDBD] bg-[#FBEDED] text-[#842323]'
                    : 'border-[#D8D0C1] bg-[#EFEAE0] text-[#5B564D]'
              }`}
              aria-label={
                apiConnected === true
                  ? 'API Connected'
                  : apiConnected === false
                    ? 'API Offline'
                    : 'Checking API'
              }
            >
              {apiConnected === false ? (
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {apiConnected === true
                  ? 'Live API'
                  : apiConnected === false
                    ? 'API Offline'
                    : 'Connecting...'}
              </span>
            </div>

            <nav
              aria-label="Primary navigation"
              className="inline-flex items-center gap-1 rounded-xl border border-[#E4DED2] bg-[#EFEAE0]/70 p-1"
            >
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavigationItem
                    key={item.route}
                    label={item.label}
                    active={activeRoute === item.route}
                    onClick={() => handleNavClick(item.route)}
                    icon={<Icon className="h-4 w-4" aria-hidden="true" />}
                  />
                )
              })}
            </nav>

            {currentUser && (
              <UserMenu
                user={currentUser}
                onNavigate={handleNavClick}
                onLogout={onLogout}
                isLoggingOut={isLoggingOut}
              />
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-2 md:hidden">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                apiConnected === true
                  ? 'border-[#BDD6C7] bg-[#E3EFE8] text-[#143B2B]'
                  : apiConnected === false
                    ? 'border-[#E7BDBD] bg-[#FBEDED] text-[#842323]'
                    : 'border-[#D8D0C1] bg-[#EFEAE0] text-[#5B564D]'
              }`}
              title={
                apiConnected === true
                  ? 'API Connected'
                  : apiConnected === false
                    ? 'API Offline'
                    : 'Connecting...'
              }
              aria-label={
                apiConnected === true
                  ? 'API Connected'
                  : apiConnected === false
                    ? 'API Offline'
                    : 'Checking API'
              }
            >
              {apiConnected === false ? (
                <WifiOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Wifi className="h-4 w-4" aria-hidden="true" />
              )}
            </span>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8D0C1] bg-[#FCFBF8] text-[#1E1D1A] hover:bg-[#EFEAE0]/70 cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile slide-down drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-[#E4DED2] bg-[#FCFBF8] px-4 py-3.5 md:hidden ql-animate-enter">
            {currentUser && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-[#E4DED2] bg-[#F7F4ED] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1E1D1A]">
                    {currentUser.full_name}
                  </p>
                  <p className="truncate text-xs text-[#5B564D]">
                    {currentUser.email}
                  </p>
                </div>
                <span className="ml-2 shrink-0 rounded-full border border-[#BDD6C7] bg-[#E3EFE8] px-2.5 py-0.5 text-[11px] font-medium text-[#143B2B]">
                  {getRoleDisplayLabel(currentUser.role)}
                </span>
              </div>
            )}

            <nav aria-label="Mobile navigation" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavigationItem
                    key={item.route}
                    label={item.label}
                    active={activeRoute === item.route}
                    fullWidth
                    onClick={() => handleNavClick(item.route)}
                    icon={<Icon className="h-4 w-4" aria-hidden="true" />}
                  />
                )
              })}
            </nav>

            {currentUser && (
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => {
                  setMobileMenuOpen(false)
                  onLogout()
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7BDBD] bg-[#FBEDED] px-4 py-2.5 text-sm font-medium text-[#842323] cursor-pointer disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
              </button>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-[#E4DED2] bg-[#FCFBF8]/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-[#5B564D] sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-wider text-[#1E1D1A]">
              QUEUELESS
            </span>
            <span>·</span>
            <span>Skip the queue. Not your meal.</span>
          </div>
          <span>
            Capacity-aware 5-min pickup windows · Role-secured campus canteen platform
          </span>
        </div>
      </footer>
    </div>
  )
}
