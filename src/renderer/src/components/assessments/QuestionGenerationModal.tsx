/**
 * QuestionGenerationModal Component
 *
 * Modal for configuring AI question generation parameters.
 * Shows unit standards (pre-selected) and optional other course standards.
 */

import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
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
  unitStandards: Standard[]
  otherStandards: Standard[]
}

export function QuestionGenerationModal({
  isOpen,
  onClose,
  courseId,
  unitId,
  assessmentId,
  gradeLevel,
  subject,
  unitStandards,
  otherStandards
}: QuestionGenerationModalProps): ReactElement {
  const { generateQuestions, isGenerating } = useAIStore()

  const [questionCount, setQuestionCount] = useState(5)
  const [selectedUnitStandards, setSelectedUnitStandards] = useState<Set<string>>(new Set())
  const [selectedOtherStandards, setSelectedOtherStandards] = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('mixed')
  const [focusTopics, setFocusTopics] = useState('')
  const [showOtherStandards, setShowOtherStandards] = useState(false)

  // Initialize unit standards as selected when modal opens or unit standards change
  useEffect(() => {
    if (isOpen) {
      setSelectedUnitStandards(new Set(unitStandards.map((s) => s.code)))
      setSelectedOtherStandards(new Set())
      setShowOtherStandards(false)
    }
  }, [isOpen, unitStandards])

  const handleUnitStandardToggle = (code: string): void => {
    setSelectedUnitStandards((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  const handleOtherStandardToggle = (code: string): void => {
    setSelectedOtherStandards((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  const handleSelectAllUnit = (): void => {
    setSelectedUnitStandards(new Set(unitStandards.map((s) => s.code)))
  }

  const handleSelectNoneUnit = (): void => {
    setSelectedUnitStandards(new Set())
  }

  const allSelectedStandards = [...selectedUnitStandards, ...selectedOtherStandards]

  const handleGenerate = async (): Promise<void> => {
    if (allSelectedStandards.length === 0) return

    const request: QuestionGenerationRequest = {
      courseId,
      unitId,
      assessmentId,
      standardRefs: allSelectedStandards,
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

        {/* Unit Standards Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">
              Unit Standards ({selectedUnitStandards.size}/{unitStandards.length} selected)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={handleSelectAllUnit}>
                All
              </Button>
              <Button size="small" onClick={handleSelectNoneUnit}>
                None
              </Button>
            </Box>
          </Box>

          {unitStandards.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No standards assigned to this unit. Add standards to the unit or use Other Standards below.
            </Typography>
          ) : (
            <Box
              sx={{
                maxHeight: 200,
                overflowY: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1
              }}
            >
              {unitStandards.map((standard) => (
                <FormControlLabel
                  key={standard.code}
                  control={
                    <Checkbox
                      checked={selectedUnitStandards.has(standard.code)}
                      onChange={() => handleUnitStandardToggle(standard.code)}
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

        {/* Other Standards Section (Collapsible) */}
        {otherStandards.length > 0 && (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
              onClick={() => setShowOtherStandards(!showOtherStandards)}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Other Course Standards ({selectedOtherStandards.size} selected)
              </Typography>
              <IconButton size="small">
                {showOtherStandards ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Standards from other units - use for review or cross-topic questions
            </Typography>

            <Collapse in={showOtherStandards}>
              <Box
                sx={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                  mt: 1
                }}
              >
                {otherStandards.map((standard) => (
                  <FormControlLabel
                    key={standard.code}
                    control={
                      <Checkbox
                        checked={selectedOtherStandards.has(standard.code)}
                        onChange={() => handleOtherStandardToggle(standard.code)}
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
            </Collapse>
          </Box>
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

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={isGenerating || allSelectedStandards.length === 0}
            startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isGenerating ? 'Generating...' : `Generate (${allSelectedStandards.length} standards)`}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
