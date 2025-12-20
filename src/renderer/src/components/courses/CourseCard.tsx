import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PeopleIcon from '@mui/icons-material/People'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { CourseSummary } from '../../../../shared/types'
import { Card } from '@/components/ui/card'

interface CourseCardProps {
  course: CourseSummary
  onClick?: () => void
}

export function CourseCard({ course, onClick }: CourseCardProps): ReactElement {
  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      sx={{
        p: 2.5,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        '&:hover': {
          borderColor: 'primary.main'
        },
        '&:hover .arrow-icon': {
          color: 'primary.main'
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        {/* Icon */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: 'primary.main',
            opacity: 0.1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative'
          }}
        >
          <MenuBookIcon
            sx={{
              color: 'primary.main',
              position: 'absolute'
            }}
          />
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {course.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {course.subject} &middot; Grade {course.gradeLevel}
          </Typography>

          {/* Stats */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <PeopleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {course.sectionCount} {course.sectionCount === 1 ? 'section' : 'sections'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Arrow indicator */}
        <ChevronRightIcon
          className="arrow-icon"
          sx={{
            color: 'text.secondary',
            flexShrink: 0,
            transition: 'color 0.2s'
          }}
        />
      </Box>
    </Card>
  )
}
