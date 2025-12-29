/**
 * QuestionGenerationModal Component
 *
 * Modal for configuring AI question generation parameters.
 * Shows course standards for selection.
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
import { Modal } from '../ui'
import { useAIStore } from '../../stores'
import type { Standard } from '../../../../shared/types'
import type {
  QuestionDifficulty,
  QuestionGenerationRequest
} from '../../../../shared/types/ai.types'

interface QuestionGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  assessmentId: string
  gradeLevel: string
  subject: string
  standards: Standard[]
}

export function QuestionGenerationModal({
  isOpen,
  onClose,
  courseId,
  assessmentId,
  gradeLevel,
  subject,
  standards
}: QuestionGenerationModalProps): ReactElement {
  const { generateQuestions, isGenerating } = useAIStore()

  const [questionCount, setQuestionCount] = useState(5)
  const [selectedStandards, setSelectedStandards] = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('mixed')
  const [focusTopics, setFocusTopics] = useState('')

  // Initialize standards as selected when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStandards(new Set(standards.map((s) => s.code)))
    }
  }, [isOpen, standards])

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

  const handleSelectAll = (): void => {
    setSelectedStandards(new Set(standards.map((s) => s.code)))
  }

  const handleSelectNone = (): void => {
    setSelectedStandards(new Set())
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
      focusTopics: focusTopics ? focusTopics.split(',').map((t) => t.trim()) : undefined
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
            setQuestionCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
          }
          inputProps={{ min: 1, max: 20 }}
          helperText="Generate 1-20 questions at a time"
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

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={isGenerating || selectedStandards.size === 0}
            startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isGenerating ? 'Generating...' : `Generate (${selectedStandards.size} standards)`}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
