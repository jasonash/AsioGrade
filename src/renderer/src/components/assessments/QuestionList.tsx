import { type ReactElement, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { QuestionEditor } from './QuestionEditor'
import type { MultipleChoiceQuestion, Standard } from '../../../../shared/types'

interface QuestionListProps {
  questions: MultipleChoiceQuestion[]
  standards?: Standard[]
  onQuestionsChange: (questions: MultipleChoiceQuestion[]) => void
  readOnly?: boolean
  variantEditMode?: boolean // Allow editing individual questions without add/delete
  onVariantQuestionEdit?: (question: MultipleChoiceQuestion) => void
}

export function QuestionList({
  questions,
  standards = [],
  onQuestionsChange,
  readOnly = false,
  variantEditMode = false,
  onVariantQuestionEdit
}: QuestionListProps): ReactElement {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)

  // In variant edit mode, we can edit but not add/delete
  const canEdit = !readOnly || variantEditMode
  const canAddDelete = !readOnly && !variantEditMode

  const handleSaveQuestion = (savedQuestion: MultipleChoiceQuestion): void => {
    if (isAddingNew) {
      onQuestionsChange([...questions, savedQuestion])
      setIsAddingNew(false)
    } else if (variantEditMode && onVariantQuestionEdit) {
      // In variant mode, use the special callback
      onVariantQuestionEdit(savedQuestion)
      setEditingQuestionId(null)
    } else {
      onQuestionsChange(
        questions.map((q) => (q.id === savedQuestion.id ? savedQuestion : q))
      )
      setEditingQuestionId(null)
    }
  }

  const handleDeleteQuestion = (questionId: string): void => {
    onQuestionsChange(questions.filter((q) => q.id !== questionId))
  }

  const handleCancelEdit = (): void => {
    setEditingQuestionId(null)
    setIsAddingNew(false)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Question list */}
      {questions.length === 0 && !isAddingNew && (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            bgcolor: 'action.hover'
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: 'rgba(229, 168, 13, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2
            }}
          >
            <HelpOutlineIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No questions yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add your first question to get started
          </Typography>
          {canAddDelete && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsAddingNew(true)}
            >
              Add Question
            </Button>
          )}
        </Paper>
      )}

      {questions.map((question, index) => (
        <Box key={question.id}>
          {editingQuestionId === question.id ? (
            <QuestionEditor
              question={question}
              questionNumber={index + 1}
              standards={standards}
              onSave={handleSaveQuestion}
              onCancel={handleCancelEdit}
            />
          ) : (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                '&:hover .question-actions': {
                  opacity: 1
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                {/* Question number */}
                <Box
                  sx={{
                    minWidth: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}
                >
                  {index + 1}
                </Box>

                {/* Question content */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ mb: 1.5 }}>
                    {question.text}
                  </Typography>

                  {/* Choices */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                    {question.choices.map((choice, choiceIndex) => (
                      <Box
                        key={choice.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 0.5,
                          px: 1,
                          borderRadius: 1,
                          bgcolor: choice.isCorrect ? 'success.main' : 'transparent',
                          color: choice.isCorrect ? 'white' : 'inherit'
                        }}
                      >
                        {choice.isCorrect && (
                          <CheckCircleIcon sx={{ fontSize: 16 }} />
                        )}
                        <Typography variant="body2" fontWeight={500}>
                          {String.fromCharCode(65 + choiceIndex)}.
                        </Typography>
                        <Typography variant="body2">{choice.text}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Meta info */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${question.points} pt${question.points !== 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                    />
                    {question.standardRef && (
                      <Chip
                        label={question.standardRef}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>

                {/* Actions */}
                {canEdit && (
                  <Box
                    className="question-actions"
                    sx={{
                      display: 'flex',
                      gap: 0.5,
                      opacity: 0,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => setEditingQuestionId(question.id)}
                      title="Edit question"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {canAddDelete && (
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteQuestion(question.id)}
                        title="Delete question"
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>
          )}
        </Box>
      ))}

      {/* Add new question */}
      <Collapse in={isAddingNew}>
        <QuestionEditor
          questionNumber={questions.length + 1}
          standards={standards}
          onSave={handleSaveQuestion}
          onCancel={handleCancelEdit}
          isNew
        />
      </Collapse>

      {/* Add button (when not adding and has questions) */}
      {!isAddingNew && !editingQuestionId && questions.length > 0 && canAddDelete && (
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setIsAddingNew(true)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Add Question
        </Button>
      )}
    </Box>
  )
}
