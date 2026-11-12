import assert from 'node:assert/strict'
import test from 'node:test'

import type { AuthenticatedUser, AuthSessionResponse } from '../src/types/index.ts'
import {
  canUserAccessRoute,
  executeGuardedAuthSubmit,
  getDefaultDashboardRoute,
  getRoleDisplayLabel,
  normalizeAppRoute,
  resolveGuardedRoute,
  validateLoginForm,
  validateRegistrationForm,
  validateStaffProvisionForm,
} from '../src/utils/auth.ts'

const studentUser: AuthenticatedUser = {
  id: 'usr_student_01',
  full_name: 'Aarav Sharma',
  email: 'aarav@campus.edu',
  role: 'STUDENT',
  student_roll_no: '22CS042',
  is_active: true,
  created_at: '2026-11-12T10:00:00Z',
}

const staffUser: AuthenticatedUser = {
  id: 'usr_staff_01',
  full_name: 'Ramesh Counter',
  email: 'ramesh.kitchen@campus.edu',
  role: 'CANTEEN_STAFF',
  student_roll_no: null,
  is_active: true,
  created_at: '2026-11-12T10:00:00Z',
}

const managerUser: AuthenticatedUser = {
  id: 'usr_manager_01',
  full_name: 'Meera Manager',
  email: 'meera.manager@campus.edu',
  role: 'MANAGER',
  student_roll_no: null,
  is_active: true,
  created_at: '2026-11-12T10:00:00Z',
}

test('default dashboard routes and display labels map cleanly per role', () => {
  assert.equal(getDefaultDashboardRoute('STUDENT'), '/student')
  assert.equal(getDefaultDashboardRoute('CANTEEN_STAFF'), '/kitchen')
  assert.equal(getDefaultDashboardRoute('MANAGER'), '/manager')

  assert.equal(getRoleDisplayLabel('STUDENT'), 'Student')
  assert.equal(getRoleDisplayLabel('CANTEEN_STAFF'), 'Canteen Staff')
  assert.equal(getRoleDisplayLabel('MANAGER'), 'Manager')
})

test('unauthenticated users are redirected away from protected routes to /login', () => {
  for (const target of ['/student', '/kitchen', '/manager', '/profile']) {
    assert.equal(canUserAccessRoute(normalizeAppRoute(target), null), false)
    const resolution = resolveGuardedRoute(target, null)
    assert.equal(resolution.targetRoute, '/login')
    assert.equal(resolution.redirectReason, 'unauthenticated')
  }

  const landing = resolveGuardedRoute('/', null)
  assert.equal(landing.targetRoute, '/')
  assert.equal(landing.redirectReason, undefined)
})

test('authenticated role guards enforce Student, Kitchen, and Manager boundaries', () => {
  // Student can visit /student & /profile, denied /kitchen & /manager
  assert.equal(canUserAccessRoute('/student', studentUser), true)
  assert.equal(canUserAccessRoute('/profile', studentUser), true)
  assert.equal(resolveGuardedRoute('/kitchen', studentUser).targetRoute, '/unauthorized')
  assert.equal(resolveGuardedRoute('/manager', studentUser).targetRoute, '/unauthorized')

  // Canteen Staff can visit /kitchen & /profile, denied /student & /manager
  assert.equal(canUserAccessRoute('/kitchen', staffUser), true)
  assert.equal(canUserAccessRoute('/profile', staffUser), true)
  assert.equal(resolveGuardedRoute('/student', staffUser).targetRoute, '/unauthorized')
  assert.equal(resolveGuardedRoute('/manager', staffUser).targetRoute, '/unauthorized')

  // Manager can visit /manager, /kitchen, & /profile, denied /student
  assert.equal(canUserAccessRoute('/manager', managerUser), true)
  assert.equal(canUserAccessRoute('/kitchen', managerUser), true)
  assert.equal(canUserAccessRoute('/profile', managerUser), true)
  assert.equal(resolveGuardedRoute('/student', managerUser).targetRoute, '/unauthorized')
})

test('authenticated users visiting /login or /register redirect to their role dashboard', () => {
  assert.deepEqual(resolveGuardedRoute('/login', studentUser), {
    targetRoute: '/student',
    redirectReason: 'already_authenticated',
  })
  assert.deepEqual(resolveGuardedRoute('/register', staffUser), {
    targetRoute: '/kitchen',
    redirectReason: 'already_authenticated',
  })
  assert.deepEqual(resolveGuardedRoute('/login', managerUser), {
    targetRoute: '/manager',
    redirectReason: 'already_authenticated',
  })
})

test('login, student registration, and staff creation validators catch invalid inputs cleanly', () => {
  assert.equal(validateLoginForm('bad-email', 'pass1234').ok, false)
  assert.equal(validateLoginForm('student@campus.edu', '').ok, false)
  assert.deepEqual(validateLoginForm(' STUDENT@CAMPUS.EDU ', 'CampusPass123'), {
    ok: true,
    payload: {
      email: 'student@campus.edu',
      password: 'CampusPass123',
    },
  })

  assert.equal(
    validateRegistrationForm({
      fullName: 'A',
      email: 'student@campus.edu',
      password: 'Password123',
      confirmPassword: 'Password123',
      studentRollNo: '22CS001',
    }).ok,
    false,
  )
  assert.equal(
    validateRegistrationForm({
      fullName: 'Aarav',
      email: 'student@campus.edu',
      password: 'onlyletters',
      confirmPassword: 'onlyletters',
      studentRollNo: '22CS001',
    }).ok,
    false,
  )
  assert.equal(
    validateRegistrationForm({
      fullName: 'Aarav',
      email: 'student@campus.edu',
      password: 'Password123',
      confirmPassword: 'DifferentPassword123',
      studentRollNo: '22CS001',
    }).ok,
    false,
  )
  assert.deepEqual(
    validateRegistrationForm({
      fullName: '  Aarav Sharma ',
      email: 'Aarav@Campus.Edu',
      password: 'Password123',
      confirmPassword: 'Password123',
      studentRollNo: '22CS042',
    }),
    {
      ok: true,
      payload: {
        full_name: 'Aarav Sharma',
        email: 'aarav@campus.edu',
        password: 'Password123',
        confirm_password: 'Password123',
        student_roll_no: '22CS042',
      },
    },
  )

  assert.equal(
    validateStaffProvisionForm({
      fullName: 'New Manager',
      email: 'mgr2@campus.edu',
      password: 'StrongPassword99',
      role: 'MANAGER',
      confirmManagerGrant: false,
    }).ok,
    false,
  )
  assert.deepEqual(
    validateStaffProvisionForm({
      fullName: 'New Manager',
      email: 'mgr2@campus.edu',
      password: 'StrongPassword99',
      role: 'MANAGER',
      confirmManagerGrant: true,
    }),
    {
      ok: true,
      payload: {
        full_name: 'New Manager',
        email: 'mgr2@campus.edu',
        password: 'StrongPassword99',
        role: 'MANAGER',
        confirm_manager_grant: true,
      },
    },
  )
})

test('executeGuardedAuthSubmit blocks concurrent duplicate login/registration submissions', async () => {
  const guard = { current: false }
  let calls = 0
  let resolvePending!: (val: AuthSessionResponse) => void

  const submitFn = () => {
    calls += 1
    return new Promise<AuthSessionResponse>((resolve) => {
      resolvePending = resolve
    })
  }

  const firstAttempt = executeGuardedAuthSubmit({ email: 'a@b.com' }, guard, submitFn)
  const secondAttempt = executeGuardedAuthSubmit({ email: 'a@b.com' }, guard, submitFn)

  assert.equal(calls, 1)
  resolvePending({ user: studentUser, csrf_token: 'csrf_test' })

  const [firstResult, secondResult] = await Promise.all([firstAttempt, secondAttempt])
  assert.equal(firstResult.status, 'success')
  assert.equal(secondResult.status, 'ignored_duplicate')
  assert.equal(guard.current, false)
})
