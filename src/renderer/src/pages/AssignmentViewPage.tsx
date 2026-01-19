import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PrintIcon from '@mui/icons-material/Print'
import DeleteIcon from '@mui/icons-material/Delete'
import PeopleIcon from '@mui/icons-material/People'
import QuizIcon from '@mui/icons-material/Quiz'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import GradingIcon from '@mui/icons-material/Grading'
import BarChartIcon from '@mui/icons-material/BarChart'
import { useAssignmentStore, useRosterStore, useGradeStore } from '../stores'
import { ScantronGenerationModal } from '../components/assignments'
import { ScantronUploadModal, GradeReviewPanel, QuestionStatsModal } from '../components/grades'
import { ConfirmModal } from '../components/ui'
import type {
  CourseSummary,
  SectionSummary,
  AssignmentSummary,
  AssignmentStatus
} from '../../../shared/types'

interface AssignmentViewPageProps {
  course: CourseSummary
  section: SectionSummary
  assignmentSummary: AssignmentSummary
  onBack: () => void
  onDeleted: () => void
}

const statusLabels: Record<AssignmentStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  collecting: 'Collecting',
  grading: 'Grading',
  graded: 'Graded'
}

const statusColors: Record<
  AssignmentStatus,
  'default' | 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error'
> = {
  draft: 'default',
  assigned: 'primary',
  collecting: 'info',
  grading: 'warning',
  graded: 'success'
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Not set'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function AssignmentViewPage({
  course,
  section,
  assignmentSummary,
  onBack,
  onDeleted
}: AssignmentViewPageProps): ReactElement {
  const {
    currentAssignment,
    loading,
    error,
    getAssignment,
    deleteAssignment,
    setCurrentAssignment,
    clearError
  } = useAssignmentStore()
  const { roster, fetchRoster } = useRosterStore()
  const { currentGrades, isProcessing: isLoadingGrades, clearGrades, setContext, fetchGrades } = useGradeStore()

  const [isScantronModalOpen, setIsScantronModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showGradeReview, setShowGradeReview] = useState(false)
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false)

  // Fetch full assignment, roster, and existing grades when page loads
  useEffect(() => {
    getAssignment(assignmentSummary.id)
    fetchRoster(section.id)
    setContext(assignmentSummary.id, section.id)
    // Fetch any existing grades for this assignment
    fetchGrades(assignmentSummary.id, section.id)
    return () => {
      setCurrentAssignment(null)
      clearError()
      clearGrades()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentSummary.id, section.id])

  // Handle processing complete
  const handleProcessingComplete = (): void => {
    setShowGradeReview(true)
  }

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true)
    const success = await deleteAssignment(assignmentSummary.id, section.id)
    setIsDeleting(false)

    if (success) {
      setIsDeleteModalOpen(false)
      onDeleted()
    }
  }

  // Get student names from roster
  const getStudentName = (studentId: string): string => {
    if (!roster) return studentId
    const student = roster.students.find((s) => s.id === studentId)
    if (!student) return studentId
    return `${student.lastName}, ${student.firstName}`
  }

  const assignment = currentAssignment

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
      {/* Header */}
      <Box component="header">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Back to {section.name}
        </Button>

        <Box
          sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography variant="h5" fontWeight={700}>
                {assignmentSummary.assessmentTitle}
              </Typography>
              <Chip
                label={statusLabels[assignmentSummary.status]}
                color={statusColors[assignmentSummary.status]}
                size="small"
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {course.name} &bull; {section.name}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => setIsScantronModalOpen(true)}
            >
              Generate Scantrons
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<GradingIcon />}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Grade Scantrons
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Loading state */}
      {loading && !assignment && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert
          severity="error"
          action={
            <Button size="small" onClick={() => getAssignment(assignmentSummary.id)}>
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Assignment Details */}
      {assignment && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {/* Left Column - Assignment Info */}
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Assignment Details
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <QuizIcon sx={{ color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Questions
                  </Typography>
                  <Typography variant="body1">{assignment.questionCount} questions</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PeopleIcon sx={{ color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Students
                  </Typography>
                  <Typography variant="body1">
                    {assignment.studentAssignments.length} student
                    {assignment.studentAssignments.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CalendarTodayIcon sx={{ color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Assigned Date
                  </Typography>
                  <Typography variant="body1">{formatDate(assignment.assignedDate)}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CalendarTodayIcon sx={{ color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Due Date
                  </Typography>
                  <Typography variant="body1">{formatDate(assignment.dueDate)}</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Right Column - Student List */}
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Assigned Students
            </Typography>

            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {assignment.studentAssignments.map((sa) => (
                <ListItem key={sa.studentId} divider>
                  <ListItemText
                    primary={getStudentName(sa.studentId)}
                    secondary={`Version ${sa.versionId}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      {/* Grade Review Panel */}
      {(showGradeReview || currentGrades || isLoadingGrades) && roster && (
        <>
          <Divider sx={{ my: 2 }} />
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GradingIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Grades
                </Typography>
                {currentGrades && (
                  <>
                    <Chip
                      label={`${currentGrades.records.length} graded`}
                      size="small"
                      color="success"
                    />
                    <IconButton
                      size="small"
                      onClick={() => setIsStatsModalOpen(true)}
                      sx={{
                        ml: 1,
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'action.selected' }
                      }}
                      title="View Question Statistics"
                    >
                      <BarChartIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
              {!currentGrades && !isLoadingGrades && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowGradeReview(false)}
                >
                  Hide
                </Button>
              )}
            </Box>
            {isLoadingGrades && !currentGrades ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
                <Typography sx={{ ml: 2 }} color="text.secondary">
                  Loading grades...
                </Typography>
              </Box>
            ) : (
              <GradeReviewPanel students={roster.students} />
            )}
          </Paper>
        </>
      )}

      {/* Scantron Generation Modal */}
      <ScantronGenerationModal
        isOpen={isScantronModalOpen}
        onClose={() => setIsScantronModalOpen(false)}
        assignment={assignmentSummary}
        sectionName={section.name}
      />

      {/* Scantron Upload Modal */}
      <ScantronUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        assignment={assignment}
        onProcessingComplete={handleProcessingComplete}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Assignment"
        message={`Are you sure you want to delete the assignment "${assignmentSummary.assessmentTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Question Statistics Modal */}
      {currentGrades && roster && (
        <QuestionStatsModal
          isOpen={isStatsModalOpen}
          onClose={() => setIsStatsModalOpen(false)}
          assessmentId={currentGrades.assessmentId}
          gradeStats={currentGrades.stats}
          gradeRecords={currentGrades.records}
          students={roster.students}
        />
      )}
    </Box>
  )
}
