import { type ReactElement, useState, useMemo, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import CloseIcon from '@mui/icons-material/Close'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { QuestionDetailModal } from './QuestionDetailModal'
import type {
  Assessment,
  Question,
  GradeStats,
  GradeRecord,
  Student,
  ServiceResult
} from '../../../../shared/types'

interface QuestionStatsModalProps {
  isOpen: boolean
  onClose: () => void
  assessmentId: string
  gradeStats: GradeStats
  gradeRecords: GradeRecord[]
  students: Student[]
}

interface QuestionStatRow {
  questionNumber: number
  questionId: string
  question: Question | null
  percentMissed: number
  missedCount: number
  totalCount: number
}

export function QuestionStatsModal({
  isOpen,
  onClose,
  assessmentId,
  gradeStats,
  gradeRecords,
  students
}: QuestionStatsModalProps): ReactElement {
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionStatRow | null>(null)

  // Fetch assessment when modal opens
  useEffect(() => {
    if (isOpen && assessmentId && !assessment) {
      setLoading(true)
      setError(null)
      window.electronAPI
        .invoke<ServiceResult<Assessment>>('drive:getAssessment', assessmentId)
        .then((result) => {
          if (result.success) {
            setAssessment(result.data)
          } else {
            setError(result.error)
          }
        })
        .catch((err: Error) => {
          setError(err.message || 'Failed to load assessment')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, assessmentId, assessment])

  // Build question stats rows
  const questionStats = useMemo((): QuestionStatRow[] => {
    if (!gradeStats.byQuestion || gradeRecords.length === 0) return []

    // Get unique question IDs from grade records (preserves order)
    const questionIds: string[] = []
    if (gradeRecords[0]?.answers) {
      gradeRecords[0].answers.forEach((answer) => {
        if (!questionIds.includes(answer.questionId)) {
          questionIds.push(answer.questionId)
        }
      })
    }

    return questionIds.map((questionId, index) => {
      const stats = gradeStats.byQuestion[questionId]
      const question = assessment?.questions.find((q) => q.id === questionId) || null

      const totalCount = stats ? stats.correctCount + stats.incorrectCount + stats.skippedCount : 0
      const missedCount = stats ? stats.incorrectCount + stats.skippedCount : 0
      const percentMissed = totalCount > 0 ? (missedCount / totalCount) * 100 : 0

      return {
        questionNumber: index + 1,
        questionId,
        question,
        percentMissed,
        missedCount,
        totalCount
      }
    })
  }, [gradeStats.byQuestion, gradeRecords, assessment])

  // Sort by percent missed (highest first)
  const sortedStats = useMemo(() => {
    return [...questionStats].sort((a, b) => b.percentMissed - a.percentMissed)
  }, [questionStats])

  // Get color based on percent missed
  const getMissedColor = (percent: number): string => {
    if (percent >= 50) return 'error.main'
    if (percent >= 30) return 'warning.main'
    if (percent >= 15) return 'info.main'
    return 'success.main'
  }

  const handleOpenDetail = (row: QuestionStatRow): void => {
    setSelectedQuestion(row)
  }

  const handleCloseDetail = (): void => {
    setSelectedQuestion(null)
  }

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>
            Question Statistics
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!loading && !error && sortedStats.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No question statistics available</Typography>
            </Box>
          )}

          {!loading && !error && sortedStats.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Questions sorted by percentage of students who missed them (highest first)
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Question</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">
                        Missed
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">
                        Count
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Details
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedStats.map((row) => (
                      <TableRow
                        key={row.questionId}
                        sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            Q{row.questionNumber}
                          </Typography>
                          {row.question && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                maxWidth: 350,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {row.question.text}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ color: getMissedColor(row.percentMissed) }}
                          >
                            {row.percentMissed.toFixed(0)}%
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color="text.secondary">
                            {row.missedCount} / {row.totalCount}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<InfoOutlinedIcon />}
                            onClick={() => handleOpenDetail(row)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Question Detail Modal */}
      {selectedQuestion && (
        <QuestionDetailModal
          isOpen={!!selectedQuestion}
          onClose={handleCloseDetail}
          questionNumber={selectedQuestion.questionNumber}
          question={selectedQuestion.question}
          gradeRecords={gradeRecords}
          students={students}
        />
      )}
    </>
  )
}
