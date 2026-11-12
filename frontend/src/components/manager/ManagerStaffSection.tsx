import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react'
import type { AuthenticatedUser, StaffCreateRequest } from '../../types'
import {
  getRoleDisplayLabel,
  validateStaffProvisionForm,
} from '../../utils/auth'
import { formatShortDateTime } from '../../utils/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface ManagerStaffSectionProps {
  staffAccounts: AuthenticatedUser[]
  currentManagerId: string
  isLoading: boolean
  isSubmitting: boolean
  togglingUserId: string | null
  onCreateStaff: (payload: StaffCreateRequest) => Promise<boolean>
  onRequestToggleStatus: (account: AuthenticatedUser) => void
}

export function ManagerStaffSection({
  staffAccounts,
  currentManagerId,
  isLoading,
  isSubmitting,
  togglingUserId,
  onCreateStaff,
  onRequestToggleStatus,
}: ManagerStaffSectionProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'CANTEEN_STAFF' | 'MANAGER'>('CANTEEN_STAFF')
  const [confirmManagerGrant, setConfirmManagerGrant] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setFormError(null)

    const validation = validateStaffProvisionForm({
      fullName,
      email,
      password,
      role,
      confirmManagerGrant,
    })
    if (!validation.ok) {
      setFormError(validation.error)
      return
    }

    const ok = await onCreateStaff(validation.payload)
    if (ok) {
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('CANTEEN_STAFF')
      setConfirmManagerGrant(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Provision Canteen Staff &amp; Authorized Access
            </h2>
            <p className="mt-0.5 text-xs text-stone-600">
              Public registration creates Student accounts only. Use this
              manager-only console to issue Canteen Staff credentials or
              explicitly grant additional Manager access.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            void handleCreate(event)
          }}
          className="space-y-4 border-t border-stone-100 pt-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="staff-full-name"
                className="block text-xs font-medium text-stone-700"
              >
                Staff Full Name *
              </label>
              <input
                id="staff-full-name"
                type="text"
                required
                disabled={isSubmitting}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="e.g. Ramesh Verma"
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="staff-email"
                className="block text-xs font-medium text-stone-700"
              >
                Email Address *
              </label>
              <input
                id="staff-email"
                type="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@campus.edu"
                maxLength={254}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="staff-password"
                className="block text-xs font-medium text-stone-700"
              >
                Temporary Password *
              </label>
              <div className="relative mt-1">
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Min 8 chars (A-z + 0-9)"
                  maxLength={128}
                  className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-3 pr-9 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="staff-role"
                className="block text-xs font-medium text-stone-700"
              >
                Assigned Role *
              </label>
              <select
                id="staff-role"
                disabled={isSubmitting}
                value={role}
                onChange={(event) => {
                  const next = event.target.value as 'CANTEEN_STAFF' | 'MANAGER'
                  setRole(next)
                  if (next !== 'MANAGER') {
                    setConfirmManagerGrant(false)
                  }
                }}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="CANTEEN_STAFF">Canteen Staff (Kitchen)</option>
                <option value="MANAGER">Manager (Full Admin)</option>
              </select>
            </div>
          </div>

          {role === 'MANAGER' && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmManagerGrant}
                disabled={isSubmitting}
                onChange={(event) => setConfirmManagerGrant(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-emerald-700 focus:ring-emerald-600"
              />
              <span>
                I explicitly authorize granting full <strong>Manager</strong>{' '}
                privileges (menu, pricing, sales, slot controls, and staff
                provisioning) to this new account.
              </span>
            </label>
          )}

          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSubmitting}
              disabled={isSubmitting}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Create Account
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-900">
            Authorized Staff &amp; Manager Accounts
          </h3>
          <p className="text-xs text-stone-500">
            Deactivating an account immediately revokes active sessions for that
            staff member.
          </p>
        </div>

        {isLoading && staffAccounts.length === 0 ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-12 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : staffAccounts.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-500">
            No staff accounts found.
          </p>
        ) : (
          <div className="divide-y divide-stone-100">
            {staffAccounts.map((acct) => {
              const isSelf = acct.id === currentManagerId
              const isToggling = togglingUserId === acct.id
              return (
                <div
                  key={acct.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900">
                        {acct.full_name}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          acct.role === 'MANAGER'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-sky-200 bg-sky-50 text-sky-900'
                        }`}
                      >
                        {getRoleDisplayLabel(acct.role)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          acct.is_active
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                      >
                        {acct.is_active ? 'Active' : 'Deactivated'}
                      </span>
                      {isSelf && (
                        <span className="text-[11px] font-medium text-stone-500">
                          (You)
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-stone-500">
                      {acct.email} · Created {formatShortDateTime(acct.created_at)}
                    </p>
                  </div>

                  {!isSelf && (
                    <Button
                      type="button"
                      size="sm"
                      variant={acct.is_active ? 'secondary' : 'primary'}
                      loading={isToggling}
                      disabled={isToggling}
                      onClick={() => onRequestToggleStatus(acct)}
                      icon={
                        acct.is_active ? (
                          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        )
                      }
                    >
                      {acct.is_active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

