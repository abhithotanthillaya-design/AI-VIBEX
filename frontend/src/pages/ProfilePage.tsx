import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Save,
  UserCheck,
} from 'lucide-react'
import { ApiClientError, updateProfile } from '../api/client'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { AuthenticatedUser } from '../types'
import {
  getDefaultDashboardRoute,
  getRoleDisplayLabel,
  validatePasswordPolicyInput,
  type AppRoute,
} from '../utils/auth'

interface ProfilePageProps {
  user: AuthenticatedUser
  onUserUpdated: (updated: AuthenticatedUser) => void
  onNavigate: (route: AppRoute) => void
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
      setSuccess('Profile changes saved.')
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
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => onNavigate(getDefaultDashboardRoute(user.role))}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-900 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to {getRoleDisplayLabel(user.role)} Dashboard</span>
        </button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          Account &amp; Profile
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Manage your name, student registration details, or password. Account roles
          cannot be modified here.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">{user.full_name}</p>
              <p className="text-xs text-stone-500">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
              {getRoleDisplayLabel(user.role)}
            </span>
            <span className="rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
              {user.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="profile-full-name"
                className="block text-xs font-medium text-stone-700"
              >
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="profile-full-name"
                type="text"
                required
                disabled={isSaving}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {user.role === 'STUDENT' && (
              <div>
                <label
                  htmlFor="profile-roll-no"
                  className="block text-xs font-medium text-stone-700"
                >
                  Student ID / Reg No (optional)
                </label>
                <input
                  id="profile-roll-no"
                  type="text"
                  disabled={isSaving}
                  value={studentRollNo}
                  onChange={(event) => setStudentRollNo(event.target.value)}
                  maxLength={40}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-800">
                Change Password (optional)
              </span>
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
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
              <div>
                <label
                  htmlFor="profile-current-password"
                  className="block text-xs font-medium text-stone-700"
                >
                  Current Password
                </label>
                <input
                  id="profile-current-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSaving}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-new-password"
                  className="block text-xs font-medium text-stone-700"
                >
                  New Password
                </label>
                <input
                  id="profile-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isSaving}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Min 8 chars, letters + numbers"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-900"
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

