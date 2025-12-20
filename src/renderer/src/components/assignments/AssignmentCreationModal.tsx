import { type ReactElement, useState, useCallback, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { Modal } from '../ui'
import { useAssignmentStore, useUnitStore } from '../../stores'
import type { Assignment, CreateAssignmentInput, AssessmentSummary } from '../../../../shared/types'
import type { ServiceResult } from '../../../../shared/types/common.types'

interface AssignmentCreationModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  courseId: string
  onSuccess?: (assignment: Assignment) => void
}

interface FormData {
  assessmentId: string
  assignedDate: string
  dueDate: string
}

interface FormErrors {
  assessmentId?: string
  dueDate?: string
}

export function AssignmentCreationModal({
  isOpen,
  onClose,
  sectionId,
  courseId,
  onSuccess
}: AssignmentCreationModalProps): ReactElement {
  const { createAssignment, error: storeError, clearError } = useAssignmentStore()
  const { units, fetchUnits } = useUnitStore()

  const [formData, setFormData] = useState<FormData>({
    assessmentId: '',
    assignedDate: new Date().toISOString().split('T')[0],
    dueDate: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [publishedAssessments, setPublishedAssessments] = useState<AssessmentSummary[]>([])
  const [loadingAssessments, setLoadingAssessments] = useState(false)

  // Load published assessments when modal opens
  useEffect(() => {
    if (isOpen && courseId) {
      const loadAssessments = async (): Promise<void> => {
        setLoadingAssessments(true)

        // First, fetch units if not already loaded
        await fetchUnits(courseId)
      }

      loadAssessments()
    }
  }, [isOpen, courseId, fetchUnits])

  // When units are loaded, fetch assessments from each unit
  useEffect(() => {
    if (isOpen && units.length > 0) {
      const fetchAllAssessments = async (): Promise<void> => {
        const allAssessments: AssessmentSummary[] = []

        for (const unit of units) {
          try {
            const result = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
              'drive:listAssessments',
              unit.id
            )

            if (result.success) {
              // Filter to only published assessments
              const published = result.data.filter((a) => a.status === 'published')
              allAssessments.push(...published)
            }
          } catch {
            // Skip units with errors
          }
        }

        setPublishedAssessments(allAssessments)
        setLoadingAssessments(false)
      }

      fetchAllAssessments()
    }
  }, [isOpen, units])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        assessmentId: '',
        assignedDate: new Date().toISOString().split('T')[0],
        dueDate: ''
      })
      setErrors({})
      clearError()
    }
  }, [isOpen, clearError])

  // Get selected assessment info
  const selectedAssessment = useMemo(() => {
    return publishedAssessments.find((a) => a.id === formData.assessmentId)
  }, [publishedAssessments, formData.assessmentId])

  const handleChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Clear error for this field when user changes value
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    [errors]
  )

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.assessmentId) {
      newErrors.assessmentId = 'Please select an assessment'
    }

    // Validate due date is after assigned date if both are set
    if (formData.dueDate && formData.assignedDate) {
      const assignedDate = new Date(formData.assignedDate)
      const dueDate = new Date(formData.dueDate)
      if (dueDate < assignedDate) {
        newErrors.dueDate = 'Due date must be after assigned date'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validate()) return

      setIsSubmitting(true)

      const input: CreateAssignmentInput = {
        sectionId,
        assessmentId: formData.assessmentId,
        assignedDate: formData.assignedDate || undefined,
        dueDate: formData.dueDate || undefined
      }

      const assignment = await createAssignment(input)

      setIsSubmitting(false)

      if (assignment) {
        onSuccess?.(assignment)
        onClose()
      }
    },
    [formData, sectionId, validate, createAssignment, onSuccess, onClose]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Assessment" size="md">
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        {/* Store error */}
        {storeError && <Alert severity="error">{storeError}</Alert>}

        {/* Assessment Selection */}
        <TextField
          select
          label="Assessment"
          required
          value={formData.assessmentId}
          onChange={(e) => handleChange('assessmentId', e.target.value)}
          error={!!errors.assessmentId}
          helperText={
            errors.assessmentId ||
            (loadingAssessments
              ? 'Loading assessments...'
              : publishedAssessments.length === 0
                ? 'No published assessments available'
                : 'Select a published assessment')
          }
          disabled={isSubmitting || loadingAssessments || publishedAssessments.length === 0}
          size="small"
          fullWidth
        >
          {publishedAssessments.map((assessment) => (
            <MenuItem key={assessment.id} value={assessment.id}>
              {assessment.title}
            </MenuItem>
          ))}
        </TextField>

        {/* Show selected assessment info */}
        {selectedAssessment && (
          <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedAssessment.questionCount} questions | {selectedAssessment.totalPoints} points
              | {selectedAssessment.purpose === 'formative' ? 'Formative' : 'Summative'}
            </Typography>
          </Box>
        )}

        {/* Assigned Date */}
        <TextField
          type="date"
          label="Assigned Date"
          value={formData.assignedDate}
          onChange={(e) => handleChange('assignedDate', e.target.value)}
          disabled={isSubmitting}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        {/* Due Date */}
        <TextField
          type="date"
          label="Due Date (optional)"
          value={formData.dueDate}
          onChange={(e) => handleChange('dueDate', e.target.value)}
          error={!!errors.dueDate}
          helperText={errors.dueDate}
          disabled={isSubmitting}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || publishedAssessments.length === 0}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Creating...' : 'Assign'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
