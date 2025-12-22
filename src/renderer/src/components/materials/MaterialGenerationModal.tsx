/**
 * MaterialGenerationModal Component
 *
 * Modal for generating teaching materials from lesson content.
 * Supports worksheets, puzzles, vocabulary lists, graphic organizers,
 * exit tickets, and AI-generated diagrams.
 */

import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import DescriptionIcon from '@mui/icons-material/Description'
import GridOnIcon from '@mui/icons-material/GridOn'
import ExtensionIcon from '@mui/icons-material/Extension'
import ListAltIcon from '@mui/icons-material/ListAlt'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ImageIcon from '@mui/icons-material/Image'
import AssignmentIcon from '@mui/icons-material/Assignment'
import CalculateIcon from '@mui/icons-material/Calculate'
import { Modal } from '../ui'
import type {
  GeneratedMaterialType,
  MaterialOptions,
  GraphicOrganizerTemplate,
  GeneratedMaterial
} from '../../../../shared/types/material.types'
import type { Lesson, CourseSummary, UnitSummary, Standard } from '../../../../shared/types'

interface MaterialGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerated: (material: GeneratedMaterial) => void
  lesson: Lesson
  course: CourseSummary
  unit: UnitSummary
  standards: Standard[]
  componentId?: string
  componentTitle?: string
  imageGenerationAvailable: boolean
}

interface MaterialTypeOption {
  type: GeneratedMaterialType
  label: string
  description: string
  icon: ReactElement
  requiresImage: boolean
}

const MATERIAL_TYPE_OPTIONS: MaterialTypeOption[] = [
  {
    type: 'worksheet',
    label: 'Worksheet',
    description: 'Questions and exercises',
    icon: <DescriptionIcon />,
    requiresImage: false
  },
  {
    type: 'word-search',
    label: 'Word Search',
    description: 'Vocabulary puzzle',
    icon: <GridOnIcon />,
    requiresImage: false
  },
  {
    type: 'crossword',
    label: 'Crossword',
    description: 'Puzzle with clues',
    icon: <ExtensionIcon />,
    requiresImage: false
  },
  {
    type: 'vocabulary-list',
    label: 'Vocabulary List',
    description: 'Terms and definitions',
    icon: <ListAltIcon />,
    requiresImage: false
  },
  {
    type: 'graphic-organizer',
    label: 'Graphic Organizer',
    description: 'Visual templates',
    icon: <AccountTreeIcon />,
    requiresImage: false
  },
  {
    type: 'exit-ticket',
    label: 'Exit Ticket',
    description: 'Quick assessment',
    icon: <AssignmentIcon />,
    requiresImage: false
  },
  {
    type: 'practice-problems',
    label: 'Practice Problems',
    description: 'Problems with solutions',
    icon: <CalculateIcon />,
    requiresImage: false
  },
  {
    type: 'diagram',
    label: 'Diagram',
    description: 'AI-generated visual',
    icon: <ImageIcon />,
    requiresImage: true
  }
]

const GRAPHIC_ORGANIZER_OPTIONS: { value: GraphicOrganizerTemplate; label: string }[] = [
  { value: 'venn-diagram', label: 'Venn Diagram' },
  { value: 'concept-map', label: 'Concept Map' },
  { value: 'flowchart', label: 'Flowchart' },
  { value: 'kwl-chart', label: 'KWL Chart' },
  { value: 'cause-effect', label: 'Cause & Effect' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'main-idea', label: 'Main Idea & Details' },
  { value: 'comparison-matrix', label: 'Comparison Matrix' }
]

export function MaterialGenerationModal({
  isOpen,
  onClose,
  onGenerated,
  lesson,
  course,
  unit,
  standards,
  componentId,
  componentTitle,
  imageGenerationAvailable
}: MaterialGenerationModalProps): ReactElement {
  const [selectedType, setSelectedType] = useState<GeneratedMaterialType | null>(null)
  const [options, setOptions] = useState<MaterialOptions>({
    questionCount: 10,
    includeAnswerKey: true,
    difficulty: 'mixed',
    puzzleSize: 'medium',
    wordCount: 12,
    includeExamples: true,
    template: 'concept-map',
    exitTicketQuestions: 3,
    diagramStyle: 'labeled'
  })
  const [customTopic, setCustomTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(null)
      setError(null)
      setProgress(null)
      setCustomTopic('')
    }
  }, [isOpen])

  // Determine topic from context
  const getTopic = (): string => {
    if (customTopic.trim()) return customTopic.trim()
    if (componentTitle) return componentTitle
    return lesson.title
  }

  const handleGenerate = async (): Promise<void> => {
    if (!selectedType) return

    setIsGenerating(true)
    setError(null)
    setProgress('Preparing content...')

    try {
      const request = {
        lessonId: lesson.id,
        courseId: course.id,
        unitId: unit.id,
        componentId,
        materialType: selectedType,
        topic: getTopic(),
        gradeLevel: course.gradeLevel,
        subject: course.subject,
        standards: standards.map((s) => s.code),
        learningGoals: lesson.learningGoals,
        options
      }

      const standardsText = standards.map((s) => `${s.code}: ${s.description}`).join('\n')

      setProgress('Generating content with AI...')

      const result = await window.electronAPI.invoke<{
        success: boolean
        data?: GeneratedMaterial
        error?: string
      }>('ai:generateMaterial', request, standardsText)

      if (result.success && result.data) {
        setProgress('Generating PDF...')

        // Generate PDF
        const pdfResult = await window.electronAPI.invoke<{
          success: boolean
          pdfBuffer?: string
          error?: string
        }>('material:generatePDF', result.data, course.name, unit.name)

        if (pdfResult.success && pdfResult.pdfBuffer) {
          result.data.pdfBuffer = pdfResult.pdfBuffer
        }

        onGenerated(result.data)
        onClose()
      } else {
        setError(result.error ?? 'Failed to generate material')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
      setProgress(null)
    }
  }

  const handleOptionChange = <K extends keyof MaterialOptions>(
    key: K,
    value: MaterialOptions[K]
  ): void => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  const renderTypeSelector = (): ReactElement => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Select Material Type
      </Typography>
      <Grid container spacing={1.5}>
        {MATERIAL_TYPE_OPTIONS.map((option) => {
          const isDisabled = option.requiresImage && !imageGenerationAvailable
          const isSelected = selectedType === option.type

          return (
            <Grid item xs={6} sm={4} md={3} key={option.type}>
              <Paper
                elevation={isSelected ? 4 : 1}
                sx={{
                  p: 1.5,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                  border: isSelected ? '2px solid' : '2px solid transparent',
                  borderColor: isSelected ? 'primary.main' : 'transparent',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: isDisabled ? undefined : 'action.hover'
                  }
                }}
                onClick={() => !isDisabled && setSelectedType(option.type)}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ color: isSelected ? 'primary.main' : 'text.secondary' }}>
                    {option.icon}
                  </Box>
                  <Typography
                    variant="body2"
                    fontWeight={isSelected ? 600 : 400}
                    align="center"
                  >
                    {option.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center">
                    {option.description}
                  </Typography>
                  {isDisabled && (
                    <Chip label="Gemini API required" size="small" color="warning" sx={{ mt: 0.5 }} />
                  )}
                </Box>
              </Paper>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )

  const renderOptions = (): ReactElement | null => {
    if (!selectedType) return null

    return (
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          Options
        </Typography>

        {/* Custom topic override */}
        <TextField
          label="Custom Topic (optional)"
          value={customTopic}
          onChange={(e) => setCustomTopic(e.target.value)}
          fullWidth
          size="small"
          placeholder={getTopic()}
          helperText="Leave empty to use lesson/component title"
          sx={{ mb: 2 }}
        />

        <Grid container spacing={2}>
          {/* Worksheet / Practice Problems options */}
          {(selectedType === 'worksheet' || selectedType === 'practice-problems') && (
            <>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Questions</InputLabel>
                  <Select
                    value={options.questionCount}
                    label="Questions"
                    onChange={(e) => handleOptionChange('questionCount', e.target.value as number)}
                  >
                    {[5, 10, 15, 20].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n} questions
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={options.difficulty}
                    label="Difficulty"
                    onChange={(e) =>
                      handleOptionChange('difficulty', e.target.value as MaterialOptions['difficulty'])
                    }
                  >
                    <MenuItem value="easy">Easy</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="hard">Hard</MenuItem>
                    <MenuItem value="mixed">Mixed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.includeAnswerKey}
                      onChange={(e) => handleOptionChange('includeAnswerKey', e.target.checked)}
                    />
                  }
                  label="Include answer key"
                />
              </Grid>
            </>
          )}

          {/* Puzzle options */}
          {(selectedType === 'word-search' || selectedType === 'crossword') && (
            <>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Size</InputLabel>
                  <Select
                    value={options.puzzleSize}
                    label="Size"
                    onChange={(e) =>
                      handleOptionChange('puzzleSize', e.target.value as MaterialOptions['puzzleSize'])
                    }
                  >
                    <MenuItem value="small">Small (10x10)</MenuItem>
                    <MenuItem value="medium">Medium (15x15)</MenuItem>
                    <MenuItem value="large">Large (20x20)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Words</InputLabel>
                  <Select
                    value={options.wordCount}
                    label="Words"
                    onChange={(e) => handleOptionChange('wordCount', e.target.value as number)}
                  >
                    {[8, 10, 12, 15, 20].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n} words
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {/* Vocabulary List options */}
          {selectedType === 'vocabulary-list' && (
            <>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Words</InputLabel>
                  <Select
                    value={options.wordCount}
                    label="Words"
                    onChange={(e) => handleOptionChange('wordCount', e.target.value as number)}
                  >
                    {[5, 10, 15, 20].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n} words
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.includeExamples}
                      onChange={(e) => handleOptionChange('includeExamples', e.target.checked)}
                    />
                  }
                  label="Include examples"
                />
              </Grid>
            </>
          )}

          {/* Graphic Organizer options */}
          {selectedType === 'graphic-organizer' && (
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Template</InputLabel>
                <Select
                  value={options.template}
                  label="Template"
                  onChange={(e) =>
                    handleOptionChange('template', e.target.value as GraphicOrganizerTemplate)
                  }
                >
                  {GRAPHIC_ORGANIZER_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Exit Ticket options */}
          {selectedType === 'exit-ticket' && (
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Questions</InputLabel>
                <Select
                  value={options.exitTicketQuestions}
                  label="Questions"
                  onChange={(e) =>
                    handleOptionChange('exitTicketQuestions', e.target.value as number)
                  }
                >
                  {[2, 3, 4, 5].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n} questions
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Diagram options */}
          {selectedType === 'diagram' && (
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Style</InputLabel>
                <Select
                  value={options.diagramStyle}
                  label="Style"
                  onChange={(e) =>
                    handleOptionChange('diagramStyle', e.target.value as MaterialOptions['diagramStyle'])
                  }
                >
                  <MenuItem value="simple">Simple</MenuItem>
                  <MenuItem value="labeled">Labeled</MenuItem>
                  <MenuItem value="detailed">Detailed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </Box>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Material" size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Context info */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={course.name} size="small" variant="outlined" />
          <Chip label={unit.name} size="small" variant="outlined" />
          <Chip label={lesson.title} size="small" color="primary" />
          {componentTitle && (
            <Chip label={componentTitle} size="small" color="secondary" />
          )}
        </Box>

        {/* Error */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Type selector */}
        {renderTypeSelector()}

        {/* Options */}
        {renderOptions()}

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={!selectedType || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={16} /> : undefined}
          >
            {isGenerating ? progress || 'Generating...' : 'Generate'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
