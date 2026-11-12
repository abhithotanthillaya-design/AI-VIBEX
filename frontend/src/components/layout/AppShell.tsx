import type { ReactNode } from 'react'
import { ChefHat, LayoutDashboard, UtensilsCrossed, Wifi, WifiOff } from 'lucide-react'

export type AppView = 'student' | 'kitchen' | 'manager'

interface AppShellProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
  apiConnected: boolean | null
  children: ReactNode
}

export function AppShell({
  activeView,
  onViewChange,
  apiConnected,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-stone-900">
                  QUEUELESS
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200">
                  Campus Canteen
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Capacity-aware pre-order &amp; pickup scheduler
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
              aria-label="Workspace switcher"
              className="inline-flex rounded-xl border border-stone-200 bg-stone-100/80 p-1"
            >
              <button
                type="button"
                onClick={() => onViewChange('student')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeView === 'student'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                <span>Student</span>
              </button>
              <button
                type="button"
                onClick={() => onViewChange('kitchen')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeView === 'kitchen'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ChefHat className="h-4 w-4" aria-hidden="true" />
                <span>Kitchen</span>
              </button>
              <button
                type="button"
                onClick={() => onViewChange('manager')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeView === 'manager'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                <span>Manager</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-stone-200/70 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-stone-500 sm:px-6">
          <span>QUEUELESS · Campus Canteen Pre-Order Prototype</span>
          <span>
            Deterministic capacity-aware pickup scheduling · Demo mode (no live
            payments)
          </span>
        </div>
      </footer>
    </div>
  )
}

