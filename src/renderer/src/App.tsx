import { useState, type ReactElement } from 'react'
import { Layout, type NavItem } from './components/layout'
import { DashboardPage, PlaceholderPage, SettingsPage, CourseViewPage, SectionViewPage, UnitViewPage, StandardsViewPage } from './pages'
import { CourseCreationModal } from './components/courses'
import { useUIStore, useCourseStore, useSectionStore, useUnitStore } from './stores'
import type { CourseSummary, SectionSummary, UnitSummary } from '../../shared/types'

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
  const { fetchSections } = useSectionStore()
  const { fetchUnits } = useUnitStore()

  // State for current section view
  const [currentSection, setCurrentSection] = useState<SectionSummary | null>(null)

  // State for current unit view
  const [currentUnit, setCurrentUnit] = useState<UnitSummary | null>(null)

  // State for standards view
  const [viewingStandards, setViewingStandards] = useState(false)

  // State for course creation modal (can be triggered from sidebar)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const handleNavigate = (nav: NavItem): void => {
    // Clear current course, section, unit, and standards view when navigating away
    if (currentCourse) {
      setCurrentCourse(null)
    }
    if (currentSection) {
      setCurrentSection(null)
    }
    if (currentUnit) {
      setCurrentUnit(null)
    }
    if (viewingStandards) {
      setViewingStandards(false)
    }
    setActiveNav(nav)
  }

  const handleCourseSelect = (course: CourseSummary): void => {
    setCurrentCourse(course)
    setCurrentSection(null)
    setCurrentUnit(null)
    setViewingStandards(false)
    setActiveNav('dashboard')
    // Fetch sections and units for this course
    fetchSections(course.id)
    fetchUnits(course.id)
  }

  const handleSectionSelect = (section: SectionSummary, course: CourseSummary): void => {
    setCurrentCourse(course)
    setCurrentSection(section)
    setActiveNav('dashboard')
    // Note: Sidebar handles its own section caching, no need to fetch here
  }

  const handleNewCourse = (): void => {
    setIsCreateModalOpen(true)
  }

  const renderPage = (): ReactElement => {
    // Show standards view if viewing standards
    if (activeNav === 'dashboard' && viewingStandards && currentCourse) {
      return (
        <StandardsViewPage
          course={currentCourse}
          onBack={() => setViewingStandards(false)}
        />
      )
    }

    // Show unit view if a unit is selected
    if (activeNav === 'dashboard' && currentUnit && currentCourse) {
      return (
        <UnitViewPage
          course={currentCourse}
          unitSummary={currentUnit}
          onBack={() => setCurrentUnit(null)}
          onDeleted={() => {
            setCurrentUnit(null)
            // Refresh units list
            fetchUnits(currentCourse.id)
          }}
        />
      )
    }

    // Show section view if a section is selected
    if (activeNav === 'dashboard' && currentSection && currentCourse) {
      return (
        <SectionViewPage
          course={currentCourse}
          section={currentSection}
          onBack={() => setCurrentSection(null)}
        />
      )
    }

    // Show course view if a course is selected (but no section or unit)
    if (activeNav === 'dashboard' && currentCourse) {
      return (
        <CourseViewPage
          onSectionSelect={(section) => setCurrentSection(section)}
          onUnitSelect={(unit) => setCurrentUnit(unit)}
          onStandardsSelect={() => setViewingStandards(true)}
        />
      )
    }

    if (activeNav === 'dashboard') {
      return <DashboardPage onOpenCreateModal={() => setIsCreateModalOpen(true)} />
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
    <>
      <Layout
        activeItem={activeNav}
        onNavigate={handleNavigate}
        onCourseSelect={handleCourseSelect}
        onSectionSelect={handleSectionSelect}
        onNewCourse={handleNewCourse}
      >
        {renderPage()}
      </Layout>

      {/* Course Creation Modal - at app level so sidebar can trigger it */}
      <CourseCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(course) => {
          // Convert Course to CourseSummary for navigation
          const courseSummary: CourseSummary = {
            id: course.id,
            name: course.name,
            subject: course.subject,
            gradeLevel: course.gradeLevel,
            academicYear: course.academicYear,
            sectionCount: 0, // New course has no sections
            lastModified: new Date(course.updatedAt).getTime(),
            driveFolderId: course.driveFolderId ?? ''
          }
          handleCourseSelect(courseSummary)
        }}
      />
    </>
  )
}

export default App
