import {
  ArrowRight,
  ChefHat,
  Clock,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  UserPlus,
  UtensilsCrossed,
} from 'lucide-react'
import type { AuthenticatedUser } from '../types'
import { getDefaultDashboardRoute, getRoleDisplayLabel, type AppRoute } from '../utils/auth'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

interface LandingPageProps {
  currentUser: AuthenticatedUser | null
  onNavigate: (route: AppRoute) => void
}

export function LandingPage({ currentUser, onNavigate }: LandingPageProps) {
  return (
    <section className="space-y-8 py-4">
      <Card className="overflow-hidden border-emerald-200/80 bg-white">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>QUEUELESS · Campus Canteen Pre-Ordering</span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              Pre-order campus meals without counter queues
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
              Students browse live menu availability and reserve capacity-checked
              5-minute pickup slots. Kitchen staff manage tickets by window and
              verify collections via one-time QR codes. Canteen managers oversee
              menu, sales, slots, and staff access.
            </p>

            {currentUser ? (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  size="lg"
                  variant="primary"
                  onClick={() =>
                    onNavigate(getDefaultDashboardRoute(currentUser.role))
                  }
                  icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                >
                  Go to {getRoleDisplayLabel(currentUser.role)} Dashboard
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  onClick={() => onNavigate('/profile')}
                >
                  View Account Profile
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  size="lg"
                  variant="primary"
                  onClick={() => onNavigate('/login')}
                  icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                >
                  Sign In to Dashboard
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  onClick={() => onNavigate('/register')}
                  icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                >
                  Student Registration
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-stone-200 bg-[#faf8f5] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Role-Protected Platform Access
            </h2>
            <div className="space-y-2.5 text-xs text-stone-700">
              <div className="flex items-start gap-2.5 rounded-xl border border-stone-200/80 bg-white p-3">
                <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-stone-900">Students</p>
                  <p className="text-stone-600">
                    Self-register to order, select slots, track QR tickets, and
                    view your own order history.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-stone-200/80 bg-white p-3">
                <ChefHat className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-stone-900">Canteen Staff</p>
                  <p className="text-stone-600">
                    Sign in with manager-issued credentials to manage preparation
                    status and verify pickup QR codes.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-stone-200/80 bg-white p-3">
                <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-stone-900">Managers</p>
                  <p className="text-stone-600">
                    Manage menu pricing, dietary labels, sales analytics, slot
                    capacity, and staff provisioning.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 space-y-2">
          <Clock className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-stone-900">
            Capacity-Aware 5-Min Slots
          </h2>
          <p className="text-xs leading-relaxed text-stone-600">
            Serialized SQLite slot allocation prevents counter overbooking and
            shifts overflow cleanly to the next open pickup window.
          </p>
        </Card>
        <Card className="p-5 space-y-2">
          <QrCode className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-stone-900">
            Cryptographic Pickup QR
          </h2>
          <p className="text-xs leading-relaxed text-stone-600">
            Each order issues a high-entropy one-time QR token stored only as its
            SHA-256 hash on the server alongside a 4-character pickup code.
          </p>
        </Card>
        <Card className="p-5 space-y-2">
          <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-stone-900">
            HttpOnly Session Security
          </h2>
          <p className="text-xs leading-relaxed text-stone-600">
            Argon2id password hashing, server-side expiring sessions, CSRF
            validation, and backend role checks on every route.
          </p>
        </Card>
      </div>
    </section>
  )
}

