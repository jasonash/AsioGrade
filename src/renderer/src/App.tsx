import type { ReactElement } from 'react'
import { Layout, type NavItem } from './components/layout'
import { DashboardPage, PlaceholderPage, SettingsPage, CourseViewPage } from './pages'
import { useUIStore, useCourseStore } from './stores'

const pageConfig: Record<NavItem, { title: string; description: string }> = {
  dashboard: { title: 'Dashboard', description: 'Your teaching dashboard' },
  roster: { title: 'Roster', description: 'Manage your class rosters and student information' },
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
  const { currentCourse, setCurrentCourse } = useCourseStore()

  const handleNavigate = (nav: NavItem): void => {
    // Clear current course when navigating away
    if (currentCourse) {
      setCurrentCourse(null)
    }
    setActiveNav(nav)
  }

  const renderPage = (): ReactElement => {
    // Show course view if a course is selected
    if (activeNav === 'dashboard' && currentCourse) {
      return <CourseViewPage />
    }

    if (activeNav === 'dashboard') {
      return <DashboardPage />
    }

    if (activeNav === 'settings') {
      return <SettingsPage />
    }

    const config = pageConfig[activeNav]
    return (
      <PlaceholderPage
        title={config.title}
        icon={activeNav as Exclude<NavItem, 'dashboard' | 'settings'>}
        description={config.description}
      />
    )
  }

  return (
    <Layout activeItem={activeNav} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  )
}

export default App
