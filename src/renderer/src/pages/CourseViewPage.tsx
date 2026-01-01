import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import SettingsIcon from '@mui/icons-material/Settings'
import PeopleIcon from '@mui/icons-material/People'
import ScheduleIcon from '@mui/icons-material/Schedule'
import RoomIcon from '@mui/icons-material/Room'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { useCourseStore, useSectionStore, useStandardsStore, useAssessmentStore } from '../stores'
import { SectionCreationModal } from '../components/sections'
import { StandardsImportModal } from '../components/standards'
import { AssessmentCreationModal } from '../components/assessments'
import { CourseSettingsModal, CourseEditModal } from '../components/courses'
import { CourseMaterialsSection } from '../components/courseMaterials'
import type { SectionSummary, AssessmentSummary, Course } from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

export interface CourseViewPageProps {
  onSectionSelect?: (section: SectionSummary) => void
  onAssessmentSelect?: (assessment: AssessmentSummary) => void
  onStandardsSelect?: () => void
}

export function CourseViewPage({ onSectionSelect, onAssessmentSelect, onStandardsSelect }: CourseViewPageProps): ReactElement {
  const { currentCourse, setCurrentCourse, fetchCourses, invalidateSidebarCache } = useCourseStore()
  const { sections, loading, error, fetchSections, clearSections } = useSectionStore()
  const { summaries: standardsSummaries, fetchCollections: fetchStandardsCollections, clearStandards } = useStandardsStore()
  const {
    assessments,
    loading: assessmentsLoading,
    error: assessmentsError,
    fetchAssessments,
    clearAssessments
  } = useAssessmentStore()

  // Aggregate standards count from all collections
  const totalStandardsCount = standardsSummaries.reduce((sum, s) => sum + s.standardCount, 0)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isStandardsModalOpen, setIsStandardsModalOpen] = useState(false)
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [fullCourse, setFullCourse] = useState<Course | null>(null)

  // Fetch sections, standards, and assessments when course changes
  useEffect(() => {
    if (currentCourse?.id) {
      fetchSections(currentCourse.id)
      fetchStandardsCollections(currentCourse.id)
      fetchAssessments(currentCourse.id)
    }
    return () => {
      clearSections()
      clearStandards()
      clearAssessments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [currentCourse?.id])

  const handleBackClick = (): void => {
    setCurrentCourse(null)
  }

  const handleOpenSettings = async (): Promise<void> => {
    if (!currentCourse?.id) return
    try {
      const result = await window.electronAPI.invoke<ServiceResult<Course>>(
        'drive:getCourse',
        currentCourse.id
      )
      if (result.success) {
        setFullCourse(result.data)
        setIsSettingsModalOpen(true)
      }
    } catch (err) {
      console.error('Failed to fetch course:', err)
    }
  }

  const handleSettingsSuccess = (updatedCourse: Course): void => {
    setFullCourse(updatedCourse)
  }

  const handleOpenEdit = async (): Promise<void> => {
    if (!currentCourse?.id) return
    try {
      const result = await window.electronAPI.invoke<ServiceResult<Course>>(
        'drive:getCourse',
        currentCourse.id
      )
      if (result.success) {
        setFullCourse(result.data)
        setIsEditModalOpen(true)
      }
    } catch (err) {
      console.error('Failed to fetch course:', err)
    }
  }

  const handleEditSuccess = (updatedCourse: Course): void => {
    setFullCourse(updatedCourse)
    // Update currentCourse with new data
    setCurrentCourse({
      ...currentCourse!,
      name: updatedCourse.name,
      subject: updatedCourse.subject,
      gradeLevel: updatedCourse.gradeLevel
    })
    // Refresh courses list and sidebar cache
    fetchCourses()
    invalidateSidebarCache()
  }

  if (!currentCourse) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Typography color="text.secondary">No course selected</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
      {/* Header */}
      <Box component="header">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBackClick}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Back to Dashboard
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" fontWeight={700}>
              {currentCourse.name}
            </Typography>
            <Tooltip title="Edit Course">
              <IconButton
                size="small"
                onClick={handleOpenEdit}
                sx={{ color: 'text.secondary' }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Course AI Settings">
              <IconButton
                size="small"
                onClick={handleOpenSettings}
                sx={{ color: 'text.secondary' }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {currentCourse.subject} | Grade {currentCourse.gradeLevel} | {currentCourse.academicYear}
          </Typography>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>{sections.length}</Typography>
            <Typography variant="body2" color="text.secondary">Sections</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>
              {sections.reduce((sum, s) => sum + s.studentCount, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Students</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>
              {totalStandardsCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">Standards</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>{assessments.length}</Typography>
            <Typography variant="body2" color="text.secondary">Assessments</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Sections */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Sections</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setIsCreateModalOpen(true)}>
            Add Section
          </Button>
        </Box>

        {/* Loading state */}
        {loading && sections.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => fetchSections(currentCourse.id)}>Try again</Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Empty state */}
        {!loading && !error && sections.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'rgba(229, 168, 13, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}
            >
              <PeopleIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>
            <Typography fontWeight={500} gutterBottom>No sections yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add sections to organize your students by period or block.
            </Typography>
            <Button variant="contained" onClick={() => setIsCreateModalOpen(true)}>
              Add Your First Section
            </Button>
          </Paper>
        )}

        {/* Sections list */}
        {sections.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                onView={() => onSectionSelect?.(section)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Standards Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Standards Collections</Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsStandardsModalOpen(true)}
          >
            Add Collection
          </Button>
        </Box>

        {/* Empty state */}
        {standardsSummaries.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'rgba(229, 168, 13, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}
            >
              <MenuBookIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>
            <Typography fontWeight={500} gutterBottom>No standards imported</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Import teaching standards to align your assessments.
            </Typography>
            <Button variant="contained" onClick={() => setIsStandardsModalOpen(true)}>
              Import Standards
            </Button>
          </Paper>
        )}

        {/* Standards collections list */}
        {standardsSummaries.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {standardsSummaries.map((summary) => (
              <Paper
                key={summary.id}
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' }
                }}
                onClick={onStandardsSelect}
              >
                <Box>
                  <Typography fontWeight={500}>{summary.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {summary.framework} - {summary.state} | {summary.standardCount} standards across {summary.domainCount} domains
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Course Materials Section */}
      <Box component="section">
        <CourseMaterialsSection
          courseId={currentCourse.id}
          courseName={currentCourse.name}
        />
      </Box>

      {/* Assessments Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Assessments</Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsAssessmentModalOpen(true)}
          >
            Add Assessment
          </Button>
        </Box>

        {/* Loading state */}
        {assessmentsLoading && assessments.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Error state */}
        {assessmentsError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => fetchAssessments(currentCourse.id)}>Try again</Button>
            }
          >
            {assessmentsError}
          </Alert>
        )}

        {/* Empty state */}
        {!assessmentsLoading && !assessmentsError && assessments.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'rgba(229, 168, 13, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}
            >
              <AssignmentIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>
            <Typography fontWeight={500} gutterBottom>No assessments yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create assessments to test student understanding.
            </Typography>
            <Button variant="contained" onClick={() => setIsAssessmentModalOpen(true)}>
              Create Your First Assessment
            </Button>
          </Paper>
        )}

        {/* Assessments list */}
        {assessments.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {assessments.map((assessment) => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                onView={() => onAssessmentSelect?.(assessment)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Section Creation Modal */}
      <SectionCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        courseId={currentCourse.id}
        courseName={currentCourse.name}
        onSuccess={() => {
          // Refresh courses list to update sectionCount, and invalidate sidebar's sections cache
          fetchCourses()
          invalidateSidebarCache()
        }}
      />

      {/* Standards Import Modal */}
      <StandardsImportModal
        isOpen={isStandardsModalOpen}
        onClose={() => setIsStandardsModalOpen(false)}
        courseId={currentCourse.id}
        courseName={currentCourse.name}
        courseSubject={currentCourse.subject}
        courseGradeLevel={currentCourse.gradeLevel}
        onSuccess={() => {
          fetchStandardsCollections(currentCourse.id)
        }}
      />

      {/* Assessment Creation Modal */}
      <AssessmentCreationModal
        isOpen={isAssessmentModalOpen}
        onClose={() => setIsAssessmentModalOpen(false)}
        courseId={currentCourse.id}
        courseName={currentCourse.name}
        onSuccess={(assessment) => {
          console.log('Assessment created:', assessment.title)
        }}
      />

      {/* Course Settings Modal */}
      {fullCourse && (
        <CourseSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          course={fullCourse}
          onSuccess={handleSettingsSuccess}
        />
      )}

      {/* Course Edit Modal */}
      {fullCourse && (
        <CourseEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          course={fullCourse}
          onSuccess={handleEditSuccess}
        />
      )}
    </Box>
  )
}

interface SectionCardProps {
  section: SectionSummary
  onView: () => void
}

function SectionCard({ section, onView }: SectionCardProps): ReactElement {
  return (
    <Paper
      variant="outlined"
      onClick={onView}
      sx={{
        p: 2,
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main'
        }
      }}
    >
      <Box>
        <Typography fontWeight={500}>{section.name}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <PeopleIcon sx={{ fontSize: 14 }} />
            <Typography variant="body2">{section.studentCount} students</Typography>
          </Box>
          {section.schedule && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <ScheduleIcon sx={{ fontSize: 14 }} />
              <Typography variant="body2">{section.schedule}</Typography>
            </Box>
          )}
          {section.room && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <RoomIcon sx={{ fontSize: 14 }} />
              <Typography variant="body2">{section.room}</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  )
}

interface AssessmentCardProps {
  assessment: AssessmentSummary
  onView: () => void
}

function AssessmentCard({ assessment, onView }: AssessmentCardProps): ReactElement {
  const getStatusColor = (): 'primary' | 'success' => {
    switch (assessment.status) {
      case 'published':
        return 'success'
      default:
        return 'primary'
    }
  }

  return (
    <Paper
      variant="outlined"
      onClick={onView}
      sx={{
        p: 2,
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main'
        }
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={assessment.status}
            size="small"
            color={getStatusColor()}
            variant="outlined"
          />
          <Typography fontWeight={500}>{assessment.title}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <AssignmentIcon sx={{ fontSize: 14 }} />
            <Typography variant="body2">
              {assessment.questionCount} {assessment.questionCount === 1 ? 'question' : 'questions'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {assessment.totalPoints} {assessment.totalPoints === 1 ? 'point' : 'points'}
          </Typography>
          <Chip
            label={assessment.type}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>
    </Paper>
  )
}
