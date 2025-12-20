import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import { Modal } from '../ui'
import { StandardsSelector } from './StandardsSelector'
import { useUnitStore, useStandardsStore } from '../../stores'
import type { Unit, CreateUnitInput, StandardRef } from '../../../../shared/types'

interface UnitCreationModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
  onSuccess?: (unit: Unit) => void
}

interface FormData {
  name: string
  description: string
  estimatedDays: string
  selectedStandards: StandardRef[]
}

interface FormErrors {
  name?: string
}

export function UnitCreationModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  onSuccess
}: UnitCreationModalProps): ReactElement {
  const { createUnit, error: unitError, clearError: clearUnitError } = useUnitStore()
  const { allCollections, fetchAllCollections, loading: standardsLoading } = useStandardsStore()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    estimatedDays: '',
    selectedStandards: []
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form and fetch standards when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        estimatedDays: '',
        selectedStandards: []
      })
      setErrors({})
      clearUnitError()
      // Fetch all standards collections for this course
      fetchAllCollections(courseId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [isOpen, courseId])

  const handleChange = useCallback((field: keyof FormData, value: string | StandardRef[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when field changes
    if (field === 'name' && errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }))
    }
  }, [errors.name])

  const handleStandardToggle = useCallback((standardCode: string) => {
    setFormData((prev) => {
      const selected = prev.selectedStandards
      if (selected.includes(standardCode)) {
        return { ...prev, selectedStandards: selected.filter((s) => s !== standardCode) }
      } else {
        return { ...prev, selectedStandards: [...selected, standardCode] }
      }
    })
  }, [])

  const handleSelectAllInDomain = useCallback((domainStandardCodes: string[], isCurrentlyAllSelected: boolean) => {
    setFormData((prev) => {
      if (isCurrentlyAllSelected) {
        // Deselect all in this domain
        return {
          ...prev,
          selectedStandards: prev.selectedStandards.filter((s) => !domainStandardCodes.includes(s))
        }
      } else {
        // Select all in this domain
        const newSelected = new Set([...prev.selectedStandards, ...domainStandardCodes])
        return { ...prev, selectedStandards: Array.from(newSelected) }
      }
    })
  }, [])

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Unit name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Unit name must be at least 2 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData.name])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return

    setIsSubmitting(true)

    const input: CreateUnitInput = {
      courseId,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays, 10) : undefined,
      standardRefs: formData.selectedStandards.length > 0 ? formData.selectedStandards : undefined
    }

    const result = await createUnit(input)

    setIsSubmitting(false)

    if (result) {
      onSuccess?.(result)
      onClose()
    }
  }, [validate, courseId, formData, createUnit, onSuccess, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Unit" size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Course context */}
        <Typography variant="body2" color="text.secondary">
          Creating unit for{' '}
          <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {courseName}
          </Box>
        </Typography>

        {/* Error display */}
        {unitError && <Alert severity="error">{unitError}</Alert>}

        {/* Unit Name */}
        <TextField
          label="Unit Name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={!!errors.name}
          helperText={errors.name}
          required
          fullWidth
          autoFocus
          placeholder="e.g., Plate Tectonics, Cell Division"
        />

        {/* Description */}
        <TextField
          label="Description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          multiline
          rows={3}
          fullWidth
          placeholder="Brief description of what this unit covers..."
        />

        {/* Estimated Days */}
        <TextField
          label="Estimated Days"
          value={formData.estimatedDays}
          onChange={(e) => {
            // Only allow numbers
            const value = e.target.value.replace(/[^0-9]/g, '')
            handleChange('estimatedDays', value)
          }}
          type="text"
          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          fullWidth
          placeholder="e.g., 10"
          helperText="Approximate number of class days for this unit"
        />

        {/* Standards Selection */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Align to Standards
            {formData.selectedStandards.length > 0 && (
              <Chip
                label={`${formData.selectedStandards.length} selected`}
                size="small"
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>

          <StandardsSelector
            allCollections={allCollections}
            selectedStandards={formData.selectedStandards}
            loading={standardsLoading}
            onToggleStandard={handleStandardToggle}
            onSelectAllInDomain={handleSelectAllInDomain}
          />
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Creating...' : 'Create Unit'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
