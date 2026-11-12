import { ChefHat, RefreshCw } from 'lucide-react'
import type { HealthResponse } from '../types'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/StatusBadge'

interface KitchenPageProps {
  health: HealthResponse | null
  healthError: string | null
  isCheckingHealth: boolean
  onCheckHealth: () => void
}

export function KitchenPage({
  health,
  healthError,
  isCheckingHealth,
  onCheckHealth,
}: KitchenPageProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Kitchen Operations · Foundation Ready
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Kitchen Live Queue
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Active order queue, slot workload meters, and status progression
            controls will connect here in Phase 4.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={isCheckingHealth}
          onClick={onCheckHealth}
          icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          Refresh Connection
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ChefHat className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                Order Lifecycle Tokens Ready
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {healthError
                  ? healthError
                  : health
                    ? `Connected to ${health.service} (${health.database}) at ${health.timestamp}`
                    : 'Checking backend connection...'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge status="PLACED" />
            <StatusBadge status="ACCEPTED" />
            <StatusBadge status="PREPARING" />
            <StatusBadge status="READY" />
          </div>
        </div>
      </Card>
    </section>
  )
}

