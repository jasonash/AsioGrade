import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { Modal } from '../ui'
import type { Section, SectionSummary, UpdateSectionInput } from '../../../../shared/types'
import type { ServiceResult } from '../../../../shared/types/common.types'

interface SectionEditModalProps {
  isOpen: boolean
  onClose: () => void
  section: SectionSummary
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

export function SectionEditModal({
  isOpen,
  onClose,
  section,
  onSuccess
}: SectionEditModalProps): ReactElement {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    schedule: '',
    room: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Reset form when modal opens or section changes
  useEffect(() => {
    if (isOpen && section) {
      setFormData({
        name: section.name,
        schedule: section.schedule ?? '',
        room: section.room ?? ''
      })
      setErrors({})
      setSubmitError(null)
    }
  }, [isOpen, section])

  const handleChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Clear error for this field when user starts typing
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
      // Clear submit error when user makes changes
      if (submitError) {
        setSubmitError(null)
      }
    },
    [errors, submitError]
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
      setSubmitError(null)

      const input: UpdateSectionInput = {
        id: section.id,
        name: formData.name.trim(),
        schedule: formData.schedule.trim() || undefined,
        room: formData.room.trim() || undefined
      }

      try {
        const result = await window.electronAPI.invoke<ServiceResult<Section>>(
          'drive:updateSection',
          input
        )

        if (result.success) {
          onSuccess?.(result.data)
          onClose()
        } else {
          setSubmitError(result.error)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update section'
        setSubmitError(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [formData, validate, section.id, onSuccess, onClose]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Section" size="sm">
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Submit error */}
        {submitError && (
          <Alert severity="error">{submitError}</Alert>
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
