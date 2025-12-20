import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import QuizIcon from '@mui/icons-material/Quiz'
import AssignmentIcon from '@mui/icons-material/Assignment'
import type { AssessmentSummary, AssessmentType } from '../../../../shared/types'

interface AssessmentCardProps {
  assessment: AssessmentSummary
  onClick?: () => void
}

const typeLabels: Record<AssessmentType, string> = {
  test: 'Test',
  quiz: 'Quiz',
  exam: 'Exam',
  benchmark: 'Benchmark',
  pretest: 'Pre-Test',
  exit_ticket: 'Exit Ticket'
}

const typeColors: Record<AssessmentType, 'primary' | 'secondary' | 'info' | 'warning' | 'success'> =
  {
    test: 'primary',
    quiz: 'info',
    exam: 'warning',
    benchmark: 'secondary',
    pretest: 'success',
    exit_ticket: 'info'
  }

export function AssessmentCard({ assessment, onClick }: AssessmentCardProps): ReactElement {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onClick
          ? {
              borderColor: 'primary.main',
              bgcolor: 'action.hover'
            }
          : {}
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        {/* Icon */}
        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {assessment.type === 'quiz' || assessment.type === 'exit_ticket' ? (
            <QuizIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
          ) : (
            <AssignmentIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
          )}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {assessment.title}
            </Typography>
            <Chip
              label={typeLabels[assessment.type]}
              color={typeColors[assessment.type]}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
            {assessment.status === 'draft' && (
              <Chip
                label="Draft"
                variant="outlined"
                size="small"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {assessment.questionCount} question{assessment.questionCount !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {assessment.totalPoints} point{assessment.totalPoints !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {assessment.purpose === 'formative' ? 'Formative' : 'Summative'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
