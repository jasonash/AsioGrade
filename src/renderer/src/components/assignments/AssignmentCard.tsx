import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import AssignmentIcon from '@mui/icons-material/Assignment'
import QuizIcon from '@mui/icons-material/Quiz'
import PeopleIcon from '@mui/icons-material/People'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import type {
  AssignmentSummary,
  AssessmentType,
  AssignmentStatus
} from '../../../../shared/types'

interface AssignmentCardProps {
  assignment: AssignmentSummary
  onClick?: () => void
}

const statusLabels: Record<AssignmentStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  collecting: 'Collecting',
  grading: 'Grading',
  graded: 'Graded'
}

const statusColors: Record<
  AssignmentStatus,
  'default' | 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error'
> = {
  draft: 'default',
  assigned: 'primary',
  collecting: 'info',
  grading: 'warning',
  graded: 'success'
}

const typeLabels: Record<AssessmentType, string> = {
  test: 'Test',
  quiz: 'Quiz',
  exam: 'Exam',
  benchmark: 'Benchmark',
  pretest: 'Pre-Test',
  exit_ticket: 'Exit Ticket'
}

function formatDate(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AssignmentCard({ assignment, onClick }: AssignmentCardProps): ReactElement {
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
          {assignment.assessmentType === 'quiz' || assignment.assessmentType === 'exit_ticket' ? (
            <QuizIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
          ) : (
            <AssignmentIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
          )}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {assignment.assessmentTitle}
            </Typography>
            <Chip
              label={typeLabels[assignment.assessmentType]}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
            <Chip
              label={statusLabels[assignment.status]}
              color={statusColors[assignment.status]}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {assignment.studentCount} student{assignment.studentCount !== 1 ? 's' : ''}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {assignment.questionCount} question{assignment.questionCount !== 1 ? 's' : ''}
            </Typography>

            {assignment.dueDate && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  Due: {formatDate(assignment.dueDate)}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
