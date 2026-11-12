import { useCallback, useEffect, useState } from 'react'
import { ApiClientError, fetchHealth } from './api/client'
import { AppShell, type AppView } from './components/layout/AppShell'
import { KitchenPage } from './pages/KitchenPage'
import { StudentPage } from './pages/StudentPage'
import type { HealthResponse } from './types'

export function App() {
  const [activeView, setActiveView] = useState<AppView>('student')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(true)

  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true)
    setHealthError(null)
    try {
      const response = await fetchHealth()
      setHealth(response)
    } catch (error) {
      setHealth(null)
      if (error instanceof ApiClientError) {
        setHealthError(error.message)
      } else {
        setHealthError('Unable to reach backend API. Ensure FastAPI is running.')
      }
    } finally {
      setIsCheckingHealth(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    fetchHealth()
      .then((response) => {
        if (!active) return
        setHealth(response)
        setHealthError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setHealth(null)
        if (error instanceof ApiClientError) {
          setHealthError(error.message)
        } else {
          setHealthError(
            'Unable to reach backend API. Ensure FastAPI is running.',
          )
        }
      })
      .finally(() => {
        if (!active) return
        setIsCheckingHealth(false)
      })

    return () => {
      active = false
    }
  }, [])

  const apiConnected =
    health !== null ? true : healthError !== null ? false : null

  return (
    <AppShell
      activeView={activeView}
      onViewChange={setActiveView}
      apiConnected={apiConnected}
    >
      {activeView === 'student' ? (
        <StudentPage
          health={health}
          healthError={healthError}
          isCheckingHealth={isCheckingHealth}
          onCheckHealth={() => {
            void checkHealth()
          }}
        />
      ) : (
        <KitchenPage
          health={health}
          healthError={healthError}
          isCheckingHealth={isCheckingHealth}
          onCheckHealth={() => {
            void checkHealth()
          }}
        />
      )}
    </AppShell>
  )
}

export default App
