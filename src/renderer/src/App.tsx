import type { ReactElement } from 'react'
import { Layout, type NavItem } from './components/layout'
import { DashboardPage, PlaceholderPage } from './pages'
import { useUIStore } from './stores'

const pageConfig: Record<NavItem, { title: string; description: string }> = {
  dashboard: { title: 'Dashboard', description: 'Your teaching dashboard' },
  roster: { title: 'Roster', description: 'Manage your class rosters and student ability levels' },
  tests: { title: 'Tests', description: 'Create and manage tests with AI-generated questions' },
  scantrons: {
    title: 'Scantrons',
    description: 'Generate personalized scantron sheets for printing'
  },
  grading: { title: 'Grading', description: 'Import scanned tests and grade them automatically' },
  analytics: { title: 'Analytics', description: 'View class and student performance analytics' },
  standards: { title: 'Standards', description: 'Import and manage teaching standards' },
  settings: { title: 'Settings', description: 'Configure application settings and preferences' }
}

function App(): ReactElement {
  const { activeNav, setActiveNav } = useUIStore()

  const renderPage = (): ReactElement => {
    if (activeNav === 'dashboard') {
      return <DashboardPage />
    }

    const config = pageConfig[activeNav]
    return (
      <PlaceholderPage
        title={config.title}
        icon={activeNav as Exclude<NavItem, 'dashboard'>}
        description={config.description}
      />
    )
  }

  return (
    <Layout activeItem={activeNav} onNavigate={setActiveNav}>
      {renderPage()}
    </Layout>
  )
}

export default App
