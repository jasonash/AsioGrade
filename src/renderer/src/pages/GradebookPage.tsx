import { type ReactElement, useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DownloadIcon from '@mui/icons-material/Download'
import RefreshIcon from '@mui/icons-material/Refresh'
import { GradeCell } from '../components/gradebook'
import type { Gradebook, SectionSummary, CourseSummary } from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface GradebookPageProps {
  course: CourseSummary
  section: SectionSummary
  onBack: () => void
}

export function GradebookPage({ course, section, onBack }: GradebookPageProps): ReactElement {
  const [gradebook, setGradebook] = useState<Gradebook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchGradebook = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Gradebook>>(
        'grade:getGradebook',
        section.id
      )

      if (result.success) {
        setGradebook(result.data)
      } else {
        setError(result.error ?? 'Failed to load gradebook')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gradebook')
    }

    setLoading(false)
  }, [section.id])

  useEffect(() => {
    fetchGradebook()
  }, [fetchGradebook])

  const handleExportCSV = async (): Promise<void> => {
    setExporting(true)

    try {
      const result = await window.electronAPI.invoke<ServiceResult<string>>(
        'grade:exportGradebookCSV',
        section.id,
        true // includeStudentNumber
      )

      if (result.success) {
        // Save using dialog
        const csvData = result.data
        const blob = new Blob([csvData], { type: 'text/csv' })
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const result = reader.result as string
            resolve(result.split(',')[1]) // Remove data URL prefix
          }
          reader.readAsDataURL(blob)
        })

        await window.electronAPI.invoke('file:saveWithDialog', {
          data: base64,
          defaultFilename: `gradebook-${section.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        })
      } else {
        setError(result.error ?? 'Failed to export gradebook')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export gradebook')
    }

    setExporting(false)
  }

  // Color for average percentage
  const getAverageColor = (avg: number | null): string => {
    if (avg === null) return 'text.disabled'
    if (avg >= 90) return 'success.main'
    if (avg >= 80) return 'info.main'
    if (avg >= 70) return 'warning.main'
    if (avg >= 60) return 'warning.dark'
    return 'error.main'
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
      {/* Header */}
      <Box component="header">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Back to {section.name}
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Gradebook
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {course.name} - {section.name}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchGradebook}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={handleExportCSV}
              disabled={loading || exporting || !gradebook || gradebook.entries.length === 0}
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert
          severity="error"
          action={
            <Button size="small" onClick={fetchGradebook}>
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Empty state */}
      {!loading && !error && gradebook && gradebook.assessments.length === 0 && (
        <Box
          sx={{
            py: 6,
            textAlign: 'center',
            bgcolor: 'action.hover',
            borderRadius: 1
          }}
        >
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No graded assignments yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grade some assignments and they&apos;ll appear here.
          </Typography>
        </Box>
      )}

      {/* Gradebook table */}
      {!loading && !error && gradebook && gradebook.assessments.length > 0 && (
        <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 250px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    bgcolor: 'background.paper',
                    minWidth: 180,
                    position: 'sticky',
                    left: 0,
                    zIndex: 3
                  }}
                >
                  Student
                </TableCell>
                {gradebook.assessments.map((assessment) => (
                  <TableCell
                    key={assessment.id}
                    align="center"
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      minWidth: 100,
                      maxWidth: 150
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 140
                        }}
                        title={assessment.title}
                      >
                        {assessment.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({assessment.totalPoints} pts)
                      </Typography>
                    </Box>
                  </TableCell>
                ))}
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 600,
                    bgcolor: 'background.paper',
                    minWidth: 80,
                    position: 'sticky',
                    right: 0,
                    zIndex: 3
                  }}
                >
                  Average
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gradebook.entries.map((entry) => (
                <TableRow key={entry.studentId} hover>
                  <TableCell
                    sx={{
                      fontWeight: 500,
                      position: 'sticky',
                      left: 0,
                      bgcolor: 'background.paper',
                      zIndex: 1
                    }}
                  >
                    <Box>
                      <Typography variant="body2">{entry.studentName}</Typography>
                      {entry.studentNumber && (
                        <Typography variant="caption" color="text.secondary">
                          {entry.studentNumber}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  {gradebook.assessments.map((assessment) => (
                    <TableCell key={assessment.id} align="center" sx={{ p: 0.5 }}>
                      <GradeCell
                        grade={entry.grades[assessment.id]}
                        totalPoints={assessment.totalPoints}
                      />
                    </TableCell>
                  ))}
                  <TableCell
                    align="center"
                    sx={{
                      position: 'sticky',
                      right: 0,
                      bgcolor: 'background.paper',
                      zIndex: 1
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: getAverageColor(entry.averagePercentage)
                      }}
                    >
                      {entry.averagePercentage !== null
                        ? `${entry.averagePercentage.toFixed(1)}%`
                        : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Summary stats */}
      {!loading && !error && gradebook && gradebook.entries.length > 0 && (
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {gradebook.entries.length} students | {gradebook.assessments.length} assessments
          </Typography>
          {gradebook.generatedAt && (
            <Typography variant="body2" color="text.secondary">
              Generated: {new Date(gradebook.generatedAt).toLocaleString()}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}
