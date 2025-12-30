import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import { Modal } from '../ui'
import type { Course, UpdateCourseInput } from '../../../../shared/types'
import type { ServiceResult } from '../../../../shared/types/common.types'

interface CourseSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  course: Course
  onSuccess?: (course: Course) => void
}

export function CourseSettingsModal({
  isOpen,
  onClose,
  course,
  onSuccess
}: CourseSettingsModalProps): ReactElement {
  const [aiPromptSupplement, setAiPromptSupplement] = useState(course.aiPromptSupplement ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens or course changes
  useEffect(() => {
    if (isOpen) {
      setAiPromptSupplement(course.aiPromptSupplement ?? '')
      setError(null)
    }
  }, [isOpen, course.aiPromptSupplement])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSubmitting(true)
      setError(null)

      try {
        const input: UpdateCourseInput = {
          id: course.id,
          aiPromptSupplement: aiPromptSupplement.trim()
        }

        const result = await window.electronAPI.invoke<ServiceResult<Course>>(
          'drive:updateCourse',
          input
        )

        if (result.success) {
          onSuccess?.(result.data)
          onClose()
        } else {
          setError(result.error || 'Failed to save settings')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save settings'
        setError(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [course.id, aiPromptSupplement, onSuccess, onClose]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Course AI Settings" size="md">
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        {error && <Alert severity="error">{error}</Alert>}

        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure AI instructions specific to <strong>{course.name}</strong>. These
            instructions will be included in all AI-generated questions for this course.
          </Typography>
        </Box>

        <TextField
          label="Course Prompt Supplement"
          multiline
          rows={5}
          fullWidth
          value={aiPromptSupplement}
          onChange={(e) => setAiPromptSupplement(e.target.value)}
          placeholder="e.g., Focus on real-world applications relevant to agricultural communities. Use simple vocabulary and avoid complex scientific terminology."
          disabled={isSubmitting}
          slotProps={{
            input: {
              sx: { fontSize: '0.875rem' }
            }
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Typography variant="caption" color="text.secondary">
            {aiPromptSupplement.length}/1000
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>How it works:</strong> When generating questions, the AI receives instructions
            in this order: Global settings → Course settings (this) → Individual request
            instructions. All applicable instructions are combined.
          </Typography>
        </Paper>

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
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
