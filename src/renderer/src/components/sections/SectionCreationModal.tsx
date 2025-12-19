import { type ReactElement, useState, useCallback, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
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

  const inputClassName =
    'w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors'

  const labelClassName = 'block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5'

  const errorClassName = 'mt-1 text-xs text-[var(--color-error)]'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Section" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Course context */}
        <div className="text-sm text-[var(--color-text-muted)]">
          Adding section to <span className="font-medium text-[var(--color-text-secondary)]">{courseName}</span>
        </div>

        {/* Store error */}
        {storeError && (
          <div className="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{storeError}</p>
          </div>
        )}

        {/* Section Name */}
        <div>
          <label htmlFor="section-name" className={labelClassName}>
            Section Name <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="section-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Period 1, Block A, 3rd Hour"
            className={`${inputClassName} ${errors.name ? 'border-[var(--color-error)]' : ''}`}
            disabled={isSubmitting}
            autoFocus
          />
          {errors.name && <p className={errorClassName}>{errors.name}</p>}
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Use whatever naming works for your school (Period, Block, Hour, etc.)
          </p>
        </div>

        {/* Schedule */}
        <div>
          <label htmlFor="section-schedule" className={labelClassName}>
            Schedule <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <input
            id="section-schedule"
            type="text"
            value={formData.schedule}
            onChange={(e) => handleChange('schedule', e.target.value)}
            placeholder="e.g., MWF 8:00-8:50am"
            className={inputClassName}
            disabled={isSubmitting}
          />
        </div>

        {/* Room */}
        <div>
          <label htmlFor="section-room" className={labelClassName}>
            Room <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <input
            id="section-room"
            type="text"
            value={formData.room}
            onChange={(e) => handleChange('room', e.target.value)}
            placeholder="e.g., Room 204, Lab B"
            className={inputClassName}
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
            {isSubmitting ? 'Adding...' : 'Add Section'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
