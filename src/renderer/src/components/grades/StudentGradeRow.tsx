import { type ReactElement, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Collapse from '@mui/material/Collapse'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import type { GradeRecord, Student, GradeOverride } from '../../../../shared/types'

interface StudentGradeRowProps {
  record: GradeRecord
  student: Student | undefined
  onOverride: (override: GradeOverride) => void
  pendingOverrides: GradeOverride[]
}

export function StudentGradeRow({
  record,
  student,
  onOverride,
  pendingOverrides
}: StudentGradeRowProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)

  const studentName = student
    ? `${student.lastName}, ${student.firstName}`
    : `Unknown (${record.studentId})`

  const handleOverrideChange = useCallback(
    (questionNumber: number, newAnswer: string | null) => {
      onOverride({
        recordId: record.id,
        questionNumber,
        newAnswer,
        reason: 'Manual correction'
      })
    },
    [record.id, onOverride]
  )

  const getOverriddenAnswer = useCallback(
    (questionNumber: number): string | null | undefined => {
      const override = pendingOverrides.find(
        (o) => o.recordId === record.id && o.questionNumber === questionNumber
      )
      return override?.newAnswer
    },
    [record.id, pendingOverrides]
  )

  return (
    <Box
      sx={{
        border: 1,
        borderColor: record.needsReview ? 'warning.main' : 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: record.needsReview ? 'warning.light' : 'transparent',
        mb: 1
      }}
    >
      {/* Header Row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' }
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <IconButton size="small" sx={{ mr: 1 }}>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>

        {/* Student Name */}
        <Typography sx={{ flex: 1, fontWeight: 500 }}>{studentName}</Typography>

        {/* Score */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {record.needsReview && (
            <Chip
              icon={<WarningIcon />}
              label="Review"
              size="small"
              color="warning"
            />
          )}

          <Typography variant="body2" color="text.secondary">
            {record.rawScore} / {record.totalQuestions}
          </Typography>

          <Typography
            variant="h6"
            sx={{
              minWidth: 60,
              textAlign: 'right',
              color:
                record.percentage >= 70
                  ? 'success.main'
                  : record.percentage >= 50
                    ? 'warning.main'
                    : 'error.main'
            }}
          >
            {record.percentage.toFixed(0)}%
          </Typography>
        </Box>
      </Box>

      {/* Expanded Details */}
      <Collapse in={isExpanded}>
        <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
          {/* Flags */}
          {record.flags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Flags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {record.flags.map((flag, index) => (
                  <Chip
                    key={index}
                    label={
                      flag.questionNumber
                        ? `Q${flag.questionNumber}: ${flag.type.replace(/_/g, ' ')}`
                        : flag.type.replace(/_/g, ' ')
                    }
                    size="small"
                    color={flag.type === 'qr_error' || flag.type === 'student_not_found' ? 'error' : 'warning'}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Answer Grid */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Answers
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 1
            }}
          >
            {record.answers.map((answer) => {
              const overriddenAnswer = getOverriddenAnswer(answer.questionNumber)
              const displayedAnswer = overriddenAnswer !== undefined ? overriddenAnswer : answer.selected
              const isOverridden = overriddenAnswer !== undefined
              const needsAttention = answer.multipleSelected || answer.unclear || answer.selected === null

              return (
                <Box
                  key={answer.questionNumber}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor: needsAttention ? 'warning.light' : 'action.hover'
                  }}
                >
                  {/* Question Number */}
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 24, fontWeight: 500 }}
                  >
                    {answer.questionNumber}.
                  </Typography>

                  {/* Answer Selector */}
                  <Select
                    value={displayedAnswer || ''}
                    onChange={(e) => {
                      const value = e.target.value as string
                      handleOverrideChange(
                        answer.questionNumber,
                        value || null
                      )
                    }}
                    size="small"
                    sx={{
                      minWidth: 60,
                      '& .MuiSelect-select': { py: 0.5 },
                      bgcolor: isOverridden ? 'info.light' : undefined
                    }}
                  >
                    <MenuItem value="">-</MenuItem>
                    <MenuItem value="A">A</MenuItem>
                    <MenuItem value="B">B</MenuItem>
                    <MenuItem value="C">C</MenuItem>
                    <MenuItem value="D">D</MenuItem>
                  </Select>

                  {/* Correct/Incorrect Icon */}
                  {answer.correct ? (
                    <CheckCircleIcon fontSize="small" color="success" />
                  ) : (
                    <CancelIcon fontSize="small" color="error" />
                  )}

                  {/* Confidence */}
                  {answer.confidence < 0.7 && (
                    <Typography variant="caption" color="warning.main">
                      {(answer.confidence * 100).toFixed(0)}%
                    </Typography>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}
