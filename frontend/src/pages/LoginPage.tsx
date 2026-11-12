import { useRef, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, UserPlus } from 'lucide-react'
import { loginUser } from '../api/client'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { AuthSessionResponse } from '../types'
import {
  executeGuardedAuthSubmit,
  validateLoginForm,
  type AppRoute,
} from '../utils/auth'

interface LoginPageProps {
  notice: string | null
  onClearNotice: () => void
  onLoginSuccess: (session: AuthSessionResponse) => void
  onNavigate: (route: AppRoute) => void
}

export function LoginPage({
  notice,
  onClearNotice,
  onLoginSuccess,
  onNavigate,
}: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const guardRef = useRef(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onClearNotice()
    setErrorMessage(null)

    const validation = validateLoginForm(email, password)
    if (!validation.ok) {
      setErrorMessage(validation.error)
      return
    }

    setIsSubmitting(true)
    const outcome = await executeGuardedAuthSubmit(
      validation.payload,
      guardRef,
      loginUser,
    )
    setIsSubmitting(false)

    if (outcome.status === 'ignored_duplicate') {
      return
    }
    if (outcome.status === 'error') {
      setErrorMessage(outcome.message)
      return
    }

    onLoginSuccess(outcome.session)
  }

  return (
    <section className="mx-auto max-w-md py-4">
      <Card className="overflow-hidden p-6 sm:p-7 space-y-5">
        <div className="space-y-1.5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            Sign in to QUEUELESS
          </h1>
          <p className="text-xs leading-relaxed text-stone-600">
            Campus canteen pre-ordering and operations portal. Sign in with your
            Student, Canteen Staff, or Manager account — your dashboard is routed
            from your verified role on the server.
          </p>
        </div>

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
          >
            {notice}
          </div>
        )}

        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-stone-700"
            >
              Email Address <span className="text-rose-600">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@campus.edu"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-stone-700"
            >
              Password <span className="text-rose-600">*</span>
            </label>
            <div className="relative mt-1">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-3 pr-10 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
            className="w-full"
            icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="space-y-3 border-t border-stone-100 pt-4 text-xs text-stone-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>New campus student?</span>
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create Student Account</span>
            </button>
          </div>
          <p className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-2.5 text-[11px] leading-relaxed text-stone-500">
            Canteen Staff and Manager accounts are provisioned by an authorized
            Manager. Forgot password? In this prototype, please contact an
            authorized canteen manager or administrator for recovery assistance.
          </p>
        </div>
      </Card>
    </section>
  )
}

