import type { ReactNode } from 'react'
import {
  ChefHat,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  UserCircle2,
  UserPlus,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type { AuthenticatedUser } from '../../types'
import { type AppRoute, getRoleDisplayLabel } from '../../utils/auth'

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
  const navItems: { route: AppRoute; label: string; icon: typeof UtensilsCrossed }[] =
    !currentUser
      ? [
          { route: '/', label: 'Home', icon: Home },
          { route: '/login', label: 'Sign In', icon: LogIn },
          { route: '/register', label: 'Register', icon: UserPlus },
        ]
      : currentUser.role === 'STUDENT'
        ? [
            { route: '/student', label: 'Student Menu', icon: UtensilsCrossed },
            { route: '/profile', label: 'Profile', icon: UserCircle2 },
          ]
        : currentUser.role === 'CANTEEN_STAFF'
          ? [
              { route: '/kitchen', label: 'Kitchen', icon: ChefHat },
              { route: '/profile', label: 'Profile', icon: UserCircle2 },
            ]
          : [
              { route: '/kitchen', label: 'Kitchen', icon: ChefHat },
              { route: '/manager', label: 'Manager', icon: LayoutDashboard },
              { route: '/profile', label: 'Profile', icon: UserCircle2 },
            ]

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#faf8f5] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() =>
              onNavigate(
                currentUser
                  ? currentUser.role === 'MANAGER'
                    ? '/manager'
                    : currentUser.role === 'CANTEEN_STAFF'
                      ? '/kitchen'
                      : '/student'
                  : '/',
              )
            }
            className="flex items-center gap-3 text-left cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-stone-900">
                  QUEUELESS
                </span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                  Campus Canteen
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Capacity-aware pre-order &amp; pickup scheduler
              </p>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                apiConnected === true
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : apiConnected === false
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-stone-200 bg-stone-100 text-stone-600'
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
              <span className="hidden sm:inline">
                {apiConnected === true
                  ? 'API Connected'
                  : apiConnected === false
                    ? 'API Offline'
                    : 'Checking API'}
              </span>
            </div>

            <nav
              aria-label="Primary navigation"
              className="inline-flex flex-wrap rounded-xl border border-stone-200 bg-stone-100/80 p-1"
            >
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeRoute === item.route
                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => onNavigate(item.route)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            {currentUser && (
              <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1">
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-semibold leading-tight text-stone-900">
                    {currentUser.full_name}
                  </p>
                  <p className="text-[10px] font-medium leading-tight text-emerald-800">
                    {getRoleDisplayLabel(currentUser.role)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isLoggingOut ? 'Signing out...' : 'Logout'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-stone-200/70 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-stone-500 sm:px-6">
          <span>QUEUELESS · Role-Based Campus Canteen Platform</span>
          <span>
            HttpOnly session cookies · Deterministic capacity-aware pickup scheduling
          </span>
        </div>
      </footer>
    </div>
  )
}
