import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { Modal } from '../ui'
import { useSectionStore } from '../../stores'
import type { Section, CreateSectionInput } from '../../../../shared/types'

interface SectionCreationModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
  onSuccess?: (section: Section) => void
}

interface FormData {
  name: string
  schedule: string
  room: string
}

interface FormErrors {
  name?: string
}

export function SectionCreationModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  onSuccess
}: SectionCreationModalProps): ReactElement {
  const { createSection, error: storeError, clearError } = useSectionStore()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    schedule: '',
    room: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        schedule: '',
        room: ''
      })
      setErrors({})
      clearError()
    }
  }, [isOpen, clearError])

  const handleChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Clear error for this field when user starts typing
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    [errors]
  )

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Section name is required'
    } else if (formData.name.trim().length < 1) {
      newErrors.name = 'Section name must be at least 1 character'
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Section name must be less than 50 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validate()) return

      setIsSubmitting(true)

      const input: CreateSectionInput = {
        courseId,
        name: formData.name.trim(),
        schedule: formData.schedule.trim() || undefined,
        room: formData.room.trim() || undefined
      }

      const section = await createSection(input)

      setIsSubmitting(false)

      if (section) {
        onSuccess?.(section)
        onClose()
      }
    },
    [formData, validate, createSection, courseId, onSuccess, onClose]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Section" size="sm">
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Course context */}
        <Typography variant="body2" color="text.secondary">
          Adding section to <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{courseName}</Box>
        </Typography>

        {/* Store error */}
        {storeError && (
          <Alert severity="error">{storeError}</Alert>
        )}

        {/* Section Name */}
        <Box>
          <TextField
            label="Section Name"
            required
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Period 1, Block A, 3rd Hour"
            error={!!errors.name}
            helperText={errors.name || "Use whatever naming works for your school (Period, Block, Hour, etc.)"}
            disabled={isSubmitting}
            size="small"
            fullWidth
            autoFocus
          />
        </Box>

        {/* Schedule */}
        <TextField
          label="Schedule (optional)"
          value={formData.schedule}
          onChange={(e) => handleChange('schedule', e.target.value)}
          placeholder="e.g., MWF 8:00-8:50am"
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Room */}
        <TextField
          label="Room (optional)"
          value={formData.room}
          onChange={(e) => handleChange('room', e.target.value)}
          placeholder="e.g., Room 204, Lab B"
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
            {isSubmitting ? 'Adding...' : 'Add Section'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
