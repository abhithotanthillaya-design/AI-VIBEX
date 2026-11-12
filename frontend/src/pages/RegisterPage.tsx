import { useRef, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowLeft, Eye, EyeOff, UserPlus } from 'lucide-react'
import { registerStudent } from '../api/client'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { AuthSessionResponse } from '../types'
import {
  executeGuardedAuthSubmit,
  validateRegistrationForm,
  type AppRoute,
} from '../utils/auth'

interface RegisterPageProps {
  onRegisterSuccess: (session: AuthSessionResponse) => void
  onNavigate: (route: AppRoute) => void
}

export function RegisterPage({
  onRegisterSuccess,
  onNavigate,
}: RegisterPageProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [studentRollNo, setStudentRollNo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const guardRef = useRef(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const validation = validateRegistrationForm({
      fullName,
      email,
      password,
      confirmPassword,
      studentRollNo,
    })
    if (!validation.ok) {
      setErrorMessage(validation.error)
      return
    }

    setIsSubmitting(true)
    const outcome = await executeGuardedAuthSubmit(
      validation.payload,
      guardRef,
      registerStudent,
    )
    setIsSubmitting(false)

    if (outcome.status === 'ignored_duplicate') {
      return
    }
    if (outcome.status === 'error') {
      setErrorMessage(outcome.message)
      return
    }

    onRegisterSuccess(outcome.session)
  }

  return (
    <section className="mx-auto max-w-md py-4">
      <Card className="overflow-hidden p-6 sm:p-7 space-y-5">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Sign In</span>
          </button>

          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                Student Registration
              </h1>
              <p className="text-xs text-stone-600">
                Create your personal QUEUELESS student ordering account
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="register-full-name"
              className="block text-xs font-medium text-stone-700"
            >
              Full Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="register-full-name"
              type="text"
              autoComplete="name"
              required
              disabled={isSubmitting}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="e.g. Aarav Sharma"
              maxLength={80}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-xs font-medium text-stone-700"
            >
              Email Address <span className="text-rose-600">*</span>
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              maxLength={254}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="register-roll"
              className="block text-xs font-medium text-stone-700"
            >
              Student ID / Registration Number (optional)
            </label>
            <input
              id="register-roll"
              type="text"
              disabled={isSubmitting}
              value={studentRollNo}
              onChange={(event) => setStudentRollNo(event.target.value)}
              placeholder="e.g. CS2026-042"
              maxLength={40}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-xs font-medium text-stone-700"
            >
              Password <span className="text-rose-600">*</span>
            </label>
            <div className="relative mt-1">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Min 8 characters with letters & numbers"
                maxLength={128}
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
            <p className="mt-1 text-[11px] text-stone-500">
              Minimum 8 characters, including at least one letter and one number.
            </p>
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="block text-xs font-medium text-stone-700"
            >
              Confirm Password <span className="text-rose-600">*</span>
            </label>
            <div className="relative mt-1">
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                maxLength={128}
                className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-3 pr-10 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
              >
                {showConfirmPassword ? (
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
          >
            {isSubmitting ? 'Creating Student Account...' : 'Create Student Account'}
          </Button>
        </form>

        <p className="border-t border-stone-100 pt-3 text-center text-[11px] text-stone-500">
          Public registration creates a <strong>Student</strong> role account
          only. Staff &amp; Manager accounts are created internally.
        </p>
      </Card>
    </section>
  )
}

