import type {
  AuthenticatedUser,
  AuthSessionResponse,
  LoginRequest,
  StaffCreateRequest,
  StudentRegisterRequest,
  UserRole,
} from '../types/index.ts'

export type AppRoute =
  | '/'
  | '/login'
  | '/register'
  | '/student'
  | '/kitchen'
  | '/manager'
  | '/profile'
  | '/unauthorized'

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export function normalizeAppRoute(pathname: string): AppRoute {
  const cleaned = pathname.replace(/\/+$/, '') || '/'
  if (
    cleaned === '/' ||
    cleaned === '/login' ||
    cleaned === '/register' ||
    cleaned === '/student' ||
    cleaned === '/kitchen' ||
    cleaned === '/manager' ||
    cleaned === '/profile' ||
    cleaned === '/unauthorized'
  ) {
    return cleaned
  }
  return '/'
}

export function getDefaultDashboardRoute(role: UserRole): AppRoute {
  if (role === 'MANAGER') return '/manager'
  if (role === 'CANTEEN_STAFF') return '/kitchen'
  return '/student'
}

export function getRoleDisplayLabel(role: UserRole): string {
  if (role === 'MANAGER') return 'Manager'
  if (role === 'CANTEEN_STAFF') return 'Canteen Staff'
  return 'Student'
}

export function canUserAccessRoute(
  route: AppRoute,
  user: AuthenticatedUser | null,
): boolean {
  if (route === '/' || route === '/login' || route === '/register') {
    return true
  }
  if (!user || !user.is_active) {
    return false
  }
  if (route === '/profile' || route === '/unauthorized') {
    return true
  }
  if (route === '/student') {
    return user.role === 'STUDENT'
  }
  if (route === '/kitchen') {
    return user.role === 'CANTEEN_STAFF' || user.role === 'MANAGER'
  }
  if (route === '/manager') {
    return user.role === 'MANAGER'
  }
  return false
}

export interface RouteResolution {
  targetRoute: AppRoute
  redirectReason?: 'unauthenticated' | 'unauthorized' | 'already_authenticated'
}

/**
 * Evaluate URL route access strictly using the authenticated user's server-verified role.
 */
export function resolveGuardedRoute(
  rawPathname: string,
  user: AuthenticatedUser | null,
): RouteResolution {
  const route = normalizeAppRoute(rawPathname)

  if (route === '/login' || route === '/register') {
    if (user && user.is_active) {
      return {
        targetRoute: getDefaultDashboardRoute(user.role),
        redirectReason: 'already_authenticated',
      }
    }
    return { targetRoute: route }
  }

  if (route === '/') {
    return { targetRoute: '/' }
  }

  if (!user || !user.is_active) {
    return {
      targetRoute: '/login',
      redirectReason: 'unauthenticated',
    }
  }

  if (!canUserAccessRoute(route, user)) {
    return {
      targetRoute: '/unauthorized',
      redirectReason: 'unauthorized',
    }
  }

  return { targetRoute: route }
}

export function validateEmailInput(email: string): string | null {
  const cleaned = email.trim().toLowerCase()
  if (!cleaned || cleaned.length > 254 || !EMAIL_PATTERN.test(cleaned)) {
    return 'Please enter a valid email address.'
  }
  return null
}

export function validatePasswordPolicyInput(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }
  if (password.length > 128) {
    return 'Password cannot exceed 128 characters.'
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include at least one letter and one number.'
  }
  return null
}

export function validateLoginForm(
  email: string,
  password: string,
): { ok: true; payload: LoginRequest } | { ok: false; error: string } {
  const emailErr = validateEmailInput(email)
  if (emailErr) {
    return { ok: false, error: emailErr }
  }
  if (!password) {
    return { ok: false, error: 'Please enter your password.' }
  }
  return {
    ok: true,
    payload: {
      email: email.trim().toLowerCase(),
      password,
    },
  }
}

export function validateRegistrationForm(values: {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  studentRollNo: string
}):
  | { ok: true; payload: StudentRegisterRequest }
  | { ok: false; error: string } {
  const cleanName = values.fullName.trim()
  if (cleanName.length < 2 || cleanName.length > 80) {
    return { ok: false, error: 'Full name must be between 2 and 80 characters.' }
  }

  const emailErr = validateEmailInput(values.email)
  if (emailErr) {
    return { ok: false, error: emailErr }
  }

  const pwErr = validatePasswordPolicyInput(values.password)
  if (pwErr) {
    return { ok: false, error: pwErr }
  }

  if (values.password !== values.confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' }
  }

  const cleanRoll = values.studentRollNo.trim()
  if (cleanRoll.length > 40) {
    return { ok: false, error: 'Student ID cannot exceed 40 characters.' }
  }

  return {
    ok: true,
    payload: {
      full_name: cleanName,
      email: values.email.trim().toLowerCase(),
      password: values.password,
      confirm_password: values.confirmPassword,
      student_roll_no: cleanRoll || null,
    },
  }
}

export function validateStaffProvisionForm(values: {
  fullName: string
  email: string
  password: string
  role: 'CANTEEN_STAFF' | 'MANAGER'
  confirmManagerGrant: boolean
}): { ok: true; payload: StaffCreateRequest } | { ok: false; error: string } {
  const cleanName = values.fullName.trim()
  if (cleanName.length < 2 || cleanName.length > 80) {
    return { ok: false, error: 'Staff name must be between 2 and 80 characters.' }
  }

  const emailErr = validateEmailInput(values.email)
  if (emailErr) {
    return { ok: false, error: emailErr }
  }

  const pwErr = validatePasswordPolicyInput(values.password)
  if (pwErr) {
    return { ok: false, error: pwErr }
  }

  if (values.role === 'MANAGER' && !values.confirmManagerGrant) {
    return {
      ok: false,
      error: 'Please check the confirmation box to authorize a new Manager account.',
    }
  }

  return {
    ok: true,
    payload: {
      full_name: cleanName,
      email: values.email.trim().toLowerCase(),
      password: values.password,
      role: values.role,
      confirm_manager_grant: values.confirmManagerGrant,
    },
  }
}

export type GuardedAuthOutcome =
  | { status: 'ignored_duplicate' }
  | { status: 'success'; session: AuthSessionResponse }
  | { status: 'error'; message: string }

export async function executeGuardedAuthSubmit<T>(
  payload: T,
  guard: { current: boolean },
  submitFn: (body: T) => Promise<AuthSessionResponse>,
): Promise<GuardedAuthOutcome> {
  if (guard.current) {
    return { status: 'ignored_duplicate' }
  }
  guard.current = true
  try {
    const session = await submitFn(payload)
    return { status: 'success', session }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to complete authentication request right now.'
    return { status: 'error', message }
  } finally {
    guard.current = false
  }
}

