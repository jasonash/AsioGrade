import { type ReactElement, useState, useCallback, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../ui'
import { useRosterStore } from '../../stores'
import type { Student, CreateStudentInput, UpdateStudentInput } from '../../../../shared/types'

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
    notes: ''
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
          notes: student.notes ?? ''
        })
      } else {
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          studentNumber: '',
          notes: ''
        })
      }
      setErrors({})
      clearError()
    }
  }, [isOpen, student, clearError])

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
          notes: formData.notes.trim() || undefined
        }
        result = await updateStudent(sectionId, input)
      } else {
        const input: CreateStudentInput = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim() || undefined,
          studentNumber: formData.studentNumber.trim() || undefined,
          notes: formData.notes.trim() || undefined
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

  const inputClassName =
    'w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors'

  const labelClassName = 'block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5'

  const errorClassName = 'mt-1 text-xs text-[var(--color-error)]'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Student' : 'Add Student'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {storeError && (
          <div className="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{storeError}</p>
          </div>
        )}

        {/* First Name */}
        <div>
          <label htmlFor="student-firstName" className={labelClassName}>
            First Name <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="student-firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="John"
            className={`${inputClassName} ${errors.firstName ? 'border-[var(--color-error)]' : ''}`}
            disabled={isSubmitting}
            autoFocus
          />
          {errors.firstName && <p className={errorClassName}>{errors.firstName}</p>}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="student-lastName" className={labelClassName}>
            Last Name <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="student-lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Doe"
            className={`${inputClassName} ${errors.lastName ? 'border-[var(--color-error)]' : ''}`}
            disabled={isSubmitting}
          />
          {errors.lastName && <p className={errorClassName}>{errors.lastName}</p>}
        </div>

        {/* Student Number */}
        <div>
          <label htmlFor="student-number" className={labelClassName}>
            Student Number <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <input
            id="student-number"
            type="text"
            value={formData.studentNumber}
            onChange={(e) => handleChange('studentNumber', e.target.value)}
            placeholder="e.g., 12345"
            className={inputClassName}
            disabled={isSubmitting}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="student-email" className={labelClassName}>
            Email <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <input
            id="student-email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="student@school.edu"
            className={`${inputClassName} ${errors.email ? 'border-[var(--color-error)]' : ''}`}
            disabled={isSubmitting}
          />
          {errors.email && <p className={errorClassName}>{errors.email}</p>}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="student-notes" className={labelClassName}>
            Notes <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            id="student-notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Private notes about this student..."
            rows={2}
            className={`${inputClassName} resize-none`}
            disabled={isSubmitting}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-surface-active)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting
              ? isEditMode
                ? 'Saving...'
                : 'Adding...'
              : isEditMode
                ? 'Save Changes'
                : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
