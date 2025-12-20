import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { Modal } from '../ui'
import { useStandardsStore } from '../../stores'
import type { StandardDomain } from '../../../../shared/types'

interface DomainFormModalProps {
  isOpen: boolean
  onClose: () => void
  domain?: StandardDomain // If provided, we're in edit mode
  onSuccess?: () => void
}

interface FormData {
  code: string
  name: string
  description: string
}

interface FormErrors {
  code?: string
  name?: string
}

export function DomainFormModal({
  isOpen,
  onClose,
  domain,
  onSuccess
}: DomainFormModalProps): ReactElement {
  const { addDomain, updateDomain, error: storeError, clearError } = useStandardsStore()
  const isEditMode = !!domain

  const [formData, setFormData] = useState<FormData>({
    code: '',
    name: '',
    description: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens or domain changes
  useEffect(() => {
    if (isOpen) {
      if (domain) {
        setFormData({
          code: domain.code,
          name: domain.name,
          description: domain.description ?? ''
        })
      } else {
        setFormData({
          code: '',
          name: '',
          description: ''
        })
      }
      setErrors({})
      clearError()
    }
  }, [isOpen, domain, clearError])

  const handleChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    [errors]
  )

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.code.trim()) {
      newErrors.code = 'Code is required'
    } else if (!/^[A-Za-z0-9._-]+$/.test(formData.code.trim())) {
      newErrors.code = 'Code can only contain letters, numbers, dots, dashes, and underscores'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validate()) return

      setIsSubmitting(true)

      let success = false

      if (isEditMode && domain) {
        success = await updateDomain(domain.code, {
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        })
      } else {
        success = await addDomain({
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        })
      }

      setIsSubmitting(false)

      if (success) {
        onSuccess?.()
        onClose()
      }
    },
    [formData, validate, isEditMode, domain, addDomain, updateDomain, onSuccess, onClose]
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Domain' : 'Add Domain'}
      size="sm"
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {storeError && (
          <Alert severity="error">{storeError}</Alert>
        )}

        {/* Code */}
        <TextField
          label="Domain Code"
          required
          value={formData.code}
          onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
          placeholder="e.g., MS-ESS2"
          error={!!errors.code}
          helperText={errors.code || 'Unique identifier for this domain'}
          disabled={isSubmitting}
          size="small"
          fullWidth
          autoFocus
        />

        {/* Name */}
        <TextField
          label="Domain Name"
          required
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Earth's Systems"
          error={!!errors.name}
          helperText={errors.name}
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Description */}
        <TextField
          label="Description (optional)"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Brief description of this domain..."
          multiline
          rows={2}
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
            {isSubmitting
              ? isEditMode
                ? 'Saving...'
                : 'Adding...'
              : isEditMode
                ? 'Save Changes'
                : 'Add Domain'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
