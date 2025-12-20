import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import PeopleIcon from '@mui/icons-material/People'
import ScheduleIcon from '@mui/icons-material/Schedule'
import RoomIcon from '@mui/icons-material/Room'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import FolderIcon from '@mui/icons-material/Folder'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { useCourseStore, useSectionStore, useStandardsStore, useUnitStore } from '../stores'
import { SectionCreationModal } from '../components/sections'
import { StandardsImportModal } from '../components/standards'
import { UnitCreationModal } from '../components/units'
import type { SectionSummary, UnitSummary } from '../../../shared/types'

interface CourseViewPageProps {
  onSectionSelect?: (section: SectionSummary) => void
}

export function CourseViewPage({ onSectionSelect }: CourseViewPageProps): ReactElement {
  const { currentCourse, setCurrentCourse } = useCourseStore()
  const { sections, loading, error, fetchSections, clearSections } = useSectionStore()
  const { summary: standardsSummary, fetchSummary: fetchStandardsSummary, clearStandards } = useStandardsStore()
  const {
    units,
    loading: unitsLoading,
    error: unitsError,
    fetchUnits,
    clearUnits
  } = useUnitStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isStandardsModalOpen, setIsStandardsModalOpen] = useState(false)
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false)

  // Fetch sections, standards, and units when course changes
  useEffect(() => {
    if (currentCourse?.id) {
      fetchSections(currentCourse.id)
      fetchStandardsSummary(currentCourse.id)
      fetchUnits(currentCourse.id)
    }
    return () => {
      clearSections()
      clearStandards()
      clearUnits()
    }
  }, [currentCourse?.id, fetchSections, clearSections, fetchStandardsSummary, clearStandards, fetchUnits, clearUnits])

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
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>{sections.length}</Typography>
            <Typography variant="body2" color="text.secondary">Sections</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>
              {sections.reduce((sum, s) => sum + s.studentCount, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total Students</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>
              {standardsSummary?.standardCount ?? 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">Standards</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h4" fontWeight={700}>{units.length}</Typography>
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

      {/* Standards Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Standards</Typography>
          <Button
            variant={standardsSummary ? 'outlined' : 'contained'}
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsStandardsModalOpen(true)}
          >
            {standardsSummary ? 'Update Standards' : 'Import Standards'}
          </Button>
        </Box>

        {/* Empty state */}
        {!standardsSummary && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 2, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MenuBookIcon sx={{ fontSize: 24, color: 'primary.main' }} />
            </Box>
            <Typography fontWeight={500} gutterBottom>No standards imported</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Import teaching standards to align your units and assessments.
            </Typography>
            <Button variant="contained" onClick={() => setIsStandardsModalOpen(true)}>
              Import Standards
            </Button>
          </Paper>
        )}

        {/* Standards summary */}
        {standardsSummary && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography fontWeight={500}>
                  {standardsSummary.framework} - {standardsSummary.state}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {standardsSummary.standardCount} standards across {standardsSummary.domainCount} domains
                </Typography>
              </Box>
              <Button size="small" onClick={() => setIsStandardsModalOpen(true)}>
                Update
              </Button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Units Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Units</Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsUnitModalOpen(true)}
          >
            Add Unit
          </Button>
        </Box>

        {/* Loading state */}
        {unitsLoading && units.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Error state */}
        {unitsError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => fetchUnits(currentCourse.id)}>Try again</Button>
            }
          >
            {unitsError}
          </Alert>
        )}

        {/* Empty state */}
        {!unitsLoading && !unitsError && units.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 2, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderIcon sx={{ fontSize: 24, color: 'primary.main' }} />
            </Box>
            <Typography fontWeight={500} gutterBottom>No units yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create units to organize your curriculum and align to standards.
            </Typography>
            <Button variant="contained" onClick={() => setIsUnitModalOpen(true)}>
              Create Your First Unit
            </Button>
          </Paper>
        )}

        {/* Units list */}
        {units.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} />
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

      {/* Standards Import Modal */}
      <StandardsImportModal
        isOpen={isStandardsModalOpen}
        onClose={() => setIsStandardsModalOpen(false)}
        courseId={currentCourse.id}
        courseName={currentCourse.name}
        courseSubject={currentCourse.subject}
        courseGradeLevel={currentCourse.gradeLevel}
        onSuccess={() => {
          fetchStandardsSummary(currentCourse.id)
        }}
      />

      {/* Unit Creation Modal */}
      <UnitCreationModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        courseId={currentCourse.id}
        courseName={currentCourse.name}
        onSuccess={(unit) => {
          console.log('Unit created:', unit.name)
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

interface UnitCardProps {
  unit: UnitSummary
}

function UnitCard({ unit }: UnitCardProps): ReactElement {
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
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`Unit ${unit.order}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Typography fontWeight={500}>{unit.name}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <MenuBookIcon sx={{ fontSize: 14 }} />
              <Typography variant="body2">
                {unit.standardCount} {unit.standardCount === 1 ? 'standard' : 'standards'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <AssignmentIcon sx={{ fontSize: 14 }} />
              <Typography variant="body2">
                {unit.assessmentCount} {unit.assessmentCount === 1 ? 'assessment' : 'assessments'}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Button size="small">View</Button>
      </Box>
    </Paper>
  )
}
