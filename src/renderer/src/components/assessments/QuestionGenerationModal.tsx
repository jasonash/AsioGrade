/**
 * QuestionGenerationModal Component
 *
 * Modal for configuring AI question generation parameters.
 */

import { type ReactElement, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import type { SelectChangeEvent } from '@mui/material/Select'
import OutlinedInput from '@mui/material/OutlinedInput'
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
  unitId: string
  assessmentId: string
  gradeLevel: string
  subject: string
  standards: Standard[]
}

export function QuestionGenerationModal({
  isOpen,
  onClose,
  courseId,
  unitId,
  assessmentId,
  gradeLevel,
  subject,
  standards
}: QuestionGenerationModalProps): ReactElement {
  const { generateQuestions, isGenerating } = useAIStore()

  const [questionCount, setQuestionCount] = useState(5)
  const [selectedStandards, setSelectedStandards] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('mixed')
  const [focusTopics, setFocusTopics] = useState('')

  const handleStandardsChange = (event: SelectChangeEvent<string[]>): void => {
    const value = event.target.value
    setSelectedStandards(typeof value === 'string' ? value.split(',') : value)
  }

  const handleGenerate = async (): Promise<void> => {
    const request: QuestionGenerationRequest = {
      courseId,
      unitId,
      assessmentId,
      standardRefs:
        selectedStandards.length > 0 ? selectedStandards : standards.map((s) => s.code),
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
      description="Configure AI question generation settings"
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

        {/* Standards Selection */}
        <FormControl fullWidth>
          <InputLabel>Standards (optional)</InputLabel>
          <Select
            multiple
            value={selectedStandards}
            onChange={handleStandardsChange}
            input={<OutlinedInput label="Standards (optional)" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((code) => (
                  <Chip key={code} label={code} size="small" />
                ))}
              </Box>
            )}
          >
            {standards.map((standard) => (
              <MenuItem key={standard.code} value={standard.code}>
                {standard.code} - {standard.description.slice(0, 50)}...
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Leave empty to use all course standards
          </Typography>
        </FormControl>

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
            disabled={isGenerating || standards.length === 0}
            startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
