import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { Modal } from '../ui'
import { useStandardsStore } from '../../stores'
import type { Standard } from '../../../../shared/types'

interface StandardFormModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  domainCode: string
  domainName: string
  standard?: Standard // If provided, we're in edit mode
  onSuccess?: () => void
}

interface FormData {
  code: string
  description: string
  keywords: string
}

interface FormErrors {
  code?: string
  description?: string
}

export function StandardFormModal({
  isOpen,
  onClose,
  courseId,
  domainCode,
  domainName,
  standard,
  onSuccess
}: StandardFormModalProps): ReactElement {
  const { addStandard, updateStandard, error: storeError, clearError } = useStandardsStore()
  const isEditMode = !!standard

  const [formData, setFormData] = useState<FormData>({
    code: '',
    description: '',
    keywords: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens or standard changes
  useEffect(() => {
    if (isOpen) {
      if (standard) {
        setFormData({
          code: standard.code,
          description: standard.description,
          keywords: standard.keywords?.join(', ') ?? ''
        })
      } else {
        // Pre-fill code with domain code prefix
        setFormData({
          code: domainCode + '-',
          description: '',
          keywords: ''
        })
      }
      setErrors({})
      clearError()
    }
  }, [isOpen, standard, domainCode, clearError])

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

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const parseKeywords = (keywordsString: string): string[] => {
    return keywordsString
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0)
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validate()) return

      setIsSubmitting(true)

      const keywords = parseKeywords(formData.keywords)
      let success = false

      if (isEditMode && standard) {
        success = await updateStandard(courseId, domainCode, standard.code, {
          code: formData.code.trim(),
          description: formData.description.trim(),
          keywords: keywords.length > 0 ? keywords : undefined
        })
      } else {
        success = await addStandard(courseId, domainCode, {
          code: formData.code.trim(),
          description: formData.description.trim(),
          keywords: keywords.length > 0 ? keywords : undefined
        })
      }

      setIsSubmitting(false)

      if (success) {
        onSuccess?.()
        onClose()
      }
    },
    [formData, validate, isEditMode, standard, courseId, domainCode, addStandard, updateStandard, onSuccess, onClose]
  )

  // Preview keywords
  const previewKeywords = parseKeywords(formData.keywords)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Standard' : 'Add Standard'}
      size="md"
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Domain context */}
        <Typography variant="body2" color="text.secondary">
          {isEditMode ? 'Editing standard in' : 'Adding standard to'}{' '}
          <Chip label={domainCode} size="small" color="primary" sx={{ mx: 0.5 }} />
          {domainName}
        </Typography>

        {storeError && (
          <Alert severity="error">{storeError}</Alert>
        )}

        {/* Code */}
        <TextField
          label="Standard Code"
          required
          value={formData.code}
          onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
          placeholder={`e.g., ${domainCode}-1`}
          error={!!errors.code}
          helperText={errors.code || 'Unique identifier for this standard'}
          disabled={isSubmitting}
          size="small"
          fullWidth
          autoFocus
        />

        {/* Description */}
        <TextField
          label="Standard Description"
          required
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe what students should be able to do..."
          error={!!errors.description}
          helperText={errors.description}
          multiline
          rows={4}
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Keywords */}
        <Box>
          <TextField
            label="Keywords (optional)"
            value={formData.keywords}
            onChange={(e) => handleChange('keywords', e.target.value)}
            placeholder="energy, matter, systems, models"
            helperText="Comma-separated keywords for search and topic matching"
            disabled={isSubmitting}
            size="small"
            fullWidth
          />
          {previewKeywords.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {previewKeywords.slice(0, 10).map((keyword) => (
                <Chip key={keyword} label={keyword} size="small" variant="outlined" />
              ))}
              {previewKeywords.length > 10 && (
                <Chip label={`+${previewKeywords.length - 10} more`} size="small" variant="outlined" />
              )}
            </Box>
          )}
        </Box>

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
                : 'Add Standard'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
