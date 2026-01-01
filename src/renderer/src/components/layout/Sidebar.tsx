import type { ReactElement } from 'react'
import { useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Collapse from '@mui/material/Collapse'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import MuiTooltip from '@mui/material/Tooltip'
import HomeIcon from '@mui/icons-material/Home'
import SettingsIcon from '@mui/icons-material/Settings'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PeopleIcon from '@mui/icons-material/People'
import AddIcon from '@mui/icons-material/Add'
import { useCourseStore, useUIStore, useAuthStore } from '../../stores'
import type { CourseSummary, SectionSummary, ServiceResult } from '../../../../shared/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import logoImage from '../../assets/logo.png'

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
  const { courses, currentCourse, fetchCourses, sidebarCacheVersion } = useCourseStore()
  const { expandedCourses, toggleCourseExpanded, setCourseExpanded } = useUIStore()
  // Local cache of sections per course (for displaying multiple expanded courses)
  // Note: Sidebar manages its own cache independently of the global section store
  // to avoid race conditions when switching between courses
  const [sectionsCache, setSectionsCache] = useState<Record<string, SectionSummary[]>>({})
  const [loadingSections, setLoadingSections] = useState<string | null>(null)

  // Clear sections cache and re-fetch when sidebarCacheVersion changes (sections were added/deleted/edited elsewhere)
  useEffect(() => {
    if (sidebarCacheVersion > 0) {
      setSectionsCache({})
      // Immediately re-fetch for any expanded courses
      courses.forEach((course) => {
        if (expandedCourses.has(course.id)) {
          window.electronAPI.invoke<ServiceResult<SectionSummary[]>>(
            'drive:listSections',
            course.id
          ).then((result) => {
            if (result.success) {
              setSectionsCache((prev) => ({
                ...prev,
                [course.id]: result.data
              }))
            }
          })
        }
      })
    }
  }, [sidebarCacheVersion, courses, expandedCourses])

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
    <Box
      component="aside"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        transition: 'width 0.2s ease-out',
        width: isExpanded ? 240 : 60,
        overflow: 'hidden'
      }}
    >
      {/* Header with app name and toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 56,
          px: 1.5,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        {isExpanded ? (
          <>
            <Box
              component="img"
              src={logoImage}
              alt="AsioGrade"
              sx={{ width: 28, height: 28, borderRadius: 0.5, mr: 1 }}
            />
            <Typography
              variant="h6"
              sx={{ flex: 1, fontFamily: '"DM Serif Text", serif', fontWeight: 400, color: 'text.primary' }}
            >
              AsioGrade
            </Typography>
            <IconButton
              size="small"
              onClick={onToggle}
              sx={{ color: 'text.secondary' }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </>
        ) : (
          <MuiTooltip title="Expand sidebar" placement="right" arrow>
            <IconButton
              size="small"
              onClick={onToggle}
              sx={{ width: '100%', p: 0 }}
            >
              <Box
                component="img"
                src={logoImage}
                alt="AsioGrade"
                sx={{ width: 32, height: 32, borderRadius: 0.5 }}
              />
            </IconButton>
          </MuiTooltip>
        )}
      </Box>

      {/* Dashboard link */}
      <Box sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <NavButton
          icon={<HomeIcon />}
          label="Dashboard"
          isExpanded={isExpanded}
          isActive={activeItem === 'dashboard' && !currentCourse}
          onClick={() => onNavigate('dashboard')}
        />
      </Box>

      {/* Courses section */}
      <ScrollArea sx={{ flex: 1 }}>
        {isExpanded && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Courses
            </Typography>
          </Box>
        )}

        {isLoggedIn ? (
          <List disablePadding sx={{ py: 0.5 }}>
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
                icon={<AddIcon />}
                label="New Course"
                isExpanded={isExpanded}
                isActive={false}
                onClick={onNewCourse}
                variant="accent"
              />
            )}
          </List>
        ) : (
          isExpanded && (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Sign in to view your courses
              </Typography>
            </Box>
          )
        )}
      </ScrollArea>

      {/* Settings at bottom */}
      <Box sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
        <NavButton
          icon={<SettingsIcon />}
          label="Settings"
          isExpanded={isExpanded}
          isActive={activeItem === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </Box>
    </Box>
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
    <ListItem disablePadding sx={{ px: 0.5 }}>
      <ListItemButton
        onClick={onClick}
        selected={isActive}
        sx={{
          minHeight: 40,
          borderRadius: 1,
          justifyContent: isExpanded ? 'initial' : 'center',
          px: isExpanded ? 1.5 : 1,
          color: variant === 'accent' ? 'primary.main' : 'text.secondary',
          '&.Mui-selected': {
            bgcolor: 'action.selected',
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'action.selected'
            }
          },
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: isExpanded ? 1.5 : 0,
            justifyContent: 'center',
            color: 'inherit'
          }}
        >
          {icon}
        </ListItemIcon>
        {isExpanded && (
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: 500
            }}
          />
        )}
      </ListItemButton>
    </ListItem>
  )

  if (!isExpanded) {
    return (
      <MuiTooltip title={label} placement="right" arrow>
        {button}
      </MuiTooltip>
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
      <MuiTooltip title={course.name} placement="right" arrow>
        <ListItem disablePadding sx={{ px: 0.5 }}>
          <ListItemButton
            onClick={onCourseClick}
            selected={isSelected}
            sx={{
              minHeight: 40,
              borderRadius: 1,
              justifyContent: 'center',
              px: 1,
              '&.Mui-selected': {
                bgcolor: 'action.selected',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'action.selected'
                }
              }
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                justifyContent: 'center',
                color: isSelected ? 'primary.main' : 'text.secondary'
              }}
            >
              <MenuBookIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
      </MuiTooltip>
    )
  }

  // Expanded view
  return (
    <Box>
      <ListItem
        disablePadding
        sx={{ px: 0.5 }}
        secondaryAction={
          course.sectionCount > 0 ? (
            <Chip
              label={course.sectionCount}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                mr: 0.5
              }}
            />
          ) : undefined
        }
      >
        <ListItemButton
          selected={isSelected}
          sx={{
            minHeight: 40,
            borderRadius: 1,
            pr: course.sectionCount > 0 ? 5 : 1.5,
            '&.Mui-selected': {
              bgcolor: 'action.selected',
              color: 'primary.main',
              '&:hover': {
                bgcolor: 'action.selected'
              }
            }
          }}
        >
          {/* Expand/collapse toggle */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            sx={{ mr: 0.5, p: 0.25 }}
          >
            {isCourseExpanded ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>

          {/* Course name - clickable */}
          <ListItemText
            primary={course.name}
            onClick={onCourseClick}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: 500,
              noWrap: true,
              sx: { cursor: 'pointer' }
            }}
          />
        </ListItemButton>
      </ListItem>

      {/* Sections list */}
      <Collapse in={isCourseExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 2.5, pl: 1.5, borderLeft: 1, borderColor: 'divider' }}>
          {loadingSections ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Loading...
              </Typography>
            </Box>
          ) : sections.length > 0 ? (
            <List disablePadding>
              {sections.map((section) => (
                <ListItem key={section.id} disablePadding>
                  <ListItemButton
                    onClick={() => onSectionClick(section)}
                    sx={{
                      minHeight: 36,
                      borderRadius: 1,
                      py: 0.5
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28, color: 'text.disabled' }}>
                      <PeopleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={section.name}
                      primaryTypographyProps={{
                        variant: 'body2',
                        noWrap: true
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ ml: 1 }}
                    >
                      {section.studentCount}
                    </Typography>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ px: 1.5, py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                No sections
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}
