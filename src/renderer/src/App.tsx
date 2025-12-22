import { useState, type ReactElement } from 'react'
import { Layout, type NavItem } from './components/layout'
import { DashboardPage, PlaceholderPage, SettingsPage, CourseViewPage, SectionViewPage, UnitViewPage, StandardsViewPage, AssessmentViewPage, AssignmentViewPage, LessonEditorPage } from './pages'
import { CourseCreationModal } from './components/courses'
import { useUIStore, useCourseStore, useSectionStore, useUnitStore, useAssessmentStore, useAssignmentStore } from './stores'
import { useLessonStore } from './stores/lesson.store'
import type { CourseSummary, SectionSummary, UnitSummary, AssessmentSummary, AssignmentSummary, LessonSummary } from '../../shared/types'

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
  const { fetchAssessments } = useAssessmentStore()
  const { fetchAssignments } = useAssignmentStore()
  const { fetchLessons } = useLessonStore()

  // State for current section view
  const [currentSection, setCurrentSection] = useState<SectionSummary | null>(null)

  // State for current unit view
  const [currentUnit, setCurrentUnit] = useState<UnitSummary | null>(null)

  // State for current assessment view
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentSummary | null>(null)

  // State for current lesson view
  const [currentLesson, setCurrentLesson] = useState<LessonSummary | null>(null)

  // State for current assignment view (assignments are instances of assessments given to sections)
  const [currentAssignment, setCurrentAssignment] = useState<AssignmentSummary | null>(null)

  // State for standards view
  const [viewingStandards, setViewingStandards] = useState(false)

  // State for course creation modal (can be triggered from sidebar)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const handleNavigate = (nav: NavItem): void => {
    // Clear current course, section, unit, assessment, lesson, assignment, and standards view when navigating away
    if (currentCourse) {
      setCurrentCourse(null)
    }
    if (currentSection) {
      setCurrentSection(null)
    }
    if (currentUnit) {
      setCurrentUnit(null)
    }
    if (currentAssessment) {
      setCurrentAssessment(null)
    }
    if (currentLesson) {
      setCurrentLesson(null)
    }
    if (currentAssignment) {
      setCurrentAssignment(null)
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
    setCurrentAssessment(null)
    setCurrentLesson(null)
    setCurrentAssignment(null)
    setViewingStandards(false)
    setActiveNav('dashboard')
    // Fetch sections and units for this course
    fetchSections(course.id)
    fetchUnits(course.id)
  }

  const handleSectionSelect = (section: SectionSummary, course: CourseSummary): void => {
    setCurrentCourse(course)
    setCurrentSection(section)
    setCurrentAssignment(null)
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

    // Show assessment view if an assessment is selected
    if (activeNav === 'dashboard' && currentAssessment && currentUnit && currentCourse) {
      return (
        <AssessmentViewPage
          course={currentCourse}
          unit={currentUnit}
          assessmentSummary={currentAssessment}
          onBack={() => setCurrentAssessment(null)}
          onDeleted={() => {
            setCurrentAssessment(null)
            // Refresh assessments list
            fetchAssessments(currentUnit.id)
          }}
        />
      )
    }

    // Show lesson editor if a lesson is selected
    if (activeNav === 'dashboard' && currentLesson && currentUnit && currentCourse) {
      return (
        <LessonEditorPage
          course={currentCourse}
          unit={currentUnit}
          lessonSummary={currentLesson}
          onBack={() => setCurrentLesson(null)}
          onDeleted={() => {
            setCurrentLesson(null)
            // Refresh lessons list
            fetchLessons(currentUnit.id)
          }}
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
          onAssessmentSelect={(assessment) => setCurrentAssessment(assessment)}
          onLessonSelect={(lesson) => setCurrentLesson(lesson)}
        />
      )
    }

    // Show assignment view if an assignment is selected (within a section)
    if (activeNav === 'dashboard' && currentAssignment && currentSection && currentCourse) {
      return (
        <AssignmentViewPage
          course={currentCourse}
          section={currentSection}
          assignmentSummary={currentAssignment}
          onBack={() => setCurrentAssignment(null)}
          onDeleted={() => {
            setCurrentAssignment(null)
            // Refresh assignments list
            fetchAssignments(currentSection.id)
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
          onAssignmentSelect={(assignment) => setCurrentAssignment(assignment)}
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
