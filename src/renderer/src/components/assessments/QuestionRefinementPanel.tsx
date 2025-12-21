/**
 * QuestionRefinementPanel Component
 *
 * Panel for refining questions with AI-powered commands.
 */

import { type ReactElement, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { useAIStore } from '../../stores'
import type { MultipleChoiceQuestion } from '../../../../shared/types'
import type { RefinementCommand } from '../../../../shared/types/ai.types'

interface QuestionRefinementPanelProps {
  question: MultipleChoiceQuestion
  gradeLevel: string
  onAccept: (refined: MultipleChoiceQuestion) => void
  onCancel: () => void
}

const REFINEMENT_COMMANDS: { command: RefinementCommand; label: string; description: string }[] = [
  { command: 'simplify', label: 'Simplify', description: 'Lower reading level' },
  { command: 'harder', label: 'Harder', description: 'Increase difficulty' },
  { command: 'distractors', label: 'Distractors', description: 'Improve wrong answers' },
  { command: 'rephrase', label: 'Rephrase', description: 'Alternative wording' },
  { command: 'hint', label: 'Add Hint', description: 'Add scaffolding' }
]

export function QuestionRefinementPanel({
  question,
  gradeLevel,
  onAccept,
  onCancel
}: QuestionRefinementPanelProps): ReactElement {
  const { refineQuestion, isRefining, refinementResult, acceptRefinement, rejectRefinement } =
    useAIStore()

  const [selectedCommand, setSelectedCommand] = useState<RefinementCommand | null>(null)

  const handleRefine = async (command: RefinementCommand): Promise<void> => {
    setSelectedCommand(command)
    await refineQuestion(question, command, gradeLevel, question.standardRef)
  }

  const handleAccept = (): void => {
    const refined = acceptRefinement()
    if (refined) {
      onAccept(refined)
    }
  }

  const handleReject = (): void => {
    rejectRefinement()
    setSelectedCommand(null)
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Refine Question
      </Typography>

      {/* Command buttons */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {REFINEMENT_COMMANDS.map(({ command, label, description }) => (
          <Button
            key={command}
            size="small"
            variant={selectedCommand === command ? 'contained' : 'outlined'}
            onClick={() => handleRefine(command)}
            disabled={isRefining}
            title={description}
          >
            {isRefining && selectedCommand === command ? (
              <CircularProgress size={14} color="inherit" sx={{ mr: 0.5 }} />
            ) : null}
            {label}
          </Button>
        ))}
      </Box>

      {/* Comparison view */}
      {refinementResult && (
        <Box>
          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CompareArrowsIcon color="primary" />
            <Typography variant="body2" fontWeight={600}>
              Before / After
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {/* Original */}
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Original
              </Typography>
              <Typography variant="body2">{refinementResult.original.text}</Typography>
            </Paper>

            {/* Refined */}
            <Paper variant="outlined" sx={{ p: 1.5, borderColor: 'success.main' }}>
              <Typography variant="caption" color="success.main" sx={{ mb: 1, display: 'block' }}>
                Refined
              </Typography>
              <Typography variant="body2">{refinementResult.refined.text}</Typography>
            </Paper>
          </Box>

          {refinementResult.explanation && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {refinementResult.explanation}
            </Typography>
          )}

          {/* Accept/Reject */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={handleAccept}
            >
              Use Refined
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={handleReject}
            >
              Keep Original
            </Button>
          </Box>
        </Box>
      )}

      {/* Cancel button if no refinement yet */}
      {!refinementResult && (
        <Box sx={{ mt: 2 }}>
          <Button size="small" variant="text" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      )}
    </Paper>
  )
}
