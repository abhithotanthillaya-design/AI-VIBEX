import { ArrowLeft, ShieldAlert } from 'lucide-react'
import type { AuthenticatedUser } from '../types'
import {
  getDefaultDashboardRoute,
  getRoleDisplayLabel,
  type AppRoute,
} from '../utils/auth'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

interface UnauthorizedPageProps {
  currentUser: AuthenticatedUser | null
  onNavigate: (route: AppRoute) => void
}

export function UnauthorizedPage({
  currentUser,
  onNavigate,
}: UnauthorizedPageProps) {
  const fallbackRoute = currentUser
    ? getDefaultDashboardRoute(currentUser.role)
    : '/login'

  return (
    <section className="mx-auto max-w-lg py-8">
      <Card className="border-rose-200 bg-white p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-stone-900">
            Access Denied
          </h1>
          <p className="text-sm text-stone-600">
            {currentUser
              ? `Your account (${getRoleDisplayLabel(currentUser.role)}) does not have permission to open that workspace.`
              : 'You must sign in with an authorized account to view this page.'}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => onNavigate(fallbackRoute)}
            icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            {currentUser
              ? `Return to ${getRoleDisplayLabel(currentUser.role)} Dashboard`
              : 'Go to Sign In'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onNavigate('/')}
          >
            Home
          </Button>
        </div>
      </Card>
    </section>
  )
}

