import { useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { loginUser } from '../api/client'
import { BrandMark, BrandWordmark } from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormField, Input } from '../components/ui/FormControls'
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
    <section className="mx-auto max-w-4xl py-3 sm:py-6 ql-animate-enter">
      <Card className="grid overflow-hidden border-[#D8D0C1] lg:grid-cols-[0.92fr_1.08fr]">
        {/* Architectural Forest Panel */}
        <div className="flex flex-col justify-between bg-[#1A4D38] p-6 text-[#FCFBF8] sm:p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <BrandMark size="md" inverted />
              <BrandWordmark inverted showTagline />
            </div>

            <div className="space-y-2.5 pt-2">
              <h2 className="text-2xl font-semibold tracking-tight text-[#FCFBF8]">
                Welcome back to the canteen counter
              </h2>
              <p className="text-xs leading-relaxed text-[#E3EFE8]/85 sm:text-sm">
                One unified sign-in serves Students, Canteen Staff, and Managers.
                Your role is verified on the server and routes you directly to
                your workspace.
              </p>
            </div>

            <ul className="space-y-2.5 border-t border-[#FCFBF8]/15 pt-5 text-xs text-[#E3EFE8]/90">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E3EFE8]" aria-hidden="true" />
                <span>HttpOnly session cookies protect your account cleanly</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E3EFE8]" aria-hidden="true" />
                <span>Orders, QR passes, and tracking stay private to you</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E3EFE8]" aria-hidden="true" />
                <span>Argon2id credential verification &amp; CSRF defense</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 rounded-xl border border-[#FCFBF8]/15 bg-[#143B2B]/80 p-3.5 text-[11px] leading-relaxed text-[#E3EFE8]/85">
            <p className="font-semibold text-[#FCFBF8]">
              Staff &amp; Manager Accounts
            </p>
            <p className="mt-1">
              Issued directly by an authorized Canteen Manager. Public sign-up
              creates Student accounts only.
            </p>
          </div>
        </div>

        {/* Form Surface */}
        <div className="flex flex-col justify-center bg-[#FCFBF8] p-6 sm:p-8">
          <div className="space-y-1.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="pt-1 text-xl font-semibold tracking-tight text-[#1E1D1A] sm:text-2xl">
              Sign in to QUEUELESS
            </h1>
            <p className="text-xs leading-relaxed text-[#5B564D]">
              Enter your registered email and password to continue.
            </p>
          </div>

          {notice && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-[#E7D4AF] bg-[#FBF4E4] px-3.5 py-2.5 text-xs font-medium text-[#7D5214]"
            >
              {notice}
            </div>
          )}

          <form
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
            className="mt-5 space-y-4"
          >
            <FormField id="login-email" label="Email Address" required>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@campus.edu"
              />
            </FormField>

            <FormField id="login-password" label="Password" required>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B564D] hover:bg-[#EFEAE0] hover:text-[#1E1D1A] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </FormField>

            <p className="flex items-center gap-1.5 text-[11px] text-[#787166]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1A4D38]" aria-hidden="true" />
              <span>
                Active HttpOnly session stays signed in automatically while valid.
              </span>
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#E7BDBD] bg-[#FBEDED] px-3 py-2.5 text-xs text-[#842323]"
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

          <div className="mt-6 space-y-3 border-t border-[#E4DED2] pt-4 text-xs text-[#5B564D]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>New student on campus?</span>
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#1A4D38] hover:text-[#143B2B] cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Create Student Account</span>
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#787166]">
              Need password recovery? Please contact an authorized canteen
              manager for account assistance.
            </p>
          </div>
        </div>
      </Card>
    </section>
  )
}
