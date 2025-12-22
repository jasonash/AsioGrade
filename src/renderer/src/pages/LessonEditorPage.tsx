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
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import FlagIcon from '@mui/icons-material/Flag'
import ViewListIcon from '@mui/icons-material/ViewList'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import AddIcon from '@mui/icons-material/Add'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'
import { useLessonStore } from '../stores/lesson.store'
import { useStandardsStore } from '../stores'
import { ConfirmModal } from '../components/ui'
import { LessonAIPanel } from '../components/lessons'
import type {
  CourseSummary,
  UnitSummary,
  LessonSummary,
  LessonStatus,
  LessonComponent,
  LearningGoal,
  LessonComponentType,
  Standard,
  UDLNotes
} from '../../../shared/types'
import {
  COMPONENT_TYPE_LABELS,
  COMPONENT_TYPE_ICONS,
  COMPONENT_DEFAULT_MINUTES
} from '../../../shared/types/lesson.types'

interface LessonEditorPageProps {
  course: CourseSummary
  unit: UnitSummary
  lessonSummary: LessonSummary
  onBack: () => void
  onDeleted: () => void
}

const statusLabels: Record<LessonStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  taught: 'Taught'
}

const statusColors: Record<LessonStatus, 'default' | 'primary' | 'success'> = {
  draft: 'default',
  ready: 'primary',
  taught: 'success'
}

// Generate a unique ID for new items
const generateId = (): string => crypto.randomUUID()

export function LessonEditorPage({
  course,
  unit,
  lessonSummary,
  onBack,
  onDeleted
}: LessonEditorPageProps): ReactElement {
  const {
    currentLesson,
    loading,
    error,
    getLesson,
    updateLesson,
    deleteLesson,
    clearError
  } = useLessonStore()
  const { allCollections, fetchAllCollections } = useStandardsStore()

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // Editing state
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState('')

  // Goal editing
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [goalTextValue, setGoalTextValue] = useState('')
  const [newGoalText, setNewGoalText] = useState('')

  // UDL editing
  const [newEngagementText, setNewEngagementText] = useState('')
  const [newRepresentationText, setNewRepresentationText] = useState('')
  const [newExpressionText, setNewExpressionText] = useState('')

  // Fetch full lesson details when component mounts
  useEffect(() => {
    getLesson(lessonSummary.id)
    fetchAllCollections(course.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [lessonSummary.id, course.id])

  // Initialize editing values when lesson loads
  useEffect(() => {
    if (currentLesson) {
      setTitleValue(currentLesson.title)
      setDescriptionValue(currentLesson.description ?? '')
    }
  }, [currentLesson])

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true)
    const success = await deleteLesson(lessonSummary.id, unit.id)
    setIsDeleting(false)

    if (success) {
      setIsDeleteModalOpen(false)
      onDeleted()
    }
  }

  const handleMarkReady = async (): Promise<void> => {
    if (!currentLesson) return

    setIsPublishing(true)
    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      status: 'ready'
    })
    setIsPublishing(false)
  }

  const handleTitleSave = async (): Promise<void> => {
    if (!currentLesson || !titleValue.trim()) return

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      title: titleValue.trim()
    })
    setEditingTitle(false)
  }

  const handleDescriptionSave = async (): Promise<void> => {
    if (!currentLesson) return

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      description: descriptionValue.trim() || undefined
    })
    setEditingDescription(false)
  }

  // Learning goal handlers
  const handleAddGoal = async (): Promise<void> => {
    if (!currentLesson || !newGoalText.trim()) return

    const newGoal: LearningGoal = {
      id: generateId(),
      text: newGoalText.trim()
    }

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      learningGoals: [...currentLesson.learningGoals, newGoal]
    })
    setNewGoalText('')
  }

  const handleUpdateGoal = async (goalId: string): Promise<void> => {
    if (!currentLesson || !goalTextValue.trim()) return

    const updatedGoals = currentLesson.learningGoals.map((g) =>
      g.id === goalId ? { ...g, text: goalTextValue.trim() } : g
    )

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      learningGoals: updatedGoals
    })
    setEditingGoalId(null)
    setGoalTextValue('')
  }

  const handleDeleteGoal = async (goalId: string): Promise<void> => {
    if (!currentLesson) return

    const updatedGoals = currentLesson.learningGoals.filter((g) => g.id !== goalId)

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      learningGoals: updatedGoals
    })
  }

  // Component handlers
  const handleAddComponent = async (type: LessonComponentType): Promise<void> => {
    if (!currentLesson) return

    const newComponent: LessonComponent = {
      id: generateId(),
      type,
      title: COMPONENT_TYPE_LABELS[type],
      description: '',
      estimatedMinutes: COMPONENT_DEFAULT_MINUTES[type],
      order: currentLesson.components.length
    }

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      components: [...currentLesson.components, newComponent]
    })
  }

  const handleDeleteComponent = async (componentId: string): Promise<void> => {
    if (!currentLesson) return

    const updatedComponents = currentLesson.components
      .filter((c) => c.id !== componentId)
      .map((c, index) => ({ ...c, order: index }))

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      components: updatedComponents
    })
  }

  // AI-generated content handlers
  const handleAIGoalsGenerated = async (
    goals: LearningGoal[],
    successCriteria: string[]
  ): Promise<void> => {
    if (!currentLesson) return

    // Merge with existing goals
    const existingIds = new Set(currentLesson.learningGoals.map((g) => g.id))
    const newGoals = goals.filter((g) => !existingIds.has(g.id))

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      learningGoals: [...currentLesson.learningGoals, ...newGoals],
      successCriteria: [...(currentLesson.successCriteria ?? []), ...successCriteria]
    })
  }

  const handleAIStructureGenerated = async (components: LessonComponent[]): Promise<void> => {
    if (!currentLesson) return

    // Replace existing components with generated ones
    // Ensure ordering is correct
    const orderedComponents = components.map((c, index) => ({ ...c, order: index }))

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      components: orderedComponents
    })
  }

  const handleAIComponentExpanded = async (expandedComponent: LessonComponent): Promise<void> => {
    if (!currentLesson) return

    // Update the specific component with expanded content
    const updatedComponents = currentLesson.components.map((c) =>
      c.id === expandedComponent.id ? expandedComponent : c
    )

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      components: updatedComponents
    })
  }

  // UDL Notes handlers
  type UDLCategory = 'engagement' | 'representation' | 'expression'

  const handleAddUDLNote = async (category: UDLCategory, text: string): Promise<void> => {
    if (!currentLesson || !text.trim()) return

    const currentNotes: UDLNotes = currentLesson.udlNotes ?? {
      engagement: [],
      representation: [],
      expression: []
    }

    const updatedNotes: UDLNotes = {
      ...currentNotes,
      [category]: [...currentNotes[category], text.trim()]
    }

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      udlNotes: updatedNotes
    })

    // Clear the input
    if (category === 'engagement') setNewEngagementText('')
    else if (category === 'representation') setNewRepresentationText('')
    else setNewExpressionText('')
  }

  const handleRemoveUDLNote = async (category: UDLCategory, index: number): Promise<void> => {
    if (!currentLesson) return

    const currentNotes: UDLNotes = currentLesson.udlNotes ?? {
      engagement: [],
      representation: [],
      expression: []
    }

    const updatedCategory = [...currentNotes[category]]
    updatedCategory.splice(index, 1)

    const updatedNotes: UDLNotes = {
      ...currentNotes,
      [category]: updatedCategory
    }

    await updateLesson({
      id: currentLesson.id,
      courseId: currentLesson.courseId,
      unitId: currentLesson.unitId,
      udlNotes: updatedNotes
    })
  }

  // Get all standards from all collections
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

  // Calculate stats
  const totalMinutes = currentLesson?.components.reduce((sum, c) => sum + c.estimatedMinutes, 0) ?? 0
  const goalCount = currentLesson?.learningGoals.length ?? 0
  const componentCount = currentLesson?.components.length ?? 0

  // Loading state
  if (loading && !currentLesson) {
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
                label={statusLabels[currentLesson?.status ?? 'draft']}
                color={statusColors[currentLesson?.status ?? 'draft']}
                variant={currentLesson?.status === 'draft' ? 'outlined' : 'filled'}
                size="small"
              />
              {currentLesson?.aiGenerated && (
                <SmartToyIcon
                  sx={{ fontSize: 18, color: 'primary.main' }}
                  titleAccess="AI Generated"
                />
              )}

              {editingTitle ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    size="small"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave()
                      if (e.key === 'Escape') {
                        setEditingTitle(false)
                        setTitleValue(currentLesson?.title ?? '')
                      }
                    }}
                    sx={{ minWidth: 300 }}
                  />
                  <Button size="small" onClick={handleTitleSave}>
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingTitle(false)
                      setTitleValue(currentLesson?.title ?? '')
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : (
                <Typography
                  variant="h4"
                  fontWeight={700}
                  onClick={() => currentLesson?.status === 'draft' && setEditingTitle(true)}
                  sx={{
                    cursor: currentLesson?.status === 'draft' ? 'pointer' : 'default',
                    '&:hover':
                      currentLesson?.status === 'draft'
                        ? { textDecoration: 'underline' }
                        : {}
                  }}
                >
                  {currentLesson?.title ?? lessonSummary.title}
                </Typography>
              )}
            </Box>

            {editingDescription ? (
              <Box sx={{ mt: 1, maxWidth: 600 }}>
                <TextField
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  autoFocus
                  placeholder="Add a description..."
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setEditingDescription(false)
                      setDescriptionValue(currentLesson?.description ?? '')
                    }
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button size="small" onClick={handleDescriptionSave}>
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingDescription(false)
                      setDescriptionValue(currentLesson?.description ?? '')
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : (
              <Typography
                variant="body1"
                color="text.secondary"
                onClick={() => currentLesson?.status === 'draft' && setEditingDescription(true)}
                sx={{
                  mt: 1,
                  maxWidth: 600,
                  cursor: currentLesson?.status === 'draft' ? 'pointer' : 'default',
                  fontStyle: !currentLesson?.description ? 'italic' : 'normal',
                  '&:hover':
                    currentLesson?.status === 'draft' ? { textDecoration: 'underline' } : {}
                }}
              >
                {currentLesson?.description || 'Click to add description...'}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {currentLesson?.status === 'draft' && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={handleMarkReady}
                disabled={isPublishing || componentCount === 0}
              >
                {isPublishing ? 'Saving...' : 'Mark Ready'}
              </Button>
            )}
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
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Duration
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {totalMinutes} min
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Target: {currentLesson?.estimatedMinutes ?? 0} min
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FlagIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Learning Goals
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {goalCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ViewListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Components
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {componentCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Estimated
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700}>
              {currentLesson?.estimatedMinutes ?? 0} min
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Divider />

      {/* Main content area */}
      <Grid container spacing={3}>
        {/* Left column - Learning Goals and Components */}
        <Grid size={{ xs: 12, md: currentLesson?.status === 'draft' ? 8 : 12 }}>
          {/* Learning Goals Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Learning Goals
            </Typography>

            {currentLesson?.learningGoals.map((goal) => (
              <Paper
                key={goal.id}
                variant="outlined"
                sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'flex-start', gap: 2 }}
              >
                <FlagIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.3 }} />

                {editingGoalId === goal.id ? (
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      value={goalTextValue}
                      onChange={(e) => setGoalTextValue(e.target.value)}
                      size="small"
                      fullWidth
                      multiline
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleUpdateGoal(goal.id)
                        }
                        if (e.key === 'Escape') {
                          setEditingGoalId(null)
                          setGoalTextValue('')
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button size="small" onClick={() => handleUpdateGoal(goal.id)}>
                        Save
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingGoalId(null)
                          setGoalTextValue('')
                        }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1">{goal.text}</Typography>
                      {goal.standardRef && (
                        <Chip
                          label={goal.standardRef}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>

                    {currentLesson?.status === 'draft' && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingGoalId(goal.id)
                            setGoalTextValue(goal.text)
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </>
                )}
              </Paper>
            ))}

            {currentLesson?.status === 'draft' && (
              <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2 }}>
                <TextField
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="Students will be able to..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddGoal()
                    }
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddGoal}
                  disabled={!newGoalText.trim()}
                >
                  Add
                </Button>
              </Paper>
            )}

            {currentLesson?.learningGoals.length === 0 &&
              currentLesson?.status !== 'draft' && (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No learning goals defined for this lesson.
                  </Typography>
                </Paper>
              )}
          </Box>

          {/* Components Section */}
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Lesson Flow
            </Typography>

            {/* Timeline of components */}
            <Box sx={{ position: 'relative', pl: 4 }}>
              {/* Timeline line */}
              {(currentLesson?.components.length ?? 0) > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 12,
                    top: 20,
                    bottom: 20,
                    width: 2,
                    bgcolor: 'divider'
                  }}
                />
              )}

              {currentLesson?.components.map((component) => (
                <Box
                  key={component.id}
                  sx={{ position: 'relative', mb: 2 }}
                >
                  {/* Timeline dot */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -28,
                      top: 20,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      border: 2,
                      borderColor: 'background.paper'
                    }}
                  />

                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      {currentLesson?.status === 'draft' && (
                        <DragIndicatorIcon
                          sx={{ color: 'text.disabled', cursor: 'grab', mt: 0.5 }}
                        />
                      )}

                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '1.2rem' }}>
                            {COMPONENT_TYPE_ICONS[component.type]}
                          </Typography>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {component.title}
                          </Typography>
                          <Chip
                            label={COMPONENT_TYPE_LABELS[component.type]}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                          <Chip
                            icon={<AccessTimeIcon sx={{ fontSize: '14px !important' }} />}
                            label={`${component.estimatedMinutes} min`}
                            size="small"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </Box>

                        {component.description && (
                          <Typography variant="body2" color="text.secondary">
                            {component.description}
                          </Typography>
                        )}

                        {component.teacherNotes && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Teacher Notes:
                            </Typography>
                            <Typography variant="body2">{component.teacherNotes}</Typography>
                          </Box>
                        )}
                      </Box>

                      {currentLesson?.status === 'draft' && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteComponent(component.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Box>
              ))}

              {/* Add component buttons */}
              {currentLesson?.status === 'draft' && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Add Component:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {(Object.keys(COMPONENT_TYPE_LABELS) as LessonComponentType[]).map(
                      (type) => (
                        <Button
                          key={type}
                          size="small"
                          variant="outlined"
                          onClick={() => handleAddComponent(type)}
                          startIcon={
                            <span style={{ fontSize: '1rem' }}>
                              {COMPONENT_TYPE_ICONS[type]}
                            </span>
                          }
                        >
                          {COMPONENT_TYPE_LABELS[type]}
                        </Button>
                      )
                    )}
                  </Box>
                </Paper>
              )}
            </Box>

            {currentLesson?.components.length === 0 &&
              currentLesson?.status !== 'draft' && (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No components defined for this lesson.
                  </Typography>
                </Paper>
              )}

          {/* UDL Section */}
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AccessibilityNewIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600}>
                Universal Design for Learning (UDL)
              </Typography>
            </Box>

            {/* Engagement */}
            <Accordion defaultExpanded sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={500}>Engagement</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (Multiple means of engagement)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  How will you recruit interest, sustain effort, and support self-regulation?
                </Typography>
                {(currentLesson?.udlNotes?.engagement ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                    No engagement strategies added yet.
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ mb: 2 }}>
                    {(currentLesson?.udlNotes?.engagement ?? []).map((note, index) => (
                      <ListItem
                        key={index}
                        sx={{
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                          mb: 0.5
                        }}
                      >
                        <ListItemText primary={note} />
                        {currentLesson?.status === 'draft' && (
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleRemoveUDLNote('engagement', index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
                {currentLesson?.status === 'draft' && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Add engagement strategy..."
                      value={newEngagementText}
                      onChange={(e) => setNewEngagementText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddUDLNote('engagement', newEngagementText)
                        }
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddUDLNote('engagement', newEngagementText)}
                      disabled={!newEngagementText.trim()}
                    >
                      Add
                    </Button>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Representation */}
            <Accordion sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={500}>Representation</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (Multiple means of representation)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  How will you present information in different ways?
                </Typography>
                {(currentLesson?.udlNotes?.representation ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                    No representation strategies added yet.
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ mb: 2 }}>
                    {(currentLesson?.udlNotes?.representation ?? []).map((note, index) => (
                      <ListItem
                        key={index}
                        sx={{
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                          mb: 0.5
                        }}
                      >
                        <ListItemText primary={note} />
                        {currentLesson?.status === 'draft' && (
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleRemoveUDLNote('representation', index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
                {currentLesson?.status === 'draft' && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Add representation strategy..."
                      value={newRepresentationText}
                      onChange={(e) => setNewRepresentationText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddUDLNote('representation', newRepresentationText)
                        }
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddUDLNote('representation', newRepresentationText)}
                      disabled={!newRepresentationText.trim()}
                    >
                      Add
                    </Button>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Expression */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={500}>Action & Expression</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (Multiple means of action/expression)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  How will you allow students to demonstrate their learning?
                </Typography>
                {(currentLesson?.udlNotes?.expression ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                    No expression strategies added yet.
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ mb: 2 }}>
                    {(currentLesson?.udlNotes?.expression ?? []).map((note, index) => (
                      <ListItem
                        key={index}
                        sx={{
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                          mb: 0.5
                        }}
                      >
                        <ListItemText primary={note} />
                        {currentLesson?.status === 'draft' && (
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleRemoveUDLNote('expression', index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
                {currentLesson?.status === 'draft' && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Add expression strategy..."
                      value={newExpressionText}
                      onChange={(e) => setNewExpressionText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddUDLNote('expression', newExpressionText)
                        }
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddUDLNote('expression', newExpressionText)}
                      disabled={!newExpressionText.trim()}
                    >
                      Add
                    </Button>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </Box>
          </Box>
        </Grid>

        {/* Right column - AI Assistant (for draft lessons) */}
        {currentLesson?.status === 'draft' && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ position: 'sticky', top: 16 }}>
              <LessonAIPanel
                course={course}
                unit={unit}
                lesson={currentLesson}
                unitStandards={allStandards.filter((s) =>
                  currentLesson.standardRefs?.includes(s.code) ?? false
                )}
                onGoalsGenerated={handleAIGoalsGenerated}
                onStructureGenerated={handleAIStructureGenerated}
                onComponentExpanded={handleAIComponentExpanded}
              />
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Lesson"
        message={`Are you sure you want to delete "${lessonSummary.title}"? This action cannot be undone.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="danger"
        isLoading={isDeleting}
      />
    </Box>
  )
}
