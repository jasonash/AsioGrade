import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import FormControlLabel from '@mui/material/FormControlLabel'
import RadioGroup from '@mui/material/RadioGroup'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { MultipleChoiceQuestion, Choice, Standard } from '../../../../shared/types'

interface QuestionEditorProps {
  question?: MultipleChoiceQuestion
  questionNumber: number
  standards?: Standard[] // Available standards for alignment
  onSave: (question: MultipleChoiceQuestion) => void
  onCancel: () => void
  isNew?: boolean
}

interface FormData {
  text: string
  choices: Choice[]
  correctAnswer: string
  points: number
  standardRef: string
}

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f']

const createEmptyChoice = (id: string): Choice => ({
  id,
  text: '',
  isCorrect: false
})

export function QuestionEditor({
  question,
  questionNumber,
  standards = [],
  onSave,
  onCancel,
  isNew = false
}: QuestionEditorProps): ReactElement {
  const [formData, setFormData] = useState<FormData>(() => {
    if (question) {
      return {
        text: question.text,
        choices: question.choices,
        correctAnswer: question.correctAnswer,
        points: question.points,
        standardRef: question.standardRef ?? ''
      }
    }
    // Default: 4 empty choices
    return {
      text: '',
      choices: [
        createEmptyChoice('a'),
        createEmptyChoice('b'),
        createEmptyChoice('c'),
        createEmptyChoice('d')
      ],
      correctAnswer: 'a',
      points: 1,
      standardRef: ''
    }
  })

  const [errors, setErrors] = useState<{ text?: string; choices?: string }>({})

  // Update correct answer in choices when correctAnswer changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      choices: prev.choices.map((c) => ({
        ...c,
        isCorrect: c.id === prev.correctAnswer
      }))
    }))
  }, [formData.correctAnswer])

  const validate = (): boolean => {
    const newErrors: { text?: string; choices?: string } = {}

    if (!formData.text.trim()) {
      newErrors.text = 'Question text is required'
    }

    const filledChoices = formData.choices.filter((c) => c.text.trim())
    if (filledChoices.length < 2) {
      newErrors.choices = 'At least 2 answer choices are required'
    }

    // Check if correct answer is filled
    const correctChoice = formData.choices.find((c) => c.id === formData.correctAnswer)
    if (!correctChoice?.text.trim()) {
      newErrors.choices = 'The correct answer choice must have text'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = (): void => {
    if (!validate()) return

    // Filter out empty choices and update isCorrect
    const filledChoices = formData.choices
      .filter((c) => c.text.trim())
      .map((c) => ({
        ...c,
        isCorrect: c.id === formData.correctAnswer
      }))

    const savedQuestion: MultipleChoiceQuestion = {
      id: question?.id ?? `q-${Date.now().toString(36)}`,
      type: 'multiple_choice' as const,
      text: formData.text.trim(),
      choices: filledChoices,
      correctAnswer: formData.correctAnswer,
      points: formData.points,
      standardRef: formData.standardRef || undefined,
      createdAt: question?.createdAt ?? new Date().toISOString()
    }

    onSave(savedQuestion)
  }

  const handleChoiceChange = (id: string, text: string): void => {
    setFormData((prev) => ({
      ...prev,
      choices: prev.choices.map((c) => (c.id === id ? { ...c, text } : c))
    }))
    if (errors.choices) {
      setErrors((prev) => ({ ...prev, choices: undefined }))
    }
  }

  const handleAddChoice = (): void => {
    if (formData.choices.length >= 6) return

    const nextId = CHOICE_IDS[formData.choices.length]
    setFormData((prev) => ({
      ...prev,
      choices: [...prev.choices, createEmptyChoice(nextId)]
    }))
  }

  const handleRemoveChoice = (id: string): void => {
    if (formData.choices.length <= 2) return

    setFormData((prev) => {
      const newChoices = prev.choices.filter((c) => c.id !== id)
      // If we removed the correct answer, set the first choice as correct
      const newCorrectAnswer =
        prev.correctAnswer === id ? newChoices[0]?.id ?? 'a' : prev.correctAnswer

      return {
        ...prev,
        choices: newChoices,
        correctAnswer: newCorrectAnswer
      }
    })
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {isNew ? 'New Question' : `Question ${questionNumber}`}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Question text */}
        <TextField
          label="Question"
          value={formData.text}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, text: e.target.value }))
            if (errors.text) setErrors((prev) => ({ ...prev, text: undefined }))
          }}
          error={!!errors.text}
          helperText={errors.text}
          multiline
          rows={2}
          fullWidth
          autoFocus={isNew}
        />

        {/* Answer choices */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Answer Choices
          </Typography>
          {errors.choices && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {errors.choices}
            </Typography>
          )}

          <RadioGroup
            value={formData.correctAnswer}
            onChange={(e) => setFormData((prev) => ({ ...prev, correctAnswer: e.target.value }))}
          >
            {formData.choices.map((choice) => (
              <Box
                key={choice.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <FormControlLabel
                  value={choice.id}
                  control={<Radio size="small" />}
                  label=""
                  sx={{ mr: 0 }}
                />
                <Typography variant="body2" sx={{ minWidth: 20, fontWeight: 600 }}>
                  {choice.id.toUpperCase()}.
                </Typography>
                <TextField
                  value={choice.text}
                  onChange={(e) => handleChoiceChange(choice.id, e.target.value)}
                  placeholder={`Choice ${choice.id.toUpperCase()}`}
                  size="small"
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor:
                        formData.correctAnswer === choice.id ? 'success.main' : 'transparent',
                      '& input': {
                        color: formData.correctAnswer === choice.id ? 'white' : 'inherit'
                      }
                    }
                  }}
                />
                {formData.choices.length > 2 && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveChoice(choice.id)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}
          </RadioGroup>

          {formData.choices.length < 6 && (
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={handleAddChoice}
              sx={{ mt: 1 }}
            >
              Add Choice
            </Button>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Select the radio button next to the correct answer
          </Typography>
        </Box>

        {/* Points and Standard alignment */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Points"
            type="number"
            value={formData.points}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                points: Math.max(1, parseInt(e.target.value) || 1)
              }))
            }
            size="small"
            sx={{ width: 100 }}
            inputProps={{ min: 1 }}
          />

          {standards.length > 0 && (
            <TextField
              select
              label="Standard Alignment"
              value={formData.standardRef}
              onChange={(e) => setFormData((prev) => ({ ...prev, standardRef: e.target.value }))}
              size="small"
              sx={{ flex: 1 }}
            >
              <MenuItem value="">None</MenuItem>
              {standards.map((standard) => (
                <MenuItem key={standard.code} value={standard.code}>
                  {standard.code} - {standard.description.slice(0, 50)}...
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {isNew ? 'Add Question' : 'Save Question'}
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
