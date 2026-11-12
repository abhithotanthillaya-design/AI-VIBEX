import {
  ArrowRight,
  ChefHat,
  Clock,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UtensilsCrossed,
} from 'lucide-react'
import type { AuthenticatedUser } from '../types'
import {
  getDefaultDashboardRoute,
  getRoleDisplayLabel,
  type AppRoute,
} from '../utils/auth'
import { ParticleWordmark } from '../components/brand/ParticleWordmark'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

interface LandingPageProps {
  currentUser: AuthenticatedUser | null
  onNavigate: (route: AppRoute) => void
}

const SEQUENCE_STEPS = [
  {
    step: '01',
    title: 'Browse Canteen Menu',
    description:
      'Explore freshly prepared dishes, dietary filters, allergen disclosures, and prep weights.',
    icon: UtensilsCrossed,
  },
  {
    step: '02',
    title: 'Place Pre-Order',
    description:
      'Build your cart visually or via plain-language requests with kitchen preparation notes.',
    icon: Sparkles,
  },
  {
    step: '03',
    title: 'Receive Pickup Slot',
    description:
      'Select or get an atomic 5-minute window aligned to real-time kitchen workload capacity.',
    icon: Clock,
  },
  {
    step: '04',
    title: 'Track Preparation',
    description:
      'Follow live progress across Placed, Accepted, Preparing, and Ready for Pickup.',
    icon: ChefHat,
  },
  {
    step: '05',
    title: 'Collect via QR Pass',
    description:
      'Scan your one-time cryptographic QR pass or 4-character pickup code at the counter.',
    icon: QrCode,
  },
]

const SHOWCASE_ITEMS = [
  {
    name: 'Masala Dosa',
    meta: 'Meals · 6m prep',
    price: '₹65',
    image: '/images/menu/masala-dosa.jpg',
  },
  {
    name: 'Veg Grilled Sandwich',
    meta: 'Fast Food · 4m prep',
    price: '₹50',
    image: '/images/menu/veg-grilled-sandwich.jpg',
  },
  {
    name: 'Masala Chai',
    meta: 'Beverages · 2m prep',
    price: '₹20',
    image: '/images/menu/masala-chai.jpg',
  },
]

export function LandingPage({ currentUser, onNavigate }: LandingPageProps) {
  const handleOrderNow = () => {
    if (currentUser) {
      onNavigate(getDefaultDashboardRoute(currentUser.role))
    } else {
      onNavigate('/login')
    }
  }

  return (
    <section className="space-y-12 py-2 sm:py-4">
      {/* Hero section */}
      <Card className="overflow-hidden border-[#D8D0C1] bg-[#FCFBF8]">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
          <div className="space-y-5">
            <Badge tone="forest" icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}>
              Campus Canteen Pre-Ordering &amp; Slot Orchestration
            </Badge>

            <div>
              <ParticleWordmark />
              <p
                className="mt-2 font-medium text-[#1A4D38] text-xl sm:text-2xl tracking-tight ql-animate-enter"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Skip the queue. Not your meal.
              </p>
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-[#5B564D] sm:text-base ql-animate-enter ql-stagger-1">
              Pre-order hot campus meals between classes into capacity-checked
              5-minute pickup windows. Kitchen staff stay ahead of rush hours,
              and students walk straight to the counter when food is ready.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 ql-animate-enter ql-stagger-2">
              <Button
                type="button"
                size="lg"
                variant="primary"
                onClick={handleOrderNow}
                icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                {currentUser
                  ? `Open ${getRoleDisplayLabel(currentUser.role)} Dashboard`
                  : 'Order Now'}
              </Button>

              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#D8D0C1] bg-[#FCFBF8] px-5 py-3 text-sm font-medium text-[#1E1D1A] transition-colors hover:bg-[#EFEAE0]/70 sm:text-base"
              >
                Explore How It Works
              </a>

              {!currentUser && (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  onClick={() => onNavigate('/register')}
                  icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                >
                  Student Sign Up
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E4DED2] pt-4 text-xs text-[#5B564D]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#1A4D38]" aria-hidden="true" />
                Role-verified sessions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#1A4D38]" aria-hidden="true" />
                5-minute balanced pickup slots
              </span>
              <span className="inline-flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-[#1A4D38]" aria-hidden="true" />
                One-time counter QR verification
              </span>
            </div>
          </div>

          {/* Visual ordering preview composition */}
          <div className="rounded-2xl border border-[#D8D0C1] bg-[#F7F4ED] p-4 sm:p-5 ql-animate-enter ql-stagger-2">
            <div className="flex items-center justify-between gap-2 border-b border-[#E4DED2] pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5B564D]">
                  Live Pickup Window Preview
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#1E1D1A] tabular-nums">
                  12:20 PM – 12:25 PM · IST
                </p>
              </div>
              <Badge tone="forest">4 units left</Badge>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {SHOWCASE_ITEMS.map((dish) => (
                <div
                  key={dish.name}
                  className="flex items-center gap-3 rounded-xl border border-[#E4DED2] bg-[#FCFBF8] p-2.5"
                >
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="h-12 w-14 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1E1D1A]">
                      {dish.name}
                    </p>
                    <p className="text-[11px] text-[#5B564D]">{dish.meta}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#1A4D38] tabular-nums">
                    {dish.price}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3.5 flex items-center justify-between rounded-xl border border-[#BDD6C7] bg-[#E3EFE8]/75 px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A4D38] text-[#FCFBF8]">
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[#143B2B]">
                    Zero-Wait Counter Pass
                  </p>
                  <p className="text-[11px] text-[#2F533E]">
                    Capacity checked before checkout confirms
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold tracking-wider text-[#143B2B]">
                Q7K2
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 5-step product walkthrough */}
      <div id="how-it-works" className="scroll-mt-24 space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1A4D38]">
              How QUEUELESS Works
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1E1D1A]">
              From menu selection to zero-queue pickup
            </h2>
          </div>
          <p className="text-xs text-[#5B564D]">
            Deterministic slot balancing — built for campus lunch breaks
          </p>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {SEQUENCE_STEPS.map((item) => {
            const Icon = item.icon
            return (
              <Card
                key={item.step}
                className="flex flex-col justify-between p-4.5 transition-colors hover:border-[#C7BFA9]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#C25E3A]">
                      {item.step}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[#1E1D1A]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#5B564D]">
                    {item.description}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Role-specific platform workflows */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1A4D38]">
            Tailored Workspaces
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1E1D1A]">
            One connected platform for students, kitchen &amp; management
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
              <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1E1D1A]">
                Student Portal
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#5B564D]">
                Self-register safely to browse dietary-filtered dishes, order in
                your own words, reserve open 5-minute pickup slots, and track live
                QR passes across your order history.
              </p>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBF4E4] text-[#7D5214]">
              <ChefHat className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1E1D1A]">
                Kitchen Operations
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#5B564D]">
                Staff view tickets grouped chronologically by pickup slot, read
                special dietary notes upfront, advance prep stages cleanly, and
                verify student collections via QR scanner.
              </p>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F9ECE6] text-[#8E3F23]">
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1E1D1A]">
                Manager Console
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#5B564D]">
                Managers oversee real-time IST sales, menu CRUD with allergen
                tags, pickup slot capacities &amp; emergency closures, and staff
                account provisioning.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
