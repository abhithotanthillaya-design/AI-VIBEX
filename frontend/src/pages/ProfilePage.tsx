import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { ApiClientError, updateProfile } from '../api/client'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormField, Input } from '../components/ui/FormControls'
import type { AuthenticatedUser } from '../types'
import {
  getDefaultDashboardRoute,
  getRoleDisplayLabel,
  validatePasswordPolicyInput,
  type AppRoute,
} from '../utils/auth'
import { showToast } from '../utils/toast'

interface ProfilePageProps {
  user: AuthenticatedUser
  onUserUpdated: (updated: AuthenticatedUser) => void
  onNavigate: (route: AppRoute) => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'QL'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function ProfilePage({
  user,
  onUserUpdated,
  onNavigate,
}: ProfilePageProps) {
  const [fullName, setFullName] = useState(user.full_name)
  const [studentRollNo, setStudentRollNo] = useState(user.student_roll_no ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) return

    setError(null)
    setSuccess(null)

    const cleanName = fullName.trim()
    if (cleanName.length < 2 || cleanName.length > 80) {
      setError('Full name must be between 2 and 80 characters.')
      return
    }

    if (newPassword) {
      if (!currentPassword) {
        setError('Please enter your current password to set a new password.')
        return
      }
      const pwErr = validatePasswordPolicyInput(newPassword)
      if (pwErr) {
        setError(pwErr)
        return
      }
    }

    setIsSaving(true)
    try {
      const updated = await updateProfile({
        full_name: cleanName,
        ...(user.role === 'STUDENT'
          ? { student_roll_no: studentRollNo.trim() || null }
          : {}),
        ...(newPassword
          ? { current_password: currentPassword, new_password: newPassword }
          : {}),
      })
      onUserUpdated(updated)
      setCurrentPassword('')
      setNewPassword('')
      setSuccess('Profile changes saved cleanly.')
      showToast('Account details saved.', 'success')
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to update your profile right now.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6 ql-animate-enter">
      <div>
        <button
          type="button"
          onClick={() => onNavigate(getDefaultDashboardRoute(user.role))}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1A4D38] hover:text-[#143B2B] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to {getRoleDisplayLabel(user.role)} Dashboard</span>
        </button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1E1D1A] sm:text-3xl">
          Account &amp; Security
        </h1>
        <p className="mt-1 text-sm text-[#5B564D]">
          Manage your display name, student registration details, or password.
          Assigned roles are enforced by the backend and cannot be changed here.
        </p>
      </div>

      <Card className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4DED2] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1A4D38] text-sm font-bold text-[#FCFBF8]">
              {getInitials(user.full_name)}
            </div>
            <div>
              <p className="text-base font-semibold text-[#1E1D1A]">
                {user.full_name}
              </p>
              <p className="text-xs text-[#5B564D]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              tone="forest"
              icon={<ShieldCheck className="h-3 w-3" aria-hidden="true" />}
            >
              {getRoleDisplayLabel(user.role)}
            </Badge>
            <Badge tone={user.is_active ? 'sage' : 'danger'}>
              {user.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="profile-full-name" label="Full Name" required>
              <Input
                id="profile-full-name"
                type="text"
                required
                disabled={isSaving}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={80}
              />
            </FormField>

            {user.role === 'STUDENT' && (
              <FormField
                id="profile-roll-no"
                label="Student ID / Reg No"
                hint="Optional"
              >
                <Input
                  id="profile-roll-no"
                  type="text"
                  disabled={isSaving}
                  value={studentRollNo}
                  onChange={(event) => setStudentRollNo(event.target.value)}
                  maxLength={40}
                />
              </FormField>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-[#E4DED2] bg-[#F7F4ED] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1E1D1A]">
                Change Password (optional)
              </span>
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#5B564D] hover:text-[#1E1D1A] cursor-pointer"
              >
                {showPasswords ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="profile-current-password" label="Current Password">
                <Input
                  id="profile-current-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSaving}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </FormField>

              <FormField id="profile-new-password" label="New Password">
                <Input
                  id="profile-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isSaving}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Min 8 chars, letters + numbers"
                />
              </FormField>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#E7BDBD] bg-[#FBEDED] px-3 py-2.5 text-xs text-[#842323]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-[#BDD6C7] bg-[#E3EFE8] px-3 py-2.5 text-xs font-medium text-[#143B2B]"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSaving}
              disabled={isSaving}
              icon={<Save className="h-4 w-4" aria-hidden="true" />}
            >
              Save Profile
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}
