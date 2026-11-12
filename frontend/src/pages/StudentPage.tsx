import { Clock, RefreshCw, ShoppingBag } from 'lucide-react'
import type { HealthResponse } from '../types'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

interface StudentPageProps {
  health: HealthResponse | null
  healthError: string | null
  isCheckingHealth: boolean
  onCheckHealth: () => void
}

export function StudentPage({
  health,
  healthError,
  isCheckingHealth,
  onCheckHealth,
}: StudentPageProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Student Workspace · Foundation Ready
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Skip the canteen queue
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Menu browsing, cart builder, slot allocation, and live order tracking
            will connect here in upcoming phases.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={isCheckingHealth}
          onClick={onCheckHealth}
          icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          Check API Health
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                Phase 1 Foundation Active
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                React, Vite, TypeScript, Tailwind CSS, and Lucide icons are
                configured with the shared API client and design system tokens.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-stone-900">
                Backend Connection
              </h2>
              {healthError ? (
                <p className="mt-1 text-sm text-rose-700">{healthError}</p>
              ) : health ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600">
                  <div>
                    <dt className="font-medium text-stone-500">Service</dt>
                    <dd className="font-mono text-stone-900">{health.service}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-stone-500">Database</dt>
                    <dd className="font-mono text-emerald-700">
                      {health.database}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-1 text-sm text-stone-500">
                  Verifying FastAPI health endpoint...
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}

