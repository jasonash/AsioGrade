import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PublishIcon from '@mui/icons-material/Publish'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import ScoreIcon from '@mui/icons-material/Score'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { useAssessmentStore, useStandardsStore, useUnitStore } from '../stores'
import { ConfirmModal } from '../components/ui'
import { AssessmentEditModal, QuestionList, AIAssistantPanel } from '../components/assessments'
import type {
  CourseSummary,
  UnitSummary,
  Unit,
  AssessmentSummary,
  AssessmentType,
  Standard,
  MultipleChoiceQuestion
} from '../../../shared/types'

interface AssessmentViewPageProps {
  course: CourseSummary
  unit: UnitSummary
  assessmentSummary: AssessmentSummary
  onBack: () => void
  onDeleted: () => void
}

const typeLabels: Record<AssessmentType, string> = {
  test: 'Test',
  quiz: 'Quiz',
  exam: 'Exam',
  benchmark: 'Benchmark',
  pretest: 'Pre-Test',
  exit_ticket: 'Exit Ticket'
}

const typeColors: Record<AssessmentType, 'primary' | 'secondary' | 'info' | 'warning' | 'success'> =
  {
    test: 'primary',
    quiz: 'info',
    exam: 'warning',
    benchmark: 'secondary',
    pretest: 'success',
    exit_ticket: 'info'
  }

export function AssessmentViewPage({
  course,
  unit,
  assessmentSummary,
  onBack,
  onDeleted
}: AssessmentViewPageProps): ReactElement {
  const {
    currentAssessment,
    loading,
    error,
    getAssessment,
    updateAssessment,
    deleteAssessment,
    clearError
  } = useAssessmentStore()
  const { allCollections, fetchAllCollections } = useStandardsStore()
  const { getUnit } = useUnitStore()

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [fullUnit, setFullUnit] = useState<Unit | null>(null)

  // Fetch full assessment details, standards, and unit when component mounts
  useEffect(() => {
    getAssessment(assessmentSummary.id)
    fetchAllCollections(course.id)
    getUnit(course.id, unit.id).then(setFullUnit)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [assessmentSummary.id, course.id, unit.id])

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true)
    const success = await deleteAssessment(assessmentSummary.id, unit.id)
    setIsDeleting(false)

    if (success) {
      setIsDeleteModalOpen(false)
      onDeleted()
    }
  }

  const handlePublish = async (): Promise<void> => {
    if (!currentAssessment) return

    setIsPublishing(true)
    await updateAssessment({
      id: currentAssessment.id,
      courseId: currentAssessment.courseId,
      unitId: currentAssessment.unitId,
      status: 'published'
    })
    setIsPublishing(false)
  }

  const handleQuestionsChange = async (
    questions: MultipleChoiceQuestion[]
  ): Promise<void> => {
    if (!currentAssessment) return

    await updateAssessment({
      id: currentAssessment.id,
      courseId: currentAssessment.courseId,
      unitId: currentAssessment.unitId,
      questions
    })
  }

  // Handler for accepting AI-generated questions
  const handleQuestionsAccepted = async (
    newQuestions: MultipleChoiceQuestion[]
  ): Promise<void> => {
    if (!currentAssessment) return

    const updatedQuestions = [...currentAssessment.questions, ...newQuestions]
    await updateAssessment({
      id: currentAssessment.id,
      courseId: currentAssessment.courseId,
      unitId: currentAssessment.unitId,
      questions: updatedQuestions
    })
  }

  // Handler for refined questions
  const handleQuestionRefined = async (
    questionId: string,
    refined: MultipleChoiceQuestion
  ): Promise<void> => {
    if (!currentAssessment) return

    const updatedQuestions = currentAssessment.questions.map((q) =>
      q.id === questionId ? refined : q
    )
    await updateAssessment({
      id: currentAssessment.id,
      courseId: currentAssessment.courseId,
      unitId: currentAssessment.unitId,
      questions: updatedQuestions
    })
  }

  // Get all standards from all collections for alignment
  const getAllStandards = (): Standard[] => {
    const standards: Standard[] = []
    for (const collection of allCollections) {
      for (const domain of collection.domains) {
        standards.push(...domain.standards)
      }
    }
    return standards
  }

  const allStandards = getAllStandards()

  // Separate unit standards from other standards for AI generation
  const unitStandardRefs = fullUnit?.standardRefs ?? []
  const unitStandards = allStandards.filter((s) => unitStandardRefs.includes(s.code))
  const otherStandards = allStandards.filter((s) => !unitStandardRefs.includes(s.code))

  // Calculate stats
  const totalPoints = currentAssessment?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0
  const alignedStandardsCount = new Set(
    currentAssessment?.questions
      .filter((q) => q.standardRef)
      .map((q) => q.standardRef) ?? []
  ).size

  // Loading state
  if (loading && !currentAssessment) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh'
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
      {/* Header */}
      <Box component="header">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Back to {unit.name}
        </Button>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Chip
                label={typeLabels[assessmentSummary.type]}
                color={typeColors[assessmentSummary.type]}
                size="small"
              />
              {currentAssessment?.status === 'draft' && (
                <Chip label="Draft" variant="outlined" size="small" />
              )}
              {currentAssessment?.status === 'published' && (
                <Chip label="Published" color="success" size="small" />
              )}
              <Typography variant="h4" fontWeight={700}>
                {currentAssessment?.title ?? assessmentSummary.title}
              </Typography>
            </Box>

            {currentAssessment?.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {currentAssessment.description}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {currentAssessment?.status === 'draft' && (
              <Button
                variant="contained"
                color="success"
                startIcon={<PublishIcon />}
                onClick={handlePublish}
                disabled={
                  isPublishing || (currentAssessment?.questions.length ?? 0) === 0
                }
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit
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

      {/* Error display */}
      {error && (
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Stats cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HelpOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Questions
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {currentAssessment?.questions.length ?? 0}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Total Points
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {totalPoints}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MenuBookIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Standards Aligned
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {alignedStandardsCount}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Divider />

      {/* Questions section with AI Assistant */}
      <Grid container spacing={3}>
        {/* Questions List */}
        <Grid size={{ xs: 12, md: currentAssessment?.status === 'draft' ? 8 : 12 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Questions
          </Typography>

          <QuestionList
            questions={(currentAssessment?.questions as MultipleChoiceQuestion[]) ?? []}
            standards={allStandards}
            onQuestionsChange={handleQuestionsChange}
            readOnly={currentAssessment?.status === 'published'}
          />

          {currentAssessment?.status === 'published' && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2, fontStyle: 'italic' }}
            >
              This assessment has been published and cannot be edited. Create a new version
              if you need to make changes.
            </Typography>
          )}
        </Grid>

        {/* AI Assistant Panel - Only show for draft assessments */}
        {currentAssessment?.status === 'draft' && (
          <Grid size={{ xs: 12, md: 4 }}>
            <AIAssistantPanel
              courseId={course.id}
              unitId={unit.id}
              assessmentId={currentAssessment.id}
              assessmentTitle={currentAssessment.title}
              gradeLevel={course.gradeLevel}
              subject={course.subject}
              unitStandards={unitStandards}
              otherStandards={otherStandards}
              existingQuestions={(currentAssessment.questions as MultipleChoiceQuestion[]) ?? []}
              onQuestionsAccepted={handleQuestionsAccepted}
              onQuestionRefined={handleQuestionRefined}
            />
          </Grid>
        )}
      </Grid>

      {/* Edit Modal */}
      {currentAssessment && (
        <AssessmentEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false)
            getAssessment(assessmentSummary.id)
          }}
          assessment={currentAssessment}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Assessment"
        message={`Are you sure you want to delete "${assessmentSummary.title}"? This action cannot be undone.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="destructive"
        isLoading={isDeleting}
      />
    </Box>
  )
}
