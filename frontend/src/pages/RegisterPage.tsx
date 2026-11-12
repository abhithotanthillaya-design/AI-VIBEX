import { useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react'
import { registerStudent } from '../api/client'
import { BrandMark, BrandWordmark } from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormField, Input } from '../components/ui/FormControls'
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
    <section className="mx-auto max-w-4xl py-3 sm:py-6 ql-animate-enter">
      <Card className="grid overflow-hidden border-[#D8D0C1] lg:grid-cols-[0.88fr_1.12fr]">
        {/* Architectural Forest Panel */}
        <div className="flex flex-col justify-between bg-[#1A4D38] p-6 text-[#FCFBF8] sm:p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <BrandMark size="md" inverted />
              <BrandWordmark inverted showTagline />
            </div>

            <div className="space-y-2.5 pt-2">
              <h2 className="text-2xl font-semibold tracking-tight text-[#FCFBF8]">
                Pre-order smarter between lectures
              </h2>
              <p className="text-xs leading-relaxed text-[#E3EFE8]/85 sm:text-sm">
                Create your personal QUEUELESS student account to reserve pickup
                windows, save allergen notes, and collect via QR pass.
              </p>
            </div>

            <ul className="space-y-2.5 border-t border-[#FCFBF8]/15 pt-5 text-xs text-[#E3EFE8]/90">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E3EFE8]" aria-hidden="true" />
                <span>Chronological 5-min pickup window selection</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E3EFE8]" aria-hidden="true" />
                <span>Order in your own words against live menu stock</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E3EFE8]" aria-hidden="true" />
                <span>Account-private order history &amp; live progress tracker</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 rounded-xl border border-[#FCFBF8]/15 bg-[#143B2B]/80 p-3.5 text-[11px] leading-relaxed text-[#E3EFE8]/85">
            Public registration always assigns the{' '}
            <strong className="text-[#FCFBF8]">Student</strong> role. Staff and
            Manager accounts are provisioned internally.
          </div>
        </div>

        {/* Form Surface */}
        <div className="bg-[#FCFBF8] p-6 sm:p-8">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1A4D38] hover:text-[#143B2B] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Sign In</span>
          </button>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[#1E1D1A]">
                Student Registration
              </h1>
              <p className="text-xs text-[#5B564D]">
                Create your personal ordering account
              </p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
            className="mt-5 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="register-full-name" label="Full Name" required>
                <Input
                  id="register-full-name"
                  type="text"
                  autoComplete="name"
                  required
                  disabled={isSubmitting}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  maxLength={80}
                />
              </FormField>

              <FormField
                id="register-roll"
                label="Student ID / Roll No"
                hint="Optional"
              >
                <Input
                  id="register-roll"
                  type="text"
                  disabled={isSubmitting}
                  value={studentRollNo}
                  onChange={(event) => setStudentRollNo(event.target.value)}
                  placeholder="e.g. 22CS042"
                  maxLength={40}
                />
              </FormField>
            </div>

            <FormField id="register-email" label="Email Address" required>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@campus.edu"
                maxLength={254}
              />
            </FormField>

            <FormField
              id="register-password"
              label="Password"
              required
              hint="Minimum 8 characters, including at least one letter and one number."
            >
              <div className="relative">
                <Input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Min 8 chars with letters & numbers"
                  maxLength={128}
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

            <FormField
              id="register-confirm-password"
              label="Confirm Password"
              required
            >
              <div className="relative">
                <Input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  maxLength={128}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B564D] hover:bg-[#EFEAE0] hover:text-[#1E1D1A] cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </FormField>

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
            >
              {isSubmitting
                ? 'Creating Student Account...'
                : 'Create Student Account'}
            </Button>
          </form>
        </div>
      </Card>
    </section>
  )
}
