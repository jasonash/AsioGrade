import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import type { GradeInfo } from '../../../../shared/types'

interface GradeCellProps {
  grade: GradeInfo | null
  totalPoints: number
}

// Color based on percentage
function getGradeColor(percentage: number): string {
  if (percentage >= 90) return 'success.main'
  if (percentage >= 80) return 'info.main'
  if (percentage >= 70) return 'warning.main'
  if (percentage >= 60) return 'warning.dark'
  return 'error.main'
}

export function GradeCell({ grade, totalPoints }: GradeCellProps): ReactElement {
  if (!grade) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minWidth: 60
        }}
      >
        <Typography variant="body2" color="text.disabled">
          -
        </Typography>
      </Box>
    )
  }

  const formattedDate = new Date(grade.gradedAt).toLocaleDateString()

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" display="block">
            Score: {grade.score}/{grade.totalPoints}
          </Typography>
          <Typography variant="caption" display="block">
            Graded: {formattedDate}
          </Typography>
        </Box>
      }
      arrow
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minWidth: 60,
          cursor: 'default'
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: getGradeColor(grade.percentage)
          }}
        >
          {grade.percentage.toFixed(0)}%
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {grade.score}/{totalPoints}
        </Typography>
      </Box>
    </Tooltip>
  )
}
