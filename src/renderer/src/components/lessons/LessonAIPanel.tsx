/**
 * LessonAIPanel Component
 *
 * AI assistant panel for lesson planning. Provides:
 * - Generate a complete lesson (goals + structure + expansions) in one click
 * - Generate learning goals from standards
 * - Generate lesson structure from goals
 * - Expand individual components with details
 */

import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Checkbox from '@mui/material/Checkbox'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import FlagIcon from '@mui/icons-material/Flag'
import ViewListIcon from '@mui/icons-material/ViewList'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import type { ServiceResult } from '../../../../shared/types/common.types'
import type {
  LessonGenerationContext,
  LessonGoalsResult,
  LessonStructureResult,
  ComponentExpansionResult,
  FullLessonResult,
  LessonProgressEvent
} from '../../../../shared/types/ai.types'
import type {
  LearningGoal,
  LessonComponent,
  Standard,
  CourseSummary,
  UnitSummary,
  Lesson
} from '../../../../shared/types'

interface LessonAIPanelProps {
  course: CourseSummary
  unit: UnitSummary
  lesson: Lesson
  unitStandards: Standard[]
  onGoalsGenerated: (goals: LearningGoal[], successCriteria: string[]) => void
  onStructureGenerated: (components: LessonComponent[]) => void
  onComponentExpanded: (component: LessonComponent) => void
  onFullLessonGenerated?: (
    goals: LearningGoal[],
    successCriteria: string[],
    components: LessonComponent[]
  ) => void
}

type GenerationStep = 'idle' | 'goals' | 'structure' | 'expand' | 'full-lesson'

export function LessonAIPanel({
  course,
  unit,
  lesson,
  unitStandards,
  onGoalsGenerated,
  onStructureGenerated,
  onComponentExpanded,
  onFullLessonGenerated
}: LessonAIPanelProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [tokensUsed, setTokensUsed] = useState(0)

  // Pending generated content awaiting approval
  const [pendingGoals, setPendingGoals] = useState<LearningGoal[] | null>(null)
  const [pendingCriteria, setPendingCriteria] = useState<string[]>([])
  const [pendingStructure, setPendingStructure] = useState<LessonComponent[] | null>(null)
  const [expandingComponentId, setExpandingComponentId] = useState<string | null>(null)

  // Full lesson generation state
  const [pendingFullLesson, setPendingFullLesson] = useState<FullLessonResult | null>(null)
  const [fullLessonProgress, setFullLessonProgress] = useState<LessonProgressEvent | null>(null)

  // Selected standards for generation
  const [selectedStandards, setSelectedStandards] = useState<string[]>(
    lesson.standardRefs ?? unitStandards.map((s) => s.code)
  )

  // Subscribe to lesson progress events
  useEffect(() => {
    const unsubscribe = window.electronAPI.on('ai:lessonProgress', (event: unknown) => {
      const progressEvent = event as LessonProgressEvent
      setFullLessonProgress(progressEvent)
    })
    return unsubscribe
  }, [])

  // Build context for AI generation
  const buildContext = (): LessonGenerationContext => ({
    courseId: course.id,
    unitId: unit.id,
    standardRefs: selectedStandards,
    durationMinutes: lesson.estimatedMinutes,
    gradeLevel: course.gradeLevel,
    subject: course.subject
  })

  // Get standards text for selected standards
  const getStandardsText = (): string => {
    return unitStandards
      .filter((s) => selectedStandards.includes(s.code))
      .map((s) => `${s.code}: ${s.description}`)
      .join('\n')
  }

  // Generate a complete lesson (goals + structure + expansions)
  const handleGenerateFullLesson = async (): Promise<void> => {
    setIsGenerating(true)
    setGenerationStep('full-lesson')
    setError(null)
    setFullLessonProgress(null)

    try {
      const context = buildContext()

      const result = await window.electronAPI.invoke<ServiceResult<FullLessonResult>>(
        'ai:generateFullLesson',
        context
      )

      if (!result.success) {
        setError(result.error ?? 'Failed to generate lesson')
      } else if (result.data) {
        setPendingFullLesson(result.data)
        setTokensUsed((prev) => prev + (result.data.usage?.totalTokens ?? 0))
      } else {
        setError('Failed to generate lesson: No data returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
      setGenerationStep('idle')
      setFullLessonProgress(null)
    }
  }

  // Accept the generated full lesson
  const handleAcceptFullLesson = (): void => {
    if (pendingFullLesson && onFullLessonGenerated) {
      onFullLessonGenerated(
        pendingFullLesson.goals,
        pendingFullLesson.successCriteria,
        pendingFullLesson.components
      )
      setPendingFullLesson(null)
    }
  }

  // Reject the generated full lesson
  const handleRejectFullLesson = (): void => {
    setPendingFullLesson(null)
  }

  // Get progress message for full lesson generation
  const getProgressMessage = (): string => {
    if (!fullLessonProgress) return 'Starting...'

    const { step, status, componentIndex, totalComponents } = fullLessonProgress

    if (step === 'goals') {
      return status === 'complete' ? 'Goals generated' : 'Generating learning goals...'
    }
    if (step === 'structure') {
      return status === 'complete' ? 'Structure created' : 'Creating lesson structure...'
    }
    if (step === 'expansion') {
      if (status === 'complete') return 'All components expanded'
      if (componentIndex !== undefined && totalComponents) {
        return `Expanding components (${componentIndex}/${totalComponents})...`
      }
      return 'Expanding components...'
    }
    return 'Generating...'
  }

  // Generate learning goals
  const handleGenerateGoals = async (): Promise<void> => {
    setIsGenerating(true)
    setGenerationStep('goals')
    setError(null)

    try {
      const context = buildContext()
      const standardsText = getStandardsText()

      const result = await window.electronAPI.invoke<ServiceResult<LessonGoalsResult>>(
        'ai:generateLessonGoals',
        context,
        standardsText
      )

      if (result.success) {
        setPendingGoals(result.data.goals)
        setPendingCriteria(result.data.successCriteria)
        setTokensUsed((prev) => prev + (result.data.usage?.totalTokens ?? 0))
      } else {
        setError(result.error ?? 'Failed to generate learning goals')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
      setGenerationStep('idle')
    }
  }

  // Accept generated goals
  const handleAcceptGoals = (): void => {
    if (pendingGoals) {
      onGoalsGenerated(pendingGoals, pendingCriteria)
      setPendingGoals(null)
      setPendingCriteria([])
    }
  }

  // Reject generated goals
  const handleRejectGoals = (): void => {
    setPendingGoals(null)
    setPendingCriteria([])
  }

  // Generate lesson structure
  const handleGenerateStructure = async (): Promise<void> => {
    if (lesson.learningGoals.length === 0) {
      setError('Please add learning goals before generating lesson structure')
      return
    }

    setIsGenerating(true)
    setGenerationStep('structure')
    setError(null)

    try {
      const context = buildContext()
      const standardsText = getStandardsText()

      const result = await window.electronAPI.invoke<ServiceResult<LessonStructureResult>>(
        'ai:generateLessonStructure',
        context,
        lesson.learningGoals,
        standardsText
      )

      if (result.success) {
        setPendingStructure(result.data.components)
        setTokensUsed((prev) => prev + (result.data.usage?.totalTokens ?? 0))
      } else {
        setError(result.error ?? 'Failed to generate lesson structure')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
      setGenerationStep('idle')
    }
  }

  // Accept generated structure
  const handleAcceptStructure = (): void => {
    if (pendingStructure) {
      onStructureGenerated(pendingStructure)
      setPendingStructure(null)
    }
  }

  // Reject generated structure
  const handleRejectStructure = (): void => {
    setPendingStructure(null)
  }

  // Expand a specific component
  const handleExpandComponent = async (component: LessonComponent): Promise<void> => {
    setIsGenerating(true)
    setGenerationStep('expand')
    setExpandingComponentId(component.id)
    setError(null)

    try {
      const context = buildContext()
      const standardsText = getStandardsText()

      const result = await window.electronAPI.invoke<ServiceResult<ComponentExpansionResult>>(
        'ai:expandLessonComponent',
        { component, context, goals: lesson.learningGoals },
        standardsText
      )

      if (result.success) {
        onComponentExpanded(result.data.expandedComponent)
        setTokensUsed((prev) => prev + (result.data.usage?.totalTokens ?? 0))
      } else {
        setError(result.error ?? 'Failed to expand component')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Expansion failed')
    } finally {
      setIsGenerating(false)
      setGenerationStep('idle')
      setExpandingComponentId(null)
    }
  }

  // Toggle standard selection
  const toggleStandard = (code: string): void => {
    setSelectedStandards((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const clearError = (): void => setError(null)

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            AI Assistant
          </Typography>
          {tokensUsed > 0 && (
            <Chip label={`${tokensUsed.toLocaleString()} tokens`} size="small" variant="outlined" />
          )}
        </Box>
        <IconButton size="small">
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        {/* Standards Selection */}
        {unitStandards.length > 0 && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Standards to Use ({selectedStandards.length} selected)
            </Typography>
            <List dense disablePadding sx={{ maxHeight: 150, overflow: 'auto' }}>
              {unitStandards.map((standard, index) => (
                <ListItem
                  key={`${standard.code}-${index}`}
                  dense
                  disablePadding
                  onClick={() => toggleStandard(standard.code)}
                  sx={{ cursor: 'pointer' }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      checked={selectedStandards.includes(standard.code)}
                      size="small"
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={standard.code}
                    secondary={standard.description}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      sx: {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Quick Actions */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Quick Actions
          </Typography>

          {/* Generate Full Lesson - Primary action */}
          <Button
            fullWidth
            variant="contained"
            color="primary"
            startIcon={
              isGenerating && generationStep === 'full-lesson' ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AutoAwesomeIcon />
              )
            }
            onClick={handleGenerateFullLesson}
            disabled={isGenerating || selectedStandards.length === 0}
            sx={{ mb: 1.5 }}
          >
            {isGenerating && generationStep === 'full-lesson'
              ? 'Generating...'
              : 'Generate Full Lesson'}
          </Button>

          {/* Progress indicator for full lesson generation */}
          {isGenerating && generationStep === 'full-lesson' && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {getProgressMessage()}
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Step-by-step buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                isGenerating && generationStep === 'goals' ? (
                  <CircularProgress size={16} />
                ) : (
                  <FlagIcon />
                )
              }
              onClick={handleGenerateGoals}
              disabled={isGenerating || selectedStandards.length === 0}
            >
              Generate Goals
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                isGenerating && generationStep === 'structure' ? (
                  <CircularProgress size={16} />
                ) : (
                  <ViewListIcon />
                )
              }
              onClick={handleGenerateStructure}
              disabled={isGenerating || lesson.learningGoals.length === 0}
            >
              Generate Structure
            </Button>
          </Box>
        </Box>

        {/* Error display */}
        {error && (
          <Alert severity="error" onClose={clearError} sx={{ m: 1 }}>
            {error}
          </Alert>
        )}

        {/* Pending Full Lesson */}
        {pendingFullLesson && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'success.main', color: 'success.contrastText' }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="subtitle2">
                Generated Complete Lesson
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={handleAcceptFullLesson}
                  sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleRejectFullLesson}
                  sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 1.5, color: 'text.primary' }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                {pendingFullLesson.goals.length} Learning Goals
              </Typography>
              {pendingFullLesson.goals.slice(0, 2).map((goal) => (
                <Typography key={goal.id} variant="caption" display="block" sx={{ mb: 0.5, pl: 1 }}>
                  • {goal.text.length > 80 ? goal.text.slice(0, 80) + '...' : goal.text}
                </Typography>
              ))}
              {pendingFullLesson.goals.length > 2 && (
                <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                  +{pendingFullLesson.goals.length - 2} more goals
                </Typography>
              )}

              <Divider sx={{ my: 1 }} />

              <Typography variant="body2" fontWeight={600} gutterBottom>
                {pendingFullLesson.components.length} Lesson Components
              </Typography>
              {pendingFullLesson.components.map((comp) => (
                <Typography key={comp.id} variant="caption" display="block" sx={{ mb: 0.25, pl: 1 }}>
                  • {comp.title} ({comp.estimatedMinutes} min)
                </Typography>
              ))}

              <Divider sx={{ my: 1 }} />

              <Typography variant="caption" color="text.secondary">
                Total: {pendingFullLesson.components.reduce((sum, c) => sum + c.estimatedMinutes, 0)} minutes
                {' | '}
                {pendingFullLesson.usage?.totalTokens?.toLocaleString()} tokens used
              </Typography>
            </Box>
          </Box>
        )}

        {/* Pending Goals */}
        {pendingGoals && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="subtitle2">
                Generated Learning Goals ({pendingGoals.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" color="success" onClick={handleAcceptGoals}>
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={handleRejectGoals}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {pendingGoals.map((goal) => (
                <Paper
                  key={goal.id}
                  variant="outlined"
                  sx={{ p: 1.5, mb: 1, bgcolor: 'action.hover' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <FlagIcon sx={{ fontSize: 18, color: 'primary.main', mt: 0.2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{goal.text}</Typography>
                      {goal.standardRef && (
                        <Chip
                          label={goal.standardRef}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5, fontSize: '0.65rem', height: 18 }}
                        />
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))}
              {pendingCriteria.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Success Criteria:
                  </Typography>
                  <List dense disablePadding>
                    {pendingCriteria.map((criterion, i) => (
                      <ListItem key={i} dense disablePadding sx={{ py: 0.25 }}>
                        <ListItemText
                          primary={`• ${criterion}`}
                          primaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Pending Structure */}
        {pendingStructure && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="subtitle2">
                Generated Lesson Structure ({pendingStructure.length} components)
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" color="success" onClick={handleAcceptStructure}>
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={handleRejectStructure}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ maxHeight: 250, overflowY: 'auto' }}>
              {pendingStructure.map((component) => (
                <Paper
                  key={component.id}
                  variant="outlined"
                  sx={{ p: 1.5, mb: 1, bgcolor: 'action.hover' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2">{component.title}</Typography>
                    <Chip
                      label={`${component.estimatedMinutes} min`}
                      size="small"
                      sx={{ fontSize: '0.65rem', height: 18 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {component.description}
                  </Typography>
                </Paper>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Total:{' '}
                {pendingStructure.reduce((sum, c) => sum + c.estimatedMinutes, 0)} minutes
              </Typography>
            </Box>
          </Box>
        )}

        {/* Expandable Components */}
        {lesson.components.length > 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Expand Components with AI
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {lesson.components.map((component) => (
                <Box
                  key={component.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'action.hover'
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {component.title}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={
                      expandingComponentId === component.id ? (
                        <CircularProgress size={14} />
                      ) : (
                        <AutoFixHighIcon />
                      )
                    }
                    onClick={() => handleExpandComponent(component)}
                    disabled={isGenerating}
                    sx={{ minWidth: 90 }}
                  >
                    Expand
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Empty state */}
        {unitStandards.length === 0 && lesson.components.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <SmartToyIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Add standards to the unit or components to the lesson to enable AI assistance.
            </Typography>
          </Box>
        )}

        {/* Info section */}
        <Divider />
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Course: {course.name}
            <br />
            Unit: {unit.name}
            <br />
            Duration: {lesson.estimatedMinutes} minutes
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  )
}
