import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import InputAdornment from '@mui/material/InputAdornment'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { Modal } from '../ui'
import { useLessonStore } from '../../stores/lesson.store'
import type { Lesson } from '../../../../shared/types'

interface LessonCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (lesson: Lesson) => void
  courseId: string
  unitId: string
  unitName: string
}

interface FormData {
  title: string
  estimatedMinutes: number
  description: string
}

interface FormErrors {
  title?: string
  estimatedMinutes?: string
}

const durationMarks = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '60m' },
  { value: 90, label: '90m' }
]

export function LessonCreationModal({
  isOpen,
  onClose,
  onSuccess,
  courseId,
  unitId,
  unitName
}: LessonCreationModalProps): ReactElement {
  const { createLesson, error: storeError, clearError } = useLessonStore()

  const [formData, setFormData] = useState<FormData>({
    title: '',
    estimatedMinutes: 50,
    description: ''
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        estimatedMinutes: 50,
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

    if (formData.estimatedMinutes < 5) {
      newErrors.estimatedMinutes = 'Lesson must be at least 5 minutes'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return

    setIsSubmitting(true)

    const result = await createLesson({
      courseId,
      unitId,
      title: formData.title.trim(),
      estimatedMinutes: formData.estimatedMinutes,
      description: formData.description.trim() || undefined
    })

    setIsSubmitting(false)

    if (result) {
      onSuccess?.(result)
      onClose()
    }
  }

  const handleFieldChange = (field: keyof FormData, value: string | number): void => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Lesson" size="md">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Context info */}
        <Typography variant="body2" color="text.secondary">
          Creating lesson in unit: <strong>{unitName}</strong>
        </Typography>

        {/* Error display */}
        {storeError && (
          <Alert severity="error" onClose={clearError}>
            {storeError}
          </Alert>
        )}

        {/* Title */}
        <TextField
          label="Lesson Title"
          value={formData.title}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          error={!!errors.title}
          helperText={errors.title}
          fullWidth
          autoFocus
          disabled={isSubmitting}
          placeholder="e.g., Introduction to Plate Tectonics"
        />

        {/* Duration */}
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Estimated Duration
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1, px: 1 }}>
              <Slider
                value={formData.estimatedMinutes}
                onChange={(_e, value) => handleFieldChange('estimatedMinutes', value as number)}
                min={5}
                max={120}
                step={5}
                marks={durationMarks}
                disabled={isSubmitting}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value} min`}
              />
            </Box>
            <TextField
              value={formData.estimatedMinutes}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0
                handleFieldChange('estimatedMinutes', Math.min(120, Math.max(5, value)))
              }}
              type="number"
              size="small"
              sx={{ width: 100 }}
              disabled={isSubmitting}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </InputAdornment>
                )
              }}
              inputProps={{ min: 5, max: 120 }}
            />
          </Box>
          {errors.estimatedMinutes && (
            <Typography variant="caption" color="error">
              {errors.estimatedMinutes}
            </Typography>
          )}
        </Box>

        {/* Description */}
        <TextField
          label="Description (optional)"
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          multiline
          rows={2}
          fullWidth
          disabled={isSubmitting}
          placeholder="Brief overview of what students will learn..."
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
            {isSubmitting ? 'Creating...' : 'Create Lesson'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
