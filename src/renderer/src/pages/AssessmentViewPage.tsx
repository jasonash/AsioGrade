import { type ReactElement, useEffect, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PublishIcon from '@mui/icons-material/Publish'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import ScoreIcon from '@mui/icons-material/Score'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import TuneIcon from '@mui/icons-material/Tune'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import { useAssessmentStore, useStandardsStore } from '../stores'
import { ConfirmModal } from '../components/ui'
import {
  AssessmentEditModal,
  QuestionList,
  AIAssistantPanel,
  VariantGenerationModal,
  VariantSelector,
  VersionSelector,
  BatchVariantModal,
  BatchProgressModal
} from '../components/assessments'
import type {
  CourseSummary,
  AssessmentSummary,
  AssessmentType,
  Standard,
  MultipleChoiceQuestion,
  VersionId,
  Question
} from '../../../shared/types'
import type { DOKLevel } from '../../../shared/types/roster.types'
import { QUIZ_MIN_QUESTIONS, QUIZ_MAX_QUESTIONS } from '../../../shared/types/assessment.types'

interface AssessmentViewPageProps {
  course: CourseSummary
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
  assessmentSummary,
  onBack,
  onDeleted
}: AssessmentViewPageProps): ReactElement {
  const {
    currentAssessment,
    loading,
    generatingVariant,
    generatingVersions,
    batchGenerating,
    batchProgress,
    error,
    setCurrentCourseId,
    getAssessment,
    updateAssessment,
    deleteAssessment,
    deleteVariant,
    updateVariantQuestion,
    generateVersions,
    clearVersions,
    clearError
  } = useAssessmentStore()
  const { allCollections, fetchAllCollections } = useStandardsStore()

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false)
  const [isBatchVariantModalOpen, setIsBatchVariantModalOpen] = useState(false)
  const [isDeleteVariantModalOpen, setIsDeleteVariantModalOpen] = useState(false)
  const [variantToDelete, setVariantToDelete] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<VersionId | null>(null)
  const [isGenerateVersionsModalOpen, setIsGenerateVersionsModalOpen] = useState(false)
  const [isClearVersionsModalOpen, setIsClearVersionsModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // Fetch full assessment details and standards when component mounts
  useEffect(() => {
    setCurrentCourseId(course.id)
    getAssessment(assessmentSummary.id)
    fetchAllCollections(course.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [assessmentSummary.id, course.id])

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true)
    const success = await deleteAssessment(assessmentSummary.id, course.id)
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
      questions: updatedQuestions
    })
  }

  // Handler for deleting a variant
  const handleDeleteVariantClick = (variantId: string): void => {
    setVariantToDelete(variantId)
    setIsDeleteVariantModalOpen(true)
  }

  const handleDeleteVariant = async (): Promise<void> => {
    if (!variantToDelete) return

    setIsDeleting(true)
    const success = await deleteVariant(variantToDelete)
    setIsDeleting(false)

    if (success) {
      // If we deleted the currently selected variant, go back to base
      if (selectedVariantId === variantToDelete) {
        setSelectedVariantId(null)
      }
      setIsDeleteVariantModalOpen(false)
      setVariantToDelete(null)
    }
  }

  // Handler for editing a question within a variant
  const handleVariantQuestionEdit = async (question: MultipleChoiceQuestion): Promise<void> => {
    if (!selectedVariantId) return
    await updateVariantQuestion(selectedVariantId, question)
  }

  // Handler for generating randomized versions (A/B/C/D)
  const handleGenerateVersions = async (): Promise<void> => {
    if (!currentAssessment) return

    const versions = await generateVersions(currentAssessment.id, course.id)
    if (versions) {
      setIsGenerateVersionsModalOpen(false)
      // Optionally select version A after generating
      setSelectedVersionId('A')
    }
  }

  // Handler for clearing versions
  const handleClearVersions = async (): Promise<void> => {
    if (!currentAssessment) return

    const success = await clearVersions(currentAssessment.id, course.id)
    if (success) {
      setIsClearVersionsModalOpen(false)
      setSelectedVersionId(null)
    }
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

  // Get standard refs from base questions
  const standardRefs = useMemo(() => {
    if (!currentAssessment) return []
    return currentAssessment.questions
      .map((q) => q.standardRef)
      .filter((ref): ref is string => ref !== undefined)
  }, [currentAssessment])

  // Get existing variant DOK levels
  const existingVariantDOKs = useMemo((): DOKLevel[] => {
    if (!currentAssessment?.variants) return []
    return currentAssessment.variants.map((v) => v.dokLevel)
  }, [currentAssessment?.variants])

  // Memoize variants for modal to prevent infinite re-render loop
  const existingVariantsForModal = useMemo(
    () => currentAssessment?.variants ?? [],
    [currentAssessment?.variants]
  )

  // Get the currently displayed questions (base, variant, or versioned)
  const displayedQuestions = useMemo(() => {
    if (!currentAssessment) return []

    // Determine base questions and versions to use
    const selectedVariant = selectedVariantId
      ? currentAssessment.variants?.find((v) => v.id === selectedVariantId)
      : null
    const baseQuestions = selectedVariant?.questions ?? currentAssessment.questions
    const versions = selectedVariant?.versions ?? currentAssessment.versions

    // If viewing a randomized version (A/B/C/D)
    if (selectedVersionId && versions) {
      const version = versions.find((v) => v.versionId === selectedVersionId)
      if (version) {
        // Create question map
        const questionMap = new Map(baseQuestions.map((q) => [q.id, q]))

        // Reorder questions according to version
        const reorderedQuestions: Question[] = []
        for (const qId of version.questionOrder) {
          const question = questionMap.get(qId)
          if (!question) continue

          // For multiple choice questions, also reorder choices
          if (question.type === 'multiple_choice' && question.choices) {
            const choiceOrder = version.choiceOrders[qId]
            if (choiceOrder) {
              const choiceMap = new Map(question.choices.map((c) => [c.id, c]))
              const reorderedChoices = choiceOrder
                .map((id) => choiceMap.get(id))
                .filter((c): c is NonNullable<typeof c> => c !== undefined)

              reorderedQuestions.push({
                ...question,
                choices: reorderedChoices
              })
            } else {
              reorderedQuestions.push(question)
            }
          } else {
            reorderedQuestions.push(question)
          }
        }
        return reorderedQuestions
      }
    }

    // If viewing a DOK variant (without version selected), return variant questions
    if (selectedVariant) {
      return baseQuestions
    }

    return currentAssessment.questions
  }, [currentAssessment, selectedVariantId, selectedVersionId])

  // Check if viewing a variant or version
  const isViewingVariant = selectedVariantId !== null
  const isViewingVersion = selectedVersionId !== null

  // Quiz-specific logic
  const isQuiz = currentAssessment?.type === 'quiz'
  const questionCount = currentAssessment?.questions.length ?? 0
  const quizHasTooFewQuestions = isQuiz && questionCount < QUIZ_MIN_QUESTIONS
  const quizHasTooManyQuestions = isQuiz && questionCount > QUIZ_MAX_QUESTIONS
  const quizLimitViolation = quizHasTooFewQuestions || quizHasTooManyQuestions

  // Calculate stats based on displayed questions
  const totalPoints = displayedQuestions.reduce((sum, q) => sum + q.points, 0)
  const alignedStandardsCount = new Set(
    displayedQuestions
      .filter((q) => q.standardRef)
      .map((q) => q.standardRef)
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
          Back to {course.name}
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

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {currentAssessment?.status === 'draft' && (
              <>
                <Tooltip title="Generate DOK variants and A/B/C/D versions for differentiated instruction">
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={batchGenerating ? <CircularProgress size={16} /> : <TuneIcon />}
                      onClick={() => setIsBatchVariantModalOpen(true)}
                      disabled={batchGenerating || generatingVariant || generatingVersions || (currentAssessment?.questions.length ?? 0) === 0}
                    >
                      {batchGenerating
                        ? 'Generating...'
                        : currentAssessment?.variants?.length || currentAssessment?.versions?.length
                          ? 'Manage Variants'
                          : 'Generate Variants'}
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PublishIcon />}
                  onClick={handlePublish}
                  disabled={
                    isPublishing || batchGenerating || generatingVersions || (currentAssessment?.questions.length ?? 0) === 0 || quizLimitViolation
                  }
                >
                  {isPublishing ? 'Publishing...' : 'Publish'}
                </Button>
              </>
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

      {/* Quiz limit warning */}
      {currentAssessment?.status === 'draft' && quizLimitViolation && (
        <Alert severity="warning">
          {quizHasTooFewQuestions
            ? `Quizzes require at least ${QUIZ_MIN_QUESTIONS} questions. Add ${QUIZ_MIN_QUESTIONS - questionCount} more question${QUIZ_MIN_QUESTIONS - questionCount === 1 ? '' : 's'} to publish.`
            : `Quizzes are limited to ${QUIZ_MAX_QUESTIONS} questions. Remove ${questionCount - QUIZ_MAX_QUESTIONS} question${questionCount - QUIZ_MAX_QUESTIONS === 1 ? '' : 's'} to publish.`}
        </Alert>
      )}

      {/* Stats cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HelpOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Questions
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {displayedQuestions.length}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
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

        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MenuBookIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Standards
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {alignedStandardsCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 2.4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                DOK Variants
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {currentAssessment?.variants?.length ?? 0}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 2.4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShuffleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Versions
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {currentAssessment?.versions?.length ?? 0}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Divider />

      {/* Variant Selector - Show when variants exist */}
      {currentAssessment?.variants && currentAssessment.variants.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              DOK Variants (Optional)
            </Typography>
            <Tooltip title="DOK variants allow differentiated instruction. Students assigned a DOK level receive the matching variant; others get the base assessment.">
              <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
            </Tooltip>
          </Box>
          <VariantSelector
            variants={currentAssessment.variants}
            selectedVariantId={selectedVariantId}
            onSelectVariant={(id) => {
              setSelectedVariantId(id)
              // Clear version selection when switching to variant
              if (id !== null) setSelectedVersionId(null)
            }}
            onDeleteVariant={currentAssessment.status === 'draft' ? handleDeleteVariantClick : undefined}
            disabled={loading || generatingVariant || generatingVersions}
          />
        </Box>
      )}

      {/* Version Selector - Show when versions exist (for base assessment or selected variant) */}
      {(() => {
        // Get versions and questions based on whether we're viewing a variant
        const selectedVariant = selectedVariantId
          ? currentAssessment?.variants?.find((v) => v.id === selectedVariantId)
          : null
        const versions = selectedVariant?.versions ?? currentAssessment?.versions
        const questionsForVersions = selectedVariant?.questions ?? currentAssessment?.questions ?? []

        if (!versions || versions.length === 0) return null

        return (
          <VersionSelector
            versions={versions}
            baseQuestions={questionsForVersions}
            selectedVersionId={selectedVersionId}
            onSelectVersion={setSelectedVersionId}
            disabled={loading || generatingVersions}
          />
        )
      })()}

      {/* Questions section with AI Assistant */}
      <Grid container spacing={3}>
        {/* Questions List */}
        <Grid size={{ xs: 12, md: currentAssessment?.status === 'draft' && !isViewingVariant && !isViewingVersion ? 8 : 12 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Questions
            </Typography>
            {isViewingVariant && (
              <Chip
                label="Viewing Variant"
                size="small"
                color="info"
                variant="outlined"
              />
            )}
            {isViewingVersion && (
              <Chip
                label={`Version ${selectedVersionId} (Read Only)`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          <QuestionList
            questions={displayedQuestions as MultipleChoiceQuestion[]}
            standards={allStandards}
            onQuestionsChange={handleQuestionsChange}
            readOnly={currentAssessment?.status === 'published' || isViewingVersion}
            variantEditMode={isViewingVariant && currentAssessment?.status === 'draft'}
            onVariantQuestionEdit={handleVariantQuestionEdit}
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

          {isViewingVariant && currentAssessment?.status === 'draft' && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2, fontStyle: 'italic' }}
            >
              Viewing a DOK variant. You can edit questions, but adding or deleting is only available on the base assessment.
            </Typography>
          )}

          {isViewingVariant && currentAssessment?.status === 'published' && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2, fontStyle: 'italic' }}
            >
              This assessment has been published. Variant questions cannot be edited.
            </Typography>
          )}

          {isViewingVersion && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2, fontStyle: 'italic' }}
            >
              Viewing Version {selectedVersionId} with shuffled questions and choices. Switch to Original Order to edit.
            </Typography>
          )}
        </Grid>

        {/* AI Assistant Panel - Only show for draft assessments when not viewing a variant or version */}
        {currentAssessment?.status === 'draft' && !isViewingVariant && !isViewingVersion && (
          <Grid size={{ xs: 12, md: 4 }}>
            <AIAssistantPanel
              courseId={course.id}
              assessmentId={currentAssessment.id}
              assessmentTitle={currentAssessment.title}
              assessmentType={currentAssessment.type}
              gradeLevel={course.gradeLevel}
              subject={course.subject}
              standards={allStandards}
              collections={allCollections}
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

      {/* Variant Generation Modal (legacy - kept for backwards compatibility) */}
      {currentAssessment && (
        <VariantGenerationModal
          isOpen={isVariantModalOpen}
          onClose={() => setIsVariantModalOpen(false)}
          onSuccess={() => {
            // Optionally switch to the new variant
          }}
          assessmentId={currentAssessment.id}
          courseId={course.id}
          gradeLevel={course.gradeLevel}
          subject={course.subject}
          standardRefs={standardRefs}
          existingVariantDOKs={existingVariantDOKs}
        />
      )}

      {/* Batch Variant Modal - unified modal for variants + versions */}
      {currentAssessment && (
        <BatchVariantModal
          isOpen={isBatchVariantModalOpen}
          onClose={() => setIsBatchVariantModalOpen(false)}
          onSuccess={() => {
            // Modal handles success internally
          }}
          assessmentId={currentAssessment.id}
          courseId={course.id}
          gradeLevel={course.gradeLevel}
          subject={course.subject}
          standardRefs={standardRefs}
          existingVariants={existingVariantsForModal}
          existingBaseVersions={currentAssessment.versions}
        />
      )}

      {/* Batch Progress Modal - shows during batch generation */}
      <BatchProgressModal isOpen={batchGenerating} progress={batchProgress} />

      {/* Delete Variant Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteVariantModalOpen}
        onClose={() => {
          setIsDeleteVariantModalOpen(false)
          setVariantToDelete(null)
        }}
        onConfirm={handleDeleteVariant}
        title="Delete Variant"
        message="Are you sure you want to delete this DOK variant? This action cannot be undone."
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* Generate Versions Confirmation Modal */}
      <ConfirmModal
        isOpen={isGenerateVersionsModalOpen}
        onClose={() => setIsGenerateVersionsModalOpen(false)}
        onConfirm={handleGenerateVersions}
        title={currentAssessment?.versions?.length ? 'Regenerate Versions' : 'Generate Versions'}
        message={
          currentAssessment?.versions?.length
            ? 'This will replace the existing A/B/C/D versions with new randomized versions. Are you sure?'
            : 'This will generate 4 randomized versions (A, B, C, D) of the assessment with shuffled question order and answer choices. Each version will have a different answer key.'
        }
        confirmText={generatingVersions ? 'Generating...' : 'Generate'}
        variant="default"
        isLoading={generatingVersions}
      />

      {/* Clear Versions Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearVersionsModalOpen}
        onClose={() => setIsClearVersionsModalOpen(false)}
        onConfirm={handleClearVersions}
        title="Clear Versions"
        message="Are you sure you want to remove all randomized versions? This action cannot be undone."
        confirmText={loading ? 'Clearing...' : 'Clear'}
        variant="destructive"
        isLoading={loading}
      />
    </Box>
  )
}
