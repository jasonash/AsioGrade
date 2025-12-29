/**
 * QuestionGenerationModal Component
 *
 * Modal for configuring AI question generation parameters.
 * Shows course standards and materials for selection.
 */

import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DescriptionIcon from '@mui/icons-material/Description'
import { Modal } from '../ui'
import { useAIStore, useCourseMaterialStore } from '../../stores'
import type { Standard } from '../../../../shared/types'
import type {
  QuestionDifficulty,
  QuestionGenerationRequest
} from '../../../../shared/types/ai.types'
import type { AssessmentType } from '../../../../shared/types'
import { QUIZ_MAX_QUESTIONS } from '../../../../shared/types/assessment.types'

interface QuestionGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  assessmentId: string
  gradeLevel: string
  subject: string
  standards: Standard[]
  assessmentType?: AssessmentType
  existingQuestionCount?: number
}

export function QuestionGenerationModal({
  isOpen,
  onClose,
  courseId,
  assessmentId,
  gradeLevel,
  subject,
  standards,
  assessmentType,
  existingQuestionCount = 0
}: QuestionGenerationModalProps): ReactElement {
  const { generateQuestions, isGenerating } = useAIStore()
  const { materials, fetchMaterials } = useCourseMaterialStore()

  // Quiz-specific constraints
  const isQuiz = assessmentType === 'quiz'
  const remainingQuizSlots = isQuiz ? Math.max(0, QUIZ_MAX_QUESTIONS - existingQuestionCount) : 20
  const maxQuestionsAllowed = isQuiz ? remainingQuizSlots : 20

  const [questionCount, setQuestionCount] = useState(Math.min(5, maxQuestionsAllowed))
  const [selectedStandards, setSelectedStandards] = useState<Set<string>>(new Set())
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('mixed')
  const [focusTopics, setFocusTopics] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')

  // Fetch materials and initialize standards when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStandards(new Set(standards.map((s) => s.code)))
      setSelectedMaterials(new Set())
      setCustomPrompt('')
      fetchMaterials(courseId)
    }
  }, [isOpen, standards, courseId, fetchMaterials])

  // Filter to only show materials with successful extraction
  const availableMaterials = materials.filter(
    (m) => m.extractionStatus === 'complete'
  )

  const handleStandardToggle = (code: string): void => {
    setSelectedStandards((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  const handleMaterialToggle = (id: string): void => {
    setSelectedMaterials((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = (): void => {
    setSelectedStandards(new Set(standards.map((s) => s.code)))
  }

  const handleSelectNone = (): void => {
    setSelectedStandards(new Set())
  }

  const handleSelectAllMaterials = (): void => {
    setSelectedMaterials(new Set(availableMaterials.map((m) => m.id)))
  }

  const handleSelectNoMaterials = (): void => {
    setSelectedMaterials(new Set())
  }

  const handleGenerate = async (): Promise<void> => {
    if (selectedStandards.size === 0) return

    const request: QuestionGenerationRequest = {
      courseId,
      assessmentId,
      standardRefs: [...selectedStandards],
      questionCount,
      questionTypes: ['multiple_choice'],
      difficulty,
      gradeLevel,
      subject,
      focusTopics: focusTopics ? focusTopics.split(',').map((t) => t.trim()) : undefined,
      // Phase 4: Include selected materials and custom prompt
      materialIds: selectedMaterials.size > 0 ? [...selectedMaterials] : undefined,
      customPrompt: customPrompt.trim() || undefined
    }

    await generateQuestions(request)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Questions"
      description="Select standards and configure generation settings"
      size="md"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
        {/* Question Count */}
        <TextField
          label="Number of Questions"
          type="number"
          value={questionCount}
          onChange={(e) =>
            setQuestionCount(Math.max(1, Math.min(maxQuestionsAllowed, parseInt(e.target.value) || 1)))
          }
          inputProps={{ min: 1, max: maxQuestionsAllowed }}
          helperText={
            isQuiz
              ? remainingQuizSlots === 0
                ? 'Quiz is at maximum capacity (10 questions)'
                : `Generate 1-${remainingQuizSlots} questions (quiz limit: ${existingQuestionCount}/${QUIZ_MAX_QUESTIONS})`
              : 'Generate 1-20 questions at a time'
          }
          disabled={isQuiz && remainingQuizSlots === 0}
          error={isQuiz && remainingQuizSlots === 0}
        />

        {/* Standards Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">
              Standards ({selectedStandards.size}/{standards.length} selected)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={handleSelectAll}>
                All
              </Button>
              <Button size="small" onClick={handleSelectNone}>
                None
              </Button>
            </Box>
          </Box>

          {standards.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No standards assigned to this course. Add standards to the course first.
            </Typography>
          ) : (
            <Box
              sx={{
                maxHeight: 250,
                overflowY: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1
              }}
            >
              {standards.map((standard) => (
                <FormControlLabel
                  key={standard.code}
                  control={
                    <Checkbox
                      checked={selectedStandards.has(standard.code)}
                      onChange={() => handleStandardToggle(standard.code)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      <strong>{standard.code}</strong> - {standard.description.slice(0, 60)}
                      {standard.description.length > 60 ? '...' : ''}
                    </Typography>
                  }
                  sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Course Materials Section (Phase 4) */}
        {availableMaterials.length > 0 && (
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">
                  Course Materials ({selectedMaterials.size}/{availableMaterials.length} selected)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Select materials to use as context for question generation
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
                <Button size="small" onClick={handleSelectAllMaterials}>
                  All
                </Button>
                <Button size="small" onClick={handleSelectNoMaterials}>
                  None
                </Button>
              </Box>
              <Box
                sx={{
                  maxHeight: 150,
                  overflowY: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1
                }}
              >
                {availableMaterials.map((material) => (
                  <FormControlLabel
                    key={material.id}
                    control={
                      <Checkbox
                        checked={selectedMaterials.has(material.id)}
                        onChange={() => handleMaterialToggle(material.id)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {material.name}
                      </Typography>
                    }
                    sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Difficulty */}
        <TextField
          select
          label="Difficulty Level"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
        >
          <MenuItem value="easy">Easy</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="hard">Hard</MenuItem>
          <MenuItem value="mixed">Mixed (Recommended)</MenuItem>
        </TextField>

        {/* Focus Topics */}
        <TextField
          label="Focus Topics (optional)"
          value={focusTopics}
          onChange={(e) => setFocusTopics(e.target.value)}
          placeholder="e.g., photosynthesis, cell division"
          helperText="Comma-separated list of topics to emphasize"
        />

        {/* Custom Prompt (Phase 4) */}
        <TextField
          label="Custom Instructions (optional)"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="e.g., Focus on application questions, avoid vocabulary-only questions, include real-world scenarios..."
          helperText="Additional instructions for the AI when generating questions"
          multiline
          rows={2}
        />

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={isGenerating || selectedStandards.size === 0 || (isQuiz && remainingQuizSlots === 0)}
            startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isGenerating ? 'Generating...' : `Generate (${selectedStandards.size} standards)`}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
