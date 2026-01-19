import { type ReactElement, useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import type { Question, GradeRecord, Student } from '../../../../shared/types'

interface QuestionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  questionNumber: number
  question: Question | null
  gradeRecords: GradeRecord[]
  students: Student[]
}

interface StudentMissedInfo {
  student: Student | null
  studentId: string
  selectedAnswer: string | null
}

export function QuestionDetailModal({
  isOpen,
  onClose,
  questionNumber,
  question,
  gradeRecords,
  students
}: QuestionDetailModalProps): ReactElement {
  // Build student map for quick lookup
  const studentMap = useMemo(() => {
    return new Map(students.map((s) => [s.id, s]))
  }, [students])

  // Find students who missed this question
  const studentsMissed = useMemo((): StudentMissedInfo[] => {
    const missed: StudentMissedInfo[] = []

    for (const record of gradeRecords) {
      const answer = record.answers.find((a) => a.questionNumber === questionNumber)
      if (answer && !answer.correct) {
        missed.push({
          student: studentMap.get(record.studentId) || null,
          studentId: record.studentId,
          selectedAnswer: answer.selected as string | null
        })
      }
    }

    // Sort by last name
    return missed.sort((a, b) => {
      const nameA = a.student ? a.student.lastName : a.studentId
      const nameB = b.student ? b.student.lastName : b.studentId
      return nameA.localeCompare(nameB)
    })
  }, [gradeRecords, questionNumber, studentMap])

  // Get the correct answer letter
  const correctAnswerLetter = question?.correctAnswer?.toUpperCase() || '?'

  // Get correct choice text
  const correctChoiceText = useMemo(() => {
    if (!question) return null
    const correctChoice = question.choices.find((c) => c.isCorrect)
    return correctChoice?.text || null
  }, [question])

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={600}>
          Question {questionNumber} Details
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Question Text */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Question
          </Typography>
          <Typography variant="body1">
            {question?.text || 'Question text not available'}
          </Typography>
        </Box>

        {/* Answer Choices */}
        {question && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Answer Choices
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {question.choices.map((choice) => (
                <Box
                  key={choice.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: choice.isCorrect ? 'success.main' : 'background.paper',
                    color: choice.isCorrect ? 'success.contrastText' : 'text.primary',
                    border: 1,
                    borderColor: choice.isCorrect ? 'success.main' : 'divider'
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ minWidth: 24 }}
                  >
                    {choice.id.toUpperCase()}.
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {choice.text}
                  </Typography>
                  {choice.isCorrect && (
                    <CheckCircleIcon fontSize="small" />
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Explanation if available */}
        {question?.explanation && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Explanation
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              {question.explanation}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Students Who Missed */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Students Who Missed
            </Typography>
            <Chip
              label={studentsMissed.length}
              size="small"
              color={studentsMissed.length > 0 ? 'error' : 'success'}
            />
          </Box>

          {studentsMissed.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="body2" color="text.secondary">
                All students answered this question correctly!
              </Typography>
            </Box>
          ) : (
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {studentsMissed.map((info) => (
                <ListItem
                  key={info.studentId}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    mb: 0.5,
                    border: 1,
                    borderColor: 'divider'
                  }}
                >
                  <CancelIcon color="error" sx={{ mr: 1.5 }} fontSize="small" />
                  <ListItemText
                    primary={
                      info.student
                        ? `${info.student.lastName}, ${info.student.firstName}`
                        : info.studentId
                    }
                    secondary={
                      info.selectedAnswer
                        ? `Selected: ${info.selectedAnswer.toUpperCase()}`
                        : 'No answer'
                    }
                  />
                  {info.selectedAnswer && (
                    <Chip
                      label={info.selectedAnswer.toUpperCase()}
                      size="small"
                      color="error"
                      variant="outlined"
                    />
                  )}
                </ListItem>
              ))}
            </List>
          )}

          {/* Summary */}
          {studentsMissed.length > 0 && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Correct answer: <strong>{correctAnswerLetter}</strong>
                {correctChoiceText && ` - ${correctChoiceText}`}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
