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
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { FormField, Input, Select } from '../ui/FormControls'
import { Skeleton } from '../ui/Skeleton'

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
      <Card className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E3EFE8] text-[#1A4D38]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1E1D1A]">
              Provision Canteen Staff &amp; Authorized Access
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[#5B564D]">
              Public registration creates Student accounts only. Use this
              manager-only console to issue Canteen Staff credentials or
              explicitly authorize additional Manager access.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            void handleCreate(event)
          }}
          className="space-y-4 border-t border-[#E4DED2] pt-4"
        >
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="staff-full-name" label="Staff Full Name" required>
              <Input
                id="staff-full-name"
                type="text"
                required
                disabled={isSubmitting}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="e.g. Ramesh Verma"
                maxLength={80}
              />
            </FormField>

            <FormField id="staff-email" label="Email Address" required>
              <Input
                id="staff-email"
                type="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@campus.edu"
                maxLength={254}
              />
            </FormField>

            <FormField id="staff-password" label="Temporary Password" required>
              <div className="relative">
                <Input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Min 8 chars (A-z + 0-9)"
                  maxLength={128}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B564D] hover:bg-[#EFEAE0] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </FormField>

            <FormField id="staff-role" label="Assigned Role" required>
              <Select
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
              >
                <option value="CANTEEN_STAFF">Canteen Staff (Kitchen)</option>
                <option value="MANAGER">Manager (Full Admin)</option>
              </Select>
            </FormField>
          </div>

          {role === 'MANAGER' && (
            <label className="flex items-start gap-2.5 rounded-xl border border-[#E7D4AF] bg-[#FBF4E4] px-3.5 py-2.5 text-xs text-[#7D5214] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmManagerGrant}
                disabled={isSubmitting}
                onChange={(event) => setConfirmManagerGrant(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#A87122] text-[#1A4D38]"
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
              className="flex items-start gap-2 rounded-xl border border-[#E7BDBD] bg-[#FBEDED] px-3 py-2 text-xs text-[#842323]"
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
        <div className="border-b border-[#E4DED2] px-5 py-4">
          <h3 className="text-sm font-semibold text-[#1E1D1A]">
            Authorized Staff &amp; Manager Accounts
          </h3>
          <p className="mt-0.5 text-xs text-[#5B564D]">
            Deactivating an account immediately revokes active sessions for that
            staff member.
          </p>
        </div>

        {isLoading && staffAccounts.length === 0 ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-14" />
            ))}
          </div>
        ) : staffAccounts.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#5B564D]">
            No staff accounts found.
          </p>
        ) : (
          <div className="divide-y divide-[#E4DED2]">
            {staffAccounts.map((acct) => {
              const isSelf = acct.id === currentManagerId
              const isToggling = togglingUserId === acct.id
              return (
                <div
                  key={acct.id}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[#F7F4ED]/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#1E1D1A]">
                        {acct.full_name}
                      </span>
                      <Badge tone={acct.role === 'MANAGER' ? 'forest' : 'info'}>
                        {getRoleDisplayLabel(acct.role)}
                      </Badge>
                      <Badge tone={acct.is_active ? 'sage' : 'danger'}>
                        {acct.is_active ? 'Active' : 'Deactivated'}
                      </Badge>
                      {isSelf && (
                        <span className="text-[11px] font-medium text-[#787166]">
                          (You)
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-[#5B564D]">
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
