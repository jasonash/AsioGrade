import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { Modal } from '../ui'
import { useAssessmentStore } from '../../stores'
import type { AssessmentType, AssessmentPurpose, Assessment } from '../../../../shared/types'

interface AssessmentCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (assessment: Assessment) => void
  courseId: string
  courseName: string
}

interface FormData {
  title: string
  type: AssessmentType
  purpose: AssessmentPurpose
  description: string
}

interface FormErrors {
  title?: string
}

const assessmentTypes: { value: AssessmentType; label: string }[] = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'test', label: 'Test' },
  { value: 'exam', label: 'Exam' },
  { value: 'benchmark', label: 'Benchmark' },
  { value: 'pretest', label: 'Pre-Test' },
  { value: 'exit_ticket', label: 'Exit Ticket' }
]

export function AssessmentCreationModal({
  isOpen,
  onClose,
  onSuccess,
  courseId,
  courseName
}: AssessmentCreationModalProps): ReactElement {
  const { createAssessment, error: storeError, clearError } = useAssessmentStore()

  const [formData, setFormData] = useState<FormData>({
    title: '',
    type: 'quiz',
    purpose: 'formative',
    description: ''
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        type: 'quiz',
        purpose: 'formative',
        description: ''
      })
      setErrors({})
      clearError()
    }
  }, [isOpen, clearError])

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return

    setIsSubmitting(true)

    const result = await createAssessment({
      courseId,
      title: formData.title.trim(),
      type: formData.type,
      purpose: formData.purpose,
      description: formData.description.trim() || undefined
    })

    setIsSubmitting(false)

    if (result) {
      onSuccess?.(result)
      onClose()
    }
  }

  const handleFieldChange = (field: keyof FormData, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Assessment" size="md">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Context info */}
        <Typography variant="body2" color="text.secondary">
          Creating assessment for course: <strong>{courseName}</strong>
        </Typography>

        {/* Error display */}
        {storeError && (
          <Alert severity="error" onClose={clearError}>
            {storeError}
          </Alert>
        )}

        {/* Title */}
        <TextField
          label="Assessment Title"
          value={formData.title}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          error={!!errors.title}
          helperText={errors.title}
          fullWidth
          autoFocus
          disabled={isSubmitting}
        />

        {/* Type */}
        <TextField
          select
          label="Assessment Type"
          value={formData.type}
          onChange={(e) => handleFieldChange('type', e.target.value)}
          fullWidth
          disabled={isSubmitting}
        >
          {assessmentTypes.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Purpose */}
        <FormControl component="fieldset" disabled={isSubmitting}>
          <FormLabel component="legend">Purpose</FormLabel>
          <RadioGroup
            row
            value={formData.purpose}
            onChange={(e) => handleFieldChange('purpose', e.target.value)}
          >
            <FormControlLabel
              value="formative"
              control={<Radio size="small" />}
              label="Formative (for learning)"
            />
            <FormControlLabel
              value="summative"
              control={<Radio size="small" />}
              label="Summative (for grading)"
            />
          </RadioGroup>
        </FormControl>

        {/* Description */}
        <TextField
          label="Description (optional)"
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          multiline
          rows={2}
          fullWidth
          disabled={isSubmitting}
        />

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title.trim()}
          >
            {isSubmitting ? 'Creating...' : 'Create Assessment'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
