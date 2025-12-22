import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import type { LessonSummary, LessonStatus } from '../../../../shared/types'

interface LessonCardProps {
  lesson: LessonSummary
  onClick?: () => void
}

const statusLabels: Record<LessonStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  taught: 'Taught'
}

const statusColors: Record<LessonStatus, 'default' | 'primary' | 'success'> = {
  draft: 'default',
  ready: 'primary',
  taught: 'success'
}

export function LessonCard({ lesson, onClick }: LessonCardProps): ReactElement {
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
          <MenuBookIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {lesson.title}
            </Typography>
            <Chip
              label={statusLabels[lesson.status]}
              color={statusColors[lesson.status]}
              variant={lesson.status === 'draft' ? 'outlined' : 'filled'}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
            {lesson.aiGenerated && (
              <SmartToyIcon
                sx={{ fontSize: 16, color: 'primary.main' }}
                titleAccess="AI Generated"
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {lesson.estimatedMinutes} min
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {lesson.componentCount} component{lesson.componentCount !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {lesson.goalCount} goal{lesson.goalCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
