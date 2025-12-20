import { type ReactElement, useState, useCallback, useEffect, useMemo } from 'react'
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
import type { Unit, UpdateUnitInput, StandardRef } from '../../../../shared/types'

interface UnitEditModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
  unit: Unit
  onSuccess?: () => void
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

export function UnitEditModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  unit,
  onSuccess
}: UnitEditModalProps): ReactElement {
  const { updateUnit, error: unitError, clearError: clearUnitError } = useUnitStore()
  const { allCollections, fetchAllCollections, loading: standardsLoading } = useStandardsStore()

  const [formData, setFormData] = useState<FormData>({
    name: unit.name,
    description: unit.description ?? '',
    estimatedDays: unit.estimatedDays?.toString() ?? '',
    selectedStandards: [...unit.standardRefs]
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens or unit changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: unit.name,
        description: unit.description ?? '',
        estimatedDays: unit.estimatedDays?.toString() ?? '',
        selectedStandards: [...unit.standardRefs]
      })
      setErrors({})
      clearUnitError()
      // Fetch all standards collections for this course
      fetchAllCollections(courseId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [isOpen, unit, courseId])

  // Get domain codes that have selected standards (for default expansion)
  const defaultExpandedDomains = useMemo(() => {
    const domains: string[] = []
    for (const collection of allCollections) {
      for (const domain of collection.domains) {
        const hasSelected = domain.standards.some((s) =>
          formData.selectedStandards.includes(s.code)
        )
        if (hasSelected) {
          domains.push(domain.code)
        }
      }
    }
    return domains
  }, [allCollections, formData.selectedStandards])

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

    const input: UpdateUnitInput = {
      id: unit.id,
      courseId,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays, 10) : undefined,
      standardRefs: formData.selectedStandards
    }

    const result = await updateUnit(input)

    setIsSubmitting(false)

    if (result) {
      onSuccess?.()
      onClose()
    }
  }, [validate, unit.id, courseId, formData, updateUnit, onSuccess, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Unit" size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Course context */}
        <Typography variant="body2" color="text.secondary">
          Editing unit in{' '}
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
            defaultExpandedDomains={defaultExpandedDomains}
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
