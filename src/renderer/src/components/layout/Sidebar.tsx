import type { ReactElement } from 'react'
import { useEffect, useState, useCallback } from 'react'
import {
  Home,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Users,
  Plus
} from 'lucide-react'
import { useCourseStore, useUIStore, useAuthStore } from '../../stores'
import type { CourseSummary, SectionSummary, ServiceResult } from '../../../../shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

export type NavItem =
  | 'dashboard'
  | 'roster'
  | 'tests'
  | 'scantrons'
  | 'grading'
  | 'analytics'
  | 'standards'
  | 'settings'

interface SidebarProps {
  isExpanded: boolean
  onToggle: () => void
  activeItem: NavItem
  onNavigate: (item: NavItem) => void
  onCourseSelect?: (course: CourseSummary) => void
  onSectionSelect?: (section: SectionSummary, course: CourseSummary) => void
  onNewCourse?: () => void
}

export function Sidebar({
  isExpanded,
  onToggle,
  activeItem,
  onNavigate,
  onCourseSelect,
  onSectionSelect,
  onNewCourse
}: SidebarProps): ReactElement {
  const { status } = useAuthStore()
  const isLoggedIn = status === 'authenticated'
  const { courses, currentCourse, fetchCourses } = useCourseStore()
  const { expandedCourses, toggleCourseExpanded, setCourseExpanded } = useUIStore()
  // Local cache of sections per course (for displaying multiple expanded courses)
  // Note: Sidebar manages its own cache independently of the global section store
  // to avoid race conditions when switching between courses
  const [sectionsCache, setSectionsCache] = useState<Record<string, SectionSummary[]>>({})
  const [loadingSections, setLoadingSections] = useState<string | null>(null)

  // Fetch courses when logged in
  useEffect(() => {
    if (isLoggedIn && courses.length === 0) {
      fetchCourses()
    }
  }, [isLoggedIn, courses.length, fetchCourses])

  // Function to fetch sections for a course
  const fetchSectionsForCourse = useCallback(async (courseId: string): Promise<void> => {
    // Skip if already loading or already cached
    if (sectionsCache[courseId]) return

    setLoadingSections(courseId)
    try {
      const result = await window.electronAPI.invoke<ServiceResult<SectionSummary[]>>(
        'drive:listSections',
        courseId
      )
      if (result.success) {
        setSectionsCache((prev) => ({
          ...prev,
          [courseId]: result.data
        }))
      }
    } catch {
      // Silently fail - user can try expanding again
    } finally {
      setLoadingSections(null)
    }
  }, [sectionsCache])

  // Fetch sections for any courses that are already expanded on mount
  useEffect(() => {
    if (courses.length > 0 && expandedCourses.size > 0) {
      // Find expanded courses that don't have cached sections yet
      courses.forEach((course) => {
        if (expandedCourses.has(course.id) && !sectionsCache[course.id]) {
          fetchSectionsForCourse(course.id)
        }
      })
    }
  }, [courses, expandedCourses, sectionsCache, fetchSectionsForCourse])

  // Fetch sections when a course is expanded
  const handleCourseClick = async (course: CourseSummary): Promise<void> => {
    if (!isExpanded) {
      // If collapsed, just select the course
      onCourseSelect?.(course)
      return
    }

    const isCurrentlyExpanded = expandedCourses.has(course.id)

    if (isCurrentlyExpanded) {
      // Collapse
      toggleCourseExpanded(course.id)
    } else {
      // Expand and fetch sections if not cached
      toggleCourseExpanded(course.id)
      if (!sectionsCache[course.id]) {
        await fetchSectionsForCourse(course.id)
      }
    }
  }

  // Handle course name click (navigate to course view)
  const handleCourseNavigate = async (course: CourseSummary): Promise<void> => {
    onCourseSelect?.(course)
    // Auto-expand when selecting
    setCourseExpanded(course.id, true)
    // Fetch sections if not cached
    if (!sectionsCache[course.id]) {
      await fetchSectionsForCourse(course.id)
    }
  }

  // Handle section click
  const handleSectionClick = (section: SectionSummary): void => {
    const course = courses.find((c) => c.id === section.courseId)
    if (course) {
      onSectionSelect?.(section, course)
    }
  }

  // Get sections for a specific course from local cache
  const getSectionsForCourse = (courseId: string): SectionSummary[] => {
    return sectionsCache[courseId] ?? []
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-out',
          isExpanded ? 'w-[240px]' : 'w-[60px]'
        )}
      >
        {/* Header with app name and toggle */}
        <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
          {isExpanded ? (
            <>
              <span className="flex-1 text-sm font-semibold text-sidebar-foreground">
                TeachingHelp
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground"
              >
                <ChevronLeft size={18} />
                <span className="sr-only">Collapse sidebar</span>
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="w-full h-8 text-muted-foreground hover:text-sidebar-foreground"
            >
              <ChevronRight size={18} />
              <span className="sr-only">Expand sidebar</span>
            </Button>
          )}
        </div>

        {/* Dashboard link */}
        <div className="py-2 border-b border-sidebar-border">
          <NavButton
            icon={<Home size={20} />}
            label="Dashboard"
            isExpanded={isExpanded}
            isActive={activeItem === 'dashboard' && !currentCourse}
            onClick={() => onNavigate('dashboard')}
          />
        </div>

        {/* Courses section */}
        <ScrollArea className="flex-1">
          {isExpanded && (
            <div className="px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Courses
              </span>
            </div>
          )}

          {isLoggedIn ? (
            <div className="py-1">
              {courses.map((course) => (
                <CourseItem
                  key={course.id}
                  course={course}
                  isExpanded={isExpanded}
                  isCourseExpanded={expandedCourses.has(course.id)}
                  isSelected={currentCourse?.id === course.id}
                  sections={getSectionsForCourse(course.id)}
                  loadingSections={loadingSections === course.id}
                  onToggleExpand={() => handleCourseClick(course)}
                  onCourseClick={() => handleCourseNavigate(course)}
                  onSectionClick={handleSectionClick}
                />
              ))}

              {/* New Course button */}
              {onNewCourse && (
                <NavButton
                  icon={<Plus size={20} />}
                  label="New Course"
                  isExpanded={isExpanded}
                  isActive={false}
                  onClick={onNewCourse}
                  variant="accent"
                />
              )}
            </div>
          ) : (
            isExpanded && (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">Sign in to view your courses</p>
              </div>
            )
          )}
        </ScrollArea>

        {/* Settings at bottom */}
        <div className="py-2 border-t border-sidebar-border">
          <NavButton
            icon={<Settings size={20} />}
            label="Settings"
            isExpanded={isExpanded}
            isActive={activeItem === 'settings'}
            onClick={() => onNavigate('settings')}
          />
        </div>
      </aside>
    </TooltipProvider>
  )
}

interface NavButtonProps {
  icon: ReactElement
  label: string
  isExpanded: boolean
  isActive: boolean
  onClick: () => void
  variant?: 'default' | 'accent'
}

function NavButton({
  icon,
  label,
  isExpanded,
  isActive,
  onClick,
  variant = 'default'
}: NavButtonProps): ReactElement {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center w-full h-10 px-3 gap-3 text-left transition-colors duration-150 rounded-md mx-1',
        isExpanded ? 'w-[calc(100%-8px)]' : 'w-[calc(100%-8px)] justify-center',
        isActive
          ? 'bg-sidebar-accent text-primary'
          : variant === 'accent'
            ? 'text-primary hover:bg-sidebar-accent'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      {isExpanded && <span className="truncate text-sm font-medium">{label}</span>}
    </button>
  )

  if (!isExpanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}

interface CourseItemProps {
  course: CourseSummary
  isExpanded: boolean
  isCourseExpanded: boolean
  isSelected: boolean
  sections: SectionSummary[]
  loadingSections: boolean
  onToggleExpand: () => void
  onCourseClick: () => void
  onSectionClick: (section: SectionSummary) => void
}

function CourseItem({
  course,
  isExpanded,
  isCourseExpanded,
  isSelected,
  sections,
  loadingSections,
  onToggleExpand,
  onCourseClick,
  onSectionClick
}: CourseItemProps): ReactElement {
  if (!isExpanded) {
    // Collapsed view - just show icon with tooltip
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onCourseClick}
            className={cn(
              'flex items-center justify-center w-[calc(100%-8px)] h-10 mx-1 rounded-md transition-colors duration-150',
              isSelected
                ? 'bg-sidebar-accent text-primary'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <BookOpen size={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {course.name}
        </TooltipContent>
      </Tooltip>
    )
  }

  // Expanded view
  return (
    <div>
      <div
        className={cn(
          'flex items-center w-[calc(100%-8px)] h-10 px-3 gap-2 mx-1 rounded-md transition-colors duration-150 cursor-pointer',
          isSelected
            ? 'bg-sidebar-accent text-primary'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
          className="p-0.5 rounded hover:bg-sidebar-accent transition-colors"
          aria-label={isCourseExpanded ? 'Collapse' : 'Expand'}
        >
          {isCourseExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronUp size={16} className="rotate-180" />
          )}
        </button>

        {/* Course name - clickable */}
        <button onClick={onCourseClick} className="flex-1 text-left truncate text-sm font-medium">
          {course.name}
        </button>

        {/* Section count badge */}
        {course.sectionCount > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {course.sectionCount}
          </span>
        )}
      </div>

      {/* Sections list */}
      {isCourseExpanded && (
        <div className="ml-5 pl-3 border-l border-sidebar-border">
          {loadingSections ? (
            <div className="px-3 py-2">
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          ) : sections.length > 0 ? (
            sections.map((section) => (
              <button
                key={section.id}
                onClick={() => onSectionClick(section)}
                className="flex items-center w-full h-9 pl-2 pr-3 gap-2 text-left transition-colors duration-150 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-md"
              >
                <Users size={14} className="flex-shrink-0 opacity-60" />
                <span className="flex-1 truncate text-sm">{section.name}</span>
                <span className="text-xs opacity-60">{section.studentCount}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2">
              <span className="text-xs text-muted-foreground">No sections</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
