import { useEffect, useState } from 'react'
import { fetchHealth } from './api/client'
import { AppShell, type AppView } from './components/layout/AppShell'
import { KitchenPage } from './pages/KitchenPage'
import { StudentPage } from './pages/StudentPage'

export function App() {
  const [activeView, setActiveView] = useState<AppView>('student')
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true

    fetchHealth()
      .then(() => {
        if (!active) return
        setApiConnected(true)
      })
      .catch(() => {
        if (!active) return
        setApiConnected(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <AppShell
      activeView={activeView}
      onViewChange={setActiveView}
      apiConnected={apiConnected}
    >
      {activeView === 'student' ? <StudentPage /> : <KitchenPage />}
    </AppShell>
  )
}

export default App
