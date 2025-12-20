import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { Modal } from '../ui'
import { useCourseStore } from '../../stores'
import type { Course, CreateCourseInput } from '../../../../shared/types'

interface CourseCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (course: Course) => void
}

const GRADE_LEVELS = [
  { value: 'K', label: 'Kindergarten' },
  { value: 'K-2', label: 'K-2 (Early Elementary)' },
  { value: '3-5', label: '3-5 (Upper Elementary)' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '6-8', label: '6-8 (Middle School)' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
  { value: '9-12', label: '9-12 (High School)' }
]

function getAcademicYearOptions(): { value: string; label: string }[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // Current academic year
  const currentYear = month >= 6 ? year : year - 1
  const nextYear = currentYear + 1

  return [
    { value: `${currentYear}-${nextYear}`, label: `${currentYear}-${nextYear}` },
    { value: `${nextYear}-${nextYear + 1}`, label: `${nextYear}-${nextYear + 1}` }
  ]
}

interface FormData {
  name: string
  subject: string
  gradeLevel: string
  academicYear: string
  description: string
}

interface FormErrors {
  name?: string
  subject?: string
  gradeLevel?: string
}

export function CourseCreationModal({
  isOpen,
  onClose,
  onSuccess
}: CourseCreationModalProps): ReactElement {
  const { academicYear, createCourse, error: storeError, clearError } = useCourseStore()

  const academicYearOptions = getAcademicYearOptions()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    subject: '',
    gradeLevel: '',
    academicYear: academicYear,
    description: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        subject: '',
        gradeLevel: '',
        academicYear: academicYear,
        description: ''
      })
      setErrors({})
      clearError()
    }
  }, [isOpen, academicYear, clearError])

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }, [errors])

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Course name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Course name must be at least 2 characters'
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Course name must be less than 100 characters'
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required'
    } else if (formData.subject.trim().length < 2) {
      newErrors.subject = 'Subject must be at least 2 characters'
    }

    if (!formData.gradeLevel) {
      newErrors.gradeLevel = 'Grade level is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validate()) return

      setIsSubmitting(true)

      const input: CreateCourseInput = {
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        gradeLevel: formData.gradeLevel,
        academicYear: formData.academicYear,
        description: formData.description.trim() || undefined
      }

      const course = await createCourse(input)

      setIsSubmitting(false)

      if (course) {
        onSuccess?.(course)
        onClose()
      }
    },
    [formData, validate, createCourse, onSuccess, onClose]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Course" size="md">
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Store error */}
        {storeError && (
          <Alert severity="error">{storeError}</Alert>
        )}

        {/* Course Name */}
        <TextField
          label="Course Name"
          required
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Earth Science, AP Chemistry"
          error={!!errors.name}
          helperText={errors.name}
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Subject */}
        <TextField
          label="Subject"
          required
          value={formData.subject}
          onChange={(e) => handleChange('subject', e.target.value)}
          placeholder="e.g., Science, Math, English"
          error={!!errors.subject}
          helperText={errors.subject}
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Grade Level */}
        <TextField
          select
          label="Grade Level"
          required
          value={formData.gradeLevel}
          onChange={(e) => handleChange('gradeLevel', e.target.value)}
          error={!!errors.gradeLevel}
          helperText={errors.gradeLevel}
          disabled={isSubmitting}
          size="small"
          fullWidth
        >
          {GRADE_LEVELS.map((grade) => (
            <MenuItem key={grade.value} value={grade.value}>
              {grade.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Academic Year */}
        <TextField
          select
          label="Academic Year"
          value={formData.academicYear}
          onChange={(e) => handleChange('academicYear', e.target.value)}
          disabled={isSubmitting}
          size="small"
          fullWidth
        >
          {academicYearOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Description */}
        <TextField
          label="Description (optional)"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Brief description of this course..."
          multiline
          rows={3}
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Creating...' : 'Create Course'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
