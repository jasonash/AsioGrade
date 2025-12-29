import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { Modal } from '../ui'
import { useRosterStore } from '../../stores'
import type { Student, CreateStudentInput, UpdateStudentInput, DOKLevel } from '../../../../shared/types'
import { DOK_LABELS, DOK_DESCRIPTIONS, DOK_LEVELS } from '../../../../shared/types'

interface StudentFormModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  student?: Student // If provided, we're in edit mode
  onSuccess?: (student: Student) => void
}

interface FormData {
  firstName: string
  lastName: string
  email: string
  studentNumber: string
  notes: string
  dokLevel: DOKLevel
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
}

export function StudentFormModal({
  isOpen,
  onClose,
  sectionId,
  student,
  onSuccess
}: StudentFormModalProps): ReactElement {
  const { addStudent, updateStudent, error: storeError, clearError } = useRosterStore()
  const isEditMode = !!student

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    studentNumber: '',
    notes: '',
    dokLevel: 2
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens or student changes
  useEffect(() => {
    if (isOpen) {
      if (student) {
        setFormData({
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email ?? '',
          studentNumber: student.studentNumber ?? '',
          notes: student.notes ?? '',
          dokLevel: student.dokLevel ?? 2
        })
      } else {
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          studentNumber: '',
          notes: '',
          dokLevel: 2
        })
      }
      setErrors({})
      clearError()
    }
  }, [isOpen, student, clearError])

  const handleChange = useCallback(
    (field: keyof FormData, value: string | DOKLevel) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    [errors]
  )

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validate()) return

      setIsSubmitting(true)

      let result: Student | null = null

      if (isEditMode && student) {
        const input: UpdateStudentInput = {
          id: student.id,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim() || undefined,
          studentNumber: formData.studentNumber.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          dokLevel: formData.dokLevel
        }
        result = await updateStudent(sectionId, input)
      } else {
        const input: CreateStudentInput = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim() || undefined,
          studentNumber: formData.studentNumber.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          dokLevel: formData.dokLevel
        }
        result = await addStudent(sectionId, input)
      }

      setIsSubmitting(false)

      if (result) {
        onSuccess?.(result)
        onClose()
      }
    },
    [formData, validate, isEditMode, student, sectionId, addStudent, updateStudent, onSuccess, onClose]
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Student' : 'Add Student'}
      size="sm"
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {storeError && (
          <Alert severity="error">{storeError}</Alert>
        )}

        {/* First Name */}
        <TextField
          label="First Name"
          required
          value={formData.firstName}
          onChange={(e) => handleChange('firstName', e.target.value)}
          placeholder="John"
          error={!!errors.firstName}
          helperText={errors.firstName}
          disabled={isSubmitting}
          size="small"
          fullWidth
          autoFocus
        />

        {/* Last Name */}
        <TextField
          label="Last Name"
          required
          value={formData.lastName}
          onChange={(e) => handleChange('lastName', e.target.value)}
          placeholder="Doe"
          error={!!errors.lastName}
          helperText={errors.lastName}
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Student Number */}
        <TextField
          label="Student Number (optional)"
          value={formData.studentNumber}
          onChange={(e) => handleChange('studentNumber', e.target.value)}
          placeholder="e.g., 12345"
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* Email */}
        <TextField
          label="Email (optional)"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="student@school.edu"
          error={!!errors.email}
          helperText={errors.email}
          disabled={isSubmitting}
          size="small"
          fullWidth
        />

        {/* DOK Level */}
        <FormControl fullWidth size="small">
          <InputLabel id="dok-level-label">DOK Level</InputLabel>
          <Select
            labelId="dok-level-label"
            value={formData.dokLevel}
            onChange={(e) => handleChange('dokLevel', e.target.value as DOKLevel)}
            label="DOK Level"
            disabled={isSubmitting}
          >
            {DOK_LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2">
                    {level} - {DOK_LABELS[level]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {DOK_DESCRIPTIONS[level]}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Notes */}
        <TextField
          label="Notes (optional)"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Private notes about this student..."
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
                : 'Add Student'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
