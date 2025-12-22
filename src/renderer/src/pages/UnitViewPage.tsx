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
import AddIcon from '@mui/icons-material/Add'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import AssignmentIcon from '@mui/icons-material/Assignment'
import IconButton from '@mui/material/IconButton'
import FolderIcon from '@mui/icons-material/Folder'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import ArticleIcon from '@mui/icons-material/Article'
import DescriptionIcon from '@mui/icons-material/Description'
import { useUnitStore, useStandardsStore, useAssessmentStore } from '../stores'
import { useLessonStore } from '../stores/lesson.store'
import { ConfirmModal } from '../components/ui'
import { UnitEditModal } from '../components/units'
import { AssessmentCard, AssessmentCreationModal } from '../components/assessments'
import { LessonCard, LessonCreationModal, MaterialUploadModal } from '../components/lessons'
import type { CourseSummary, UnitSummary, AssessmentSummary, LessonSummary, Standard, StandardDomain, Standards } from '../../../shared/types'

interface UnitViewPageProps {
  course: CourseSummary
  unitSummary: UnitSummary
  onBack: () => void
  onDeleted: () => void
  onAssessmentSelect?: (assessment: AssessmentSummary) => void
  onLessonSelect?: (lesson: LessonSummary) => void
}

export function UnitViewPage({ course, unitSummary, onBack, onDeleted, onAssessmentSelect, onLessonSelect }: UnitViewPageProps): ReactElement {
  const { currentUnit, loading, error, getUnit, deleteUnit, clearError } = useUnitStore()
  const { allCollections, fetchAllCollections } = useStandardsStore()
  const { assessments, fetchAssessments, loading: assessmentsLoading } = useAssessmentStore()
  const {
    lessons,
    fetchLessons,
    loading: lessonsLoading,
    materials,
    fetchMaterials,
    deleteMaterial,
    materialsLoading
  } = useLessonStore()

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreateAssessmentModalOpen, setIsCreateAssessmentModalOpen] = useState(false)
  const [isCreateLessonModalOpen, setIsCreateLessonModalOpen] = useState(false)
  const [isUploadMaterialModalOpen, setIsUploadMaterialModalOpen] = useState(false)
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null)

  // Fetch full unit details, standards, assessments, lessons, and materials when component mounts
  useEffect(() => {
    getUnit(course.id, unitSummary.id)
    fetchAllCollections(course.id)
    fetchAssessments(unitSummary.id)
    fetchLessons(unitSummary.id)
    fetchMaterials(unitSummary.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [course.id, unitSummary.id])

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true)
    const success = await deleteUnit(course.id, unitSummary.id)
    setIsDeleting(false)

    if (success) {
      setIsDeleteModalOpen(false)
      onDeleted()
    }
  }

  const handleDeleteMaterial = async (materialId: string): Promise<void> => {
    setDeletingMaterialId(materialId)
    await deleteMaterial(materialId, unitSummary.id)
    setDeletingMaterialId(null)
  }

  const getMaterialIcon = (type: string): ReactElement => {
    switch (type) {
      case 'pdf':
        return <PictureAsPdfIcon sx={{ color: 'error.main' }} />
      case 'docx':
        return <ArticleIcon sx={{ color: 'info.main' }} />
      case 'txt':
        return <DescriptionIcon sx={{ color: 'text.secondary' }} />
      default:
        return <DescriptionIcon sx={{ color: 'text.disabled' }} />
    }
  }

  // Get aligned standards with full details
  const getAlignedStandards = (): Array<{ standard: Standard; domain: StandardDomain; collection: Standards }> => {
    if (!currentUnit || allCollections.length === 0) return []

    const aligned: Array<{ standard: Standard; domain: StandardDomain; collection: Standards }> = []

    for (const collection of allCollections) {
      for (const domain of collection.domains) {
        for (const standard of domain.standards) {
          if (currentUnit.standardRefs.includes(standard.code)) {
            aligned.push({ standard, domain, collection })
          }
        }
      }
    }

    return aligned
  }

  const alignedStandards = getAlignedStandards()

  // Loading state
  if (loading && !currentUnit) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
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

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Chip
                label={`Unit ${unitSummary.order}`}
                color="primary"
                size="small"
              />
              <Typography variant="h5" fontWeight={700}>
                {currentUnit?.name ?? unitSummary.name}
              </Typography>
            </Box>
            {currentUnit?.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 600 }}>
                {currentUnit.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
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

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">Estimated Days</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {currentUnit?.estimatedDays ?? '—'}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <MenuBookIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">Standards</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {currentUnit?.standardRefs.length ?? unitSummary.standardCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <MenuBookIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">Lessons</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {lessons.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <AssignmentIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">Assessments</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {unitSummary.assessmentCount}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Standards Section */}
      <Box component="section">
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Aligned Standards
        </Typography>

        {alignedStandards.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <MenuBookIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              No standards aligned to this unit yet.
            </Typography>
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => setIsEditModalOpen(true)}
            >
              Add Standards
            </Button>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            {alignedStandards.map(({ standard, domain }, index) => (
              <Box
                key={standard.code}
                sx={{
                  p: 2,
                  borderBottom: index < alignedStandards.length - 1 ? 1 : 0,
                  borderColor: 'divider'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                    <Chip label={standard.code} size="small" color="primary" />
                    <Chip
                      label={domain.code}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2">
                      {standard.description}
                    </Typography>
                    {standard.keywords && standard.keywords.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                        {standard.keywords.slice(0, 5).map((keyword) => (
                          <Chip
                            key={keyword}
                            label={keyword}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Paper>
        )}
      </Box>

      <Divider />

      {/* Materials Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Teaching Materials
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => setIsUploadMaterialModalOpen(true)}
          >
            Upload Material
          </Button>
        </Box>

        {materialsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : materials.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <FolderIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography fontWeight={500} gutterBottom>
              No materials uploaded
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload slides, notes, or worksheets to provide context for AI-generated content.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={() => setIsUploadMaterialModalOpen(true)}
            >
              Upload Material
            </Button>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            {materials.map((material, index) => (
              <Box
                key={material.id}
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  borderBottom: index < materials.length - 1 ? 1 : 0,
                  borderColor: 'divider'
                }}
              >
                {getMaterialIcon(material.type)}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={500} noWrap>
                    {material.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {material.type.toUpperCase()} • Uploaded{' '}
                    {new Date(material.uploadedAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteMaterial(material.id)}
                  disabled={deletingMaterialId === material.id}
                >
                  {deletingMaterialId === material.id ? (
                    <CircularProgress size={20} />
                  ) : (
                    <DeleteIcon />
                  )}
                </IconButton>
              </Box>
            ))}
          </Paper>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Materials are used as context for AI-generated questions and lessons.
        </Typography>
      </Box>

      <Divider />

      {/* Lessons Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Lessons
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateLessonModalOpen(true)}
          >
            Create Lesson
          </Button>
        </Box>

        {lessonsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : lessons.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <MenuBookIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography fontWeight={500} gutterBottom>
              No lessons yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first lesson to start planning instruction.
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateLessonModalOpen(true)}
            >
              Create Lesson
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                onClick={() => onLessonSelect?.(lesson)}
              />
            ))}
          </Box>
        )}
      </Box>

      <Divider />

      {/* Assessments Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Assessments
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateAssessmentModalOpen(true)}
          >
            Create Assessment
          </Button>
        </Box>

        {assessmentsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : assessments.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <AssignmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography fontWeight={500} gutterBottom>
              No assessments yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first assessment to get started.
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateAssessmentModalOpen(true)}
            >
              Create Assessment
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {assessments.map((assessment) => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                onClick={() => onAssessmentSelect?.(assessment)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Edit Modal */}
      {currentUnit && (
        <UnitEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          courseId={course.id}
          courseName={course.name}
          unit={currentUnit}
          onSuccess={() => {
            setIsEditModalOpen(false)
            // Refresh unit data
            getUnit(course.id, unitSummary.id)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Unit"
        message={`Are you sure you want to delete "${unitSummary.name}"? This will also remove all assessments in this unit. This action cannot be undone.`}
        confirmText="Delete Unit"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Assessment Creation Modal */}
      <AssessmentCreationModal
        isOpen={isCreateAssessmentModalOpen}
        onClose={() => setIsCreateAssessmentModalOpen(false)}
        courseId={course.id}
        unitId={unitSummary.id}
        unitName={unitSummary.name}
        onSuccess={(assessment) => {
          setIsCreateAssessmentModalOpen(false)
          // Refresh assessments list
          fetchAssessments(unitSummary.id)
          // Navigate to the new assessment - convert Assessment to AssessmentSummary
          const summary: AssessmentSummary = {
            id: assessment.id,
            unitId: assessment.unitId,
            type: assessment.type,
            title: assessment.title,
            purpose: assessment.purpose,
            questionCount: assessment.questions.length,
            totalPoints: assessment.questions.reduce((sum, q) => sum + q.points, 0),
            status: assessment.status,
            createdAt: assessment.createdAt,
            updatedAt: assessment.updatedAt
          }
          onAssessmentSelect?.(summary)
        }}
      />

      {/* Lesson Creation Modal */}
      <LessonCreationModal
        isOpen={isCreateLessonModalOpen}
        onClose={() => setIsCreateLessonModalOpen(false)}
        courseId={course.id}
        unitId={unitSummary.id}
        unitName={unitSummary.name}
        onSuccess={(lesson) => {
          setIsCreateLessonModalOpen(false)
          // Refresh lessons list
          fetchLessons(unitSummary.id)
          // Navigate to the new lesson
          const summary: LessonSummary = {
            id: lesson.id,
            unitId: lesson.unitId,
            title: lesson.title,
            estimatedMinutes: lesson.estimatedMinutes,
            componentCount: lesson.components.length,
            goalCount: lesson.learningGoals.length,
            status: lesson.status,
            aiGenerated: lesson.aiGenerated,
            createdAt: lesson.createdAt,
            updatedAt: lesson.updatedAt
          }
          onLessonSelect?.(summary)
        }}
      />

      {/* Material Upload Modal */}
      <MaterialUploadModal
        isOpen={isUploadMaterialModalOpen}
        onClose={() => setIsUploadMaterialModalOpen(false)}
        courseId={course.id}
        unitId={unitSummary.id}
        unitName={unitSummary.name}
        onSuccess={() => {
          // Refresh materials list is handled in the modal via store
          setIsUploadMaterialModalOpen(false)
        }}
      />
    </Box>
  )
}
