import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchCurrentSession,
  fetchHealth,
  logoutUser,
  setApiCsrfToken,
  setSessionExpiredHandler,
} from './api/client'
import { AppShell } from './components/layout/AppShell'
import { Card } from './components/ui/Card'
import { Skeleton } from './components/ui/Skeleton'
import { ToastViewport, type ToastItem } from './components/ui/Toast'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { UnauthorizedPage } from './pages/UnauthorizedPage'

const StudentPage = lazy(() =>
  import('./pages/StudentPage').then((mod) => ({ default: mod.StudentPage })),
)
const KitchenPage = lazy(() =>
  import('./pages/KitchenPage').then((mod) => ({ default: mod.KitchenPage })),
)
const ManagerPage = lazy(() =>
  import('./pages/ManagerPage').then((mod) => ({ default: mod.ManagerPage })),
)
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((mod) => ({ default: mod.ProfilePage })),
)
import type { AuthenticatedUser, AuthSessionResponse } from './types'
import {
  type AppRoute,
  getDefaultDashboardRoute,
  normalizeAppRoute,
  resolveGuardedRoute,
} from './utils/auth'
import {
  clearStoredOrderHistory,
  clearStoredPickupTokens,
  writeStoredOrderId,
} from './utils/storage'
import { subscribeToToasts } from './utils/toast'

const ROUTE_TITLES: Record<AppRoute, string> = {
  '/': 'QUEUELESS — Skip the queue. Not your meal.',
  '/login': 'Sign In · QUEUELESS',
  '/register': 'Student Registration · QUEUELESS',
  '/student': 'Student Pre-Order · QUEUELESS',
  '/kitchen': 'Kitchen Operations · QUEUELESS',
  '/manager': 'Manager Console · QUEUELESS',
  '/profile': 'Account & Password · QUEUELESS',
  '/unauthorized': 'Access Denied · QUEUELESS',
}

function clearBrowserStudentOrderState() {
  writeStoredOrderId(null)
  clearStoredPickupTokens()
  clearStoredOrderHistory()
}

function updateBrowserUrl(route: AppRoute, replace = false) {
  if (typeof window === 'undefined') return
  if (window.location.pathname === route) return
  if (replace) {
    window.history.replaceState({}, '', route)
  } else {
    window.history.pushState({}, '', route)
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true)
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined'
      ? normalizeAppRoute(window.location.pathname)
      : '/',
  )
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false)
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastIdRef = useRef(0)

  const currentUserRef = useRef<AuthenticatedUser | null>(null)
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    document.title = ROUTE_TITLES[activeRoute]
  }, [activeRoute])

  useEffect(() => {
    const timers: number[] = []
    const unsubscribe = subscribeToToasts((message, tone) => {
      const id = ++toastIdRef.current
      setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3200)
      timers.push(timer)
    })
    return () => {
      unsubscribe()
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  const navigate = useCallback(
    (targetPath: AppRoute, options?: { replace?: boolean; clearNotice?: boolean }) => {
      const user = currentUserRef.current
      const resolution = resolveGuardedRoute(targetPath, user)
      if (resolution.redirectReason === 'unauthenticated') {
        setAuthNotice('Please sign in to access that workspace.')
      } else if (options?.clearNotice !== false && resolution.redirectReason !== 'unauthorized') {
        setAuthNotice(null)
      }
      setActiveRoute(resolution.targetRoute)
      updateBrowserUrl(resolution.targetRoute, options?.replace ?? false)
    },
    [],
  )

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setApiCsrfToken(null)
      setCurrentUser(null)
      currentUserRef.current = null
      clearBrowserStudentOrderState()
      setAuthNotice('Your session expired or was signed out. Please sign in again.')
      setActiveRoute('/login')
      updateBrowserUrl('/login', true)
    })
    return () => {
      setSessionExpiredHandler(null)
    }
  }, [])

  useEffect(() => {
    let active = true

    fetchHealth()
      .then(() => {
        if (active) setApiConnected(true)
      })
      .catch(() => {
        if (active) setApiConnected(false)
      })

    fetchCurrentSession()
      .then((session) => {
        if (!active) return
        setApiCsrfToken(session.csrf_token)
        setCurrentUser(session.user)
        currentUserRef.current = session.user
        const initialPath =
          typeof window !== 'undefined' ? window.location.pathname : '/'
        const resolution = resolveGuardedRoute(initialPath, session.user)
        setActiveRoute(resolution.targetRoute)
        updateBrowserUrl(resolution.targetRoute, true)
      })
      .catch(() => {
        if (!active) return
        setApiCsrfToken(null)
        setCurrentUser(null)
        currentUserRef.current = null
        const initialPath =
          typeof window !== 'undefined' ? window.location.pathname : '/'
        const resolution = resolveGuardedRoute(initialPath, null)
        if (resolution.redirectReason === 'unauthenticated') {
          setAuthNotice('Please sign in to continue.')
        }
        setActiveRoute(resolution.targetRoute)
        updateBrowserUrl(resolution.targetRoute, true)
      })
      .finally(() => {
        if (active) {
          setIsCheckingSession(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const rawPath = window.location.pathname
      const resolution = resolveGuardedRoute(rawPath, currentUserRef.current)
      if (resolution.redirectReason === 'unauthenticated') {
        setAuthNotice('Please sign in to access that workspace.')
      }
      setActiveRoute(resolution.targetRoute)
      if (resolution.targetRoute !== normalizeAppRoute(rawPath)) {
        updateBrowserUrl(resolution.targetRoute, true)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const handleAuthSuccess = useCallback((session: AuthSessionResponse) => {
    if (
      currentUserRef.current &&
      currentUserRef.current.id !== session.user.id
    ) {
      clearBrowserStudentOrderState()
    }
    setApiCsrfToken(session.csrf_token)
    setCurrentUser(session.user)
    currentUserRef.current = session.user
    setAuthNotice(null)
    const dashboardRoute = getDefaultDashboardRoute(session.user.role)
    setActiveRoute(dashboardRoute)
    updateBrowserUrl(dashboardRoute, true)
  }, [])

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logoutUser()
    } catch {
      // Clear local client state even if session was already invalidated on backend.
    } finally {
      setApiCsrfToken(null)
      setCurrentUser(null)
      currentUserRef.current = null
      clearBrowserStudentOrderState()
      setAuthNotice('You have been signed out cleanly.')
      setActiveRoute('/login')
      updateBrowserUrl('/login', true)
      setIsLoggingOut(false)
    }
  }, [isLoggingOut])

  const renderContent = () => {
    if (isCheckingSession) {
      return (
        <div className="mx-auto max-w-2xl py-10">
          <Card className="space-y-3 p-6">
            <div className="h-5 w-44 animate-pulse rounded bg-stone-200/80" />
            <div className="h-4 w-72 animate-pulse rounded bg-stone-100" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-stone-100" />
          </Card>
        </div>
      )
    }

    if (activeRoute === '/') {
      return (
        <LandingPage
          currentUser={currentUser}
          onNavigate={navigate}
        />
      )
    }

    if (activeRoute === '/login') {
      return (
        <LoginPage
          notice={authNotice}
          onClearNotice={() => setAuthNotice(null)}
          onLoginSuccess={handleAuthSuccess}
          onNavigate={navigate}
        />
      )
    }

    if (activeRoute === '/register') {
      return (
        <RegisterPage
          onRegisterSuccess={handleAuthSuccess}
          onNavigate={navigate}
        />
      )
    }

    if (!currentUser) {
      return (
        <LoginPage
          notice={authNotice ?? 'Please sign in to access this workspace.'}
          onClearNotice={() => setAuthNotice(null)}
          onLoginSuccess={handleAuthSuccess}
          onNavigate={navigate}
        />
      )
    }

    if (activeRoute === '/unauthorized') {
      return (
        <UnauthorizedPage
          currentUser={currentUser}
          onNavigate={navigate}
        />
      )
    }

    if (activeRoute === '/profile') {
      return (
        <ProfilePage
          user={currentUser}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser)
            currentUserRef.current = updatedUser
          }}
          onNavigate={navigate}
        />
      )
    }

    if (activeRoute === '/student') {
      if (currentUser.role !== 'STUDENT') {
        return (
          <UnauthorizedPage
            currentUser={currentUser}
            onNavigate={navigate}
          />
        )
      }
      return <StudentPage key={currentUser.id} currentUser={currentUser} />
    }

    if (activeRoute === '/kitchen') {
      if (
        currentUser.role !== 'CANTEEN_STAFF' &&
        currentUser.role !== 'MANAGER'
      ) {
        return (
          <UnauthorizedPage
            currentUser={currentUser}
            onNavigate={navigate}
          />
        )
      }
      return (
        <KitchenPage
          currentUserRole={currentUser.role}
          currentUserName={currentUser.full_name}
          onDemoReset={() => {
            clearBrowserStudentOrderState()
          }}
        />
      )
    }

    if (activeRoute === '/manager') {
      if (currentUser.role !== 'MANAGER') {
        return (
          <UnauthorizedPage
            currentUser={currentUser}
            onNavigate={navigate}
          />
        )
      }
      return <ManagerPage currentUser={currentUser} />
    }

    return <LandingPage currentUser={currentUser} onNavigate={navigate} />
  }

  return (
    <>
      <AppShell
        currentUser={currentUser}
        activeRoute={activeRoute}
        onNavigate={(route) => navigate(route)}
        onLogout={() => {
          void handleLogout()
        }}
        isLoggingOut={isLoggingOut}
        apiConnected={apiConnected}
      >
        <Suspense
          fallback={
            <Card className="space-y-3 p-6" aria-busy="true">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-40 w-full" />
            </Card>
          }
        >
          {renderContent()}
        </Suspense>
      </AppShell>
      <ToastViewport
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((item) => item.id !== id))
        }
      />
    </>
  )
}
