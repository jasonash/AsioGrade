import { type ReactElement, useState, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import SaveIcon from '@mui/icons-material/Save'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { StudentGradeRow } from './StudentGradeRow'
import { useGradeStore } from '../../stores'
import type { Student, GradeOverride } from '../../../../shared/types'

interface GradeReviewPanelProps {
  students: Student[]
}

export function GradeReviewPanel({ students }: GradeReviewPanelProps): ReactElement {
  const {
    currentGrades,
    flaggedRecords,
    pendingOverrides,
    isSaving,
    error,
    addOverride,
    saveGrades,
    clearError
  } = useGradeStore()

  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)

  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  )

  const displayedRecords = useMemo(() => {
    if (!currentGrades) return []
    if (showFlaggedOnly) {
      return currentGrades.records.filter((r) => r.needsReview)
    }
    return currentGrades.records
  }, [currentGrades, showFlaggedOnly])

  const handleOverride = useCallback(
    (override: GradeOverride) => {
      addOverride(override)
    },
    [addOverride]
  )

  const handleSave = useCallback(async () => {
    clearError()
    await saveGrades()
  }, [saveGrades, clearError])

  if (!currentGrades) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">No grades to review</Typography>
      </Box>
    )
  }

  const { stats } = currentGrades
  const hasPendingChanges = pendingOverrides.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 2
        }}
      >
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4">{stats.totalStudents}</Typography>
            <Typography variant="body2" color="text.secondary">
              Students
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4">{stats.averageScore.toFixed(1)}%</Typography>
            <Typography variant="body2" color="text.secondary">
              Average
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4">{stats.highScore.toFixed(0)}%</Typography>
            <Typography variant="body2" color="text.secondary">
              High Score
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4">{stats.lowScore.toFixed(0)}%</Typography>
            <Typography variant="body2" color="text.secondary">
              Low Score
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: flaggedRecords.length > 0 ? 'warning.light' : undefined }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              {flaggedRecords.length > 0 ? (
                <WarningIcon color="warning" />
              ) : (
                <CheckCircleIcon color="success" />
              )}
              <Typography variant="h4">{flaggedRecords.length}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Need Review
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Divider />

      {/* Controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={showFlaggedOnly}
              onChange={(e) => setShowFlaggedOnly(e.target.checked)}
            />
          }
          label={`Show flagged only (${flaggedRecords.length})`}
        />

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {hasPendingChanges && (
            <Typography variant="body2" color="info.main">
              {pendingOverrides.length} pending change{pendingOverrides.length !== 1 ? 's' : ''}
            </Typography>
          )}
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Grades'}
          </Button>
        </Box>
      </Box>

      {/* Student List */}
      <Box>
        {displayedRecords.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {showFlaggedOnly
                ? 'No flagged records to review'
                : 'No student records found'}
            </Typography>
          </Box>
        ) : (
          displayedRecords.map((record) => (
            <StudentGradeRow
              key={record.id}
              record={record}
              student={studentMap.get(record.studentId)}
              onOverride={handleOverride}
              pendingOverrides={pendingOverrides}
            />
          ))
        )}
      </Box>
    </Box>
  )
}
