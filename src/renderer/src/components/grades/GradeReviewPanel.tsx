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
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import SaveIcon from '@mui/icons-material/Save'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import { StudentGradeRow } from './StudentGradeRow'
import { ScantronPageOverview } from './ScantronPageOverview'
import { UnidentifiedPageAssignmentModal } from './UnidentifiedPageAssignmentModal'
import { useGradeStore } from '../../stores'
import type { Student, GradeOverride, UnidentifiedPage } from '../../../../shared/types'

interface GradeReviewPanelProps {
  students: Student[]
}

export function GradeReviewPanel({ students }: GradeReviewPanelProps): ReactElement {
  const {
    currentGrades,
    flaggedRecords,
    unidentifiedPages,
    pendingOverrides,
    parsedPages,
    isSaving,
    error,
    addOverride,
    saveGrades,
    clearError,
    assignUnidentifiedPage
  } = useGradeStore()

  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const [showPageOverview, setShowPageOverview] = useState(true)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [selectedUnidentifiedPage, setSelectedUnidentifiedPage] = useState<UnidentifiedPage | null>(null)

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

  const handleOpenAssignmentModal = useCallback((page: UnidentifiedPage) => {
    setSelectedUnidentifiedPage(page)
    setAssignmentModalOpen(true)
  }, [])

  const handleCloseAssignmentModal = useCallback(() => {
    setAssignmentModalOpen(false)
    setSelectedUnidentifiedPage(null)
  }, [])

  const handleAssignPage = useCallback(
    (pageNumber: number, studentId: string) => {
      assignUnidentifiedPage(pageNumber, studentId)
    },
    [assignUnidentifiedPage]
  )

  // Get set of already-graded student IDs
  const gradedStudentIds = useMemo(() => {
    if (!currentGrades) return new Set<string>()
    return new Set(currentGrades.records.map((r) => r.studentId))
  }, [currentGrades])

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
            The following pages could not be matched to students. Click &ldquo;Assign&rdquo; to
            manually assign each scantron to the correct student.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {unidentifiedPages.map((page) => {
              // Find suggested student names
              const suggestedNames = page.suggestedStudents?.map((id) => {
                const student = students.find((s) => s.id === id)
                return student ? `${student.lastName}, ${student.firstName}` : id
              })

              return (
                <Box
                  key={page.pageNumber}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'warning.light'
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      Page {page.pageNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {page.qrError || 'QR code unreadable'}
                    </Typography>
                    {page.ocrStudentName && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          OCR: <em>&ldquo;{page.ocrStudentName}&rdquo;</em>
                        </Typography>
                        {suggestedNames && suggestedNames.length > 0 && (
                          <Typography variant="caption" color="info.main" sx={{ display: 'block' }}>
                            Best match: {suggestedNames[0]}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    color="warning"
                    startIcon={<PersonAddIcon />}
                    onClick={() => handleOpenAssignmentModal(page)}
                  >
                    Assign
                  </Button>
                </Box>
              )
            })}
          </Box>
        </Alert>
      )}

      {/* Page Overview Section */}
      {parsedPages.length > 0 && (
        <Card>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            onClick={() => setShowPageOverview(!showPageOverview)}
          >
            <Typography variant="subtitle1" fontWeight={500}>
              Scanned Pages Overview
            </Typography>
            <IconButton size="small">
              {showPageOverview ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={showPageOverview}>
            <CardContent sx={{ pt: 0 }}>
              <ScantronPageOverview
                parsedPages={parsedPages}
                unidentifiedPages={unidentifiedPages}
                students={students}
                onAssignPage={handleOpenAssignmentModal}
              />
            </CardContent>
          </Collapse>
        </Card>
      )}

      {/* Assignment Modal */}
      <UnidentifiedPageAssignmentModal
        isOpen={assignmentModalOpen}
        onClose={handleCloseAssignmentModal}
        page={selectedUnidentifiedPage}
        students={students}
        gradedStudentIds={gradedStudentIds}
        onAssign={handleAssignPage}
      />

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
