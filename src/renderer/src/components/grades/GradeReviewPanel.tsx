import { type ReactElement, useState, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import SaveIcon from '@mui/icons-material/Save'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import DescriptionIcon from '@mui/icons-material/Description'
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
    unidentifiedPages,
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

      {/* Unidentified Pages Warning */}
      {unidentifiedPages.length > 0 && (
        <Alert
          severity="warning"
          icon={<ErrorOutlineIcon />}
          sx={{ '& .MuiAlert-message': { width: '100%' } }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>
            {unidentifiedPages.length} Unidentified Scantron{unidentifiedPages.length !== 1 ? 's' : ''}
          </AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            The following pages could not be matched to students. Their QR codes may be damaged or
            unreadable. Please manually assign these scantrons to the correct students.
          </Typography>
          <List dense disablePadding>
            {unidentifiedPages.map((page) => {
              // Find suggested student names
              const suggestedNames = page.suggestedStudents?.map(id => {
                const student = students.find(s => s.id === id)
                return student ? `${student.lastName}, ${student.firstName}` : id
              })

              return (
                <ListItem key={page.pageNumber} disableGutters sx={{ py: 0.5, flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <DescriptionIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Page ${page.pageNumber}`}
                      secondary={page.qrError || 'QR code unreadable'}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </Box>
                  {page.ocrStudentName && (
                    <Box sx={{ pl: 4.5, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Name detected: <strong>{page.ocrStudentName}</strong>
                      </Typography>
                      {suggestedNames && suggestedNames.length > 0 && (
                        <Typography variant="caption" color="info.main" sx={{ display: 'block' }}>
                          Suggested match: {suggestedNames[0]}
                          {suggestedNames.length > 1 && ` (or ${suggestedNames.slice(1).join(', ')})`}
                        </Typography>
                      )}
                    </Box>
                  )}
                </ListItem>
              )
            })}
          </List>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Manual assignment feature coming soon. For now, please re-scan these pages or manually
            enter grades.
          </Typography>
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
