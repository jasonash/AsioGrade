/**
 * GeneratedQuestionCard Component
 *
 * Displays an AI-generated question with accept/reject actions.
 */

import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import type { GeneratedQuestion } from '../../../../shared/types/ai.types'

interface GeneratedQuestionCardProps {
  question: GeneratedQuestion
  onAccept: () => void
  onReject: () => void
}

export function GeneratedQuestionCard({
  question,
  onAccept,
  onReject
}: GeneratedQuestionCardProps): ReactElement {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 1,
        borderColor: 'primary.main',
        borderWidth: 1,
        bgcolor: 'action.hover'
      }}
    >
      {/* Question text */}
      <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
        {question.text}
      </Typography>

      {/* Choices */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
        {question.choices.map((choice) => (
          <Box
            key={choice.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              py: 0.25,
              px: 1,
              borderRadius: 1,
              bgcolor: choice.isCorrect ? 'success.main' : 'transparent',
              color: choice.isCorrect ? 'white' : 'inherit'
            }}
          >
            {choice.isCorrect && <CheckCircleIcon sx={{ fontSize: 14 }} />}
            <Typography variant="caption" fontWeight={500}>
              {choice.id.toUpperCase()}.
            </Typography>
            <Typography variant="caption">{choice.text}</Typography>
          </Box>
        ))}
      </Box>

      {/* Metadata */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
        {question.standardRef && (
          <Chip label={question.standardRef} size="small" color="info" variant="outlined" />
        )}
        <Chip label={`${question.points} pt`} size="small" variant="outlined" />
        <Chip label="AI Generated" size="small" color="primary" variant="outlined" />
      </Box>

      {/* Explanation */}
      {question.explanation && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1.5 }}
        >
          <strong>Why correct:</strong> {question.explanation}
        </Typography>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<CheckIcon />}
          onClick={onAccept}
        >
          Accept
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<CloseIcon />}
          onClick={onReject}
        >
          Reject
        </Button>
      </Box>
    </Paper>
  )
}
