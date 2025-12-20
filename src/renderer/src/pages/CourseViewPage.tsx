import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import PeopleIcon from '@mui/icons-material/People'
import ScheduleIcon from '@mui/icons-material/Schedule'
import RoomIcon from '@mui/icons-material/Room'
import { useCourseStore, useSectionStore } from '../stores'
import { SectionCreationModal } from '../components/sections'
import type { SectionSummary } from '../../../shared/types'

interface CourseViewPageProps {
  onSectionSelect?: (section: SectionSummary) => void
}

export function CourseViewPage({ onSectionSelect }: CourseViewPageProps): ReactElement {
  const { currentCourse, setCurrentCourse } = useCourseStore()
  const { sections, loading, error, fetchSections, clearSections } = useSectionStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Fetch sections when course changes
  useEffect(() => {
    if (currentCourse?.id) {
      fetchSections(currentCourse.id)
    }
    return () => {
      clearSections()
    }
  }, [currentCourse?.id, fetchSections, clearSections])

  const handleBackClick = (): void => {
    setCurrentCourse(null)
  }

  if (!currentCourse) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Typography color="text.secondary">No course selected</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
      {/* Header */}
      <Box component="header">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBackClick}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Back to Dashboard
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {currentCourse.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {currentCourse.subject} | Grade {currentCourse.gradeLevel} | {currentCourse.academicYear}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>{sections.length}</Typography>
            <Typography variant="body2" color="text.secondary">Sections</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>
              {sections.reduce((sum, s) => sum + s.studentCount, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Students</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>0</Typography>
            <Typography variant="body2" color="text.secondary">Units</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Sections */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Sections</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setIsCreateModalOpen(true)}>
            Add Section
          </Button>
        </Box>

        {/* Loading state */}
        {loading && sections.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => fetchSections(currentCourse.id)}>Try again</Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Empty state */}
        {!loading && !error && sections.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 2, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PeopleIcon sx={{ fontSize: 24, color: 'primary.main' }} />
            </Box>
            <Typography fontWeight={500} gutterBottom>No sections yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add sections to organize your students by period or block.
            </Typography>
            <Button variant="contained" onClick={() => setIsCreateModalOpen(true)}>
              Add Your First Section
            </Button>
          </Paper>
        )}

        {/* Sections list */}
        {sections.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                onView={() => onSectionSelect?.(section)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Section Creation Modal */}
      <SectionCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        courseId={currentCourse.id}
        courseName={currentCourse.name}
        onSuccess={(section) => {
          console.log('Section created:', section.name)
        }}
      />
    </Box>
  )
}

interface SectionCardProps {
  section: SectionSummary
  onView: () => void
}

function SectionCard({ section, onView }: SectionCardProps): ReactElement {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        '&:hover': {
          borderColor: 'primary.main'
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography fontWeight={500}>{section.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <PeopleIcon sx={{ fontSize: 14 }} />
              <Typography variant="body2">{section.studentCount} students</Typography>
            </Box>
            {section.schedule && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <ScheduleIcon sx={{ fontSize: 14 }} />
                <Typography variant="body2">{section.schedule}</Typography>
              </Box>
            )}
            {section.room && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <RoomIcon sx={{ fontSize: 14 }} />
                <Typography variant="body2">{section.room}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Button size="small" onClick={onView}>View</Button>
      </Box>
    </Paper>
  )
}
