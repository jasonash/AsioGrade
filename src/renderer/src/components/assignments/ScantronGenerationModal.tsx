import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import QuizIcon from '@mui/icons-material/Quiz'
import { Modal } from '../ui'
import { useAssignmentStore } from '../../stores'
import type { AssignmentSummary, ScantronGenerationRequest, ScantronOptions } from '../../../../shared/types'
import type { ServiceResult } from '../../../../shared/types/common.types'

interface ScantronGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: AssignmentSummary | null
}

interface FormData {
  paperSize: 'letter' | 'a4'
  includeNameField: boolean
  includeInstructions: boolean
  bubbleStyle: 'circle' | 'oval'
}

export function ScantronGenerationModal({
  isOpen,
  onClose,
  assignment
}: ScantronGenerationModalProps): ReactElement {
  const { generateScantron, generatingScantron, error: storeError, clearError } = useAssignmentStore()

  const [formData, setFormData] = useState<FormData>({
    paperSize: 'letter',
    includeNameField: true,
    includeInstructions: true,
    bubbleStyle: 'circle'
  })

  const [generationComplete, setGenerationComplete] = useState(false)
  const [resultInfo, setResultInfo] = useState<{ studentCount: number; pageCount: number } | null>(
    null
  )

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        paperSize: 'letter',
        includeNameField: true,
        includeInstructions: true,
        bubbleStyle: 'circle'
      })
      setGenerationComplete(false)
      setResultInfo(null)
      clearError()
    }
  }, [isOpen, clearError])

  const handleChange = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!assignment) return

    const options: ScantronOptions = {
      paperSize: formData.paperSize,
      includeNameField: formData.includeNameField,
      includeInstructions: formData.includeInstructions,
      bubbleStyle: formData.bubbleStyle
    }

    const isQuiz = assignment.assessmentType === 'quiz'

    let result: { pdfBase64: string; studentCount: number; pageCount: number } | null = null

    if (isQuiz) {
      // Use quiz PDF generation (single page with questions + bubbles)
      const quizResult = await window.electronAPI.invoke<
        ServiceResult<{ pdfBase64: string; studentCount: number; pageCount: number }>
      >('pdf:generateQuiz', {
        assignmentId: assignment.id,
        sectionId: assignment.sectionId,
        options
      })

      if (quizResult.success) {
        result = quizResult.data
      } else {
        // Store error will be set by the store's generateScantron if we used it
        // For quiz, we need to handle the error here
        console.error('Quiz PDF generation failed:', quizResult.error)
        return
      }
    } else {
      // Use standard scantron generation
      const request: ScantronGenerationRequest = {
        assignmentId: assignment.id,
        sectionId: assignment.sectionId,
        options
      }
      result = await generateScantron(request)
    }

    if (result) {
      setResultInfo({
        studentCount: result.studentCount,
        pageCount: result.pageCount
      })

      // Use save dialog (remembers last directory)
      const filePrefix = isQuiz ? 'quiz' : 'scantron'
      const saveResult = await window.electronAPI.invoke<{ success: boolean }>('file:saveWithDialog', {
        data: result.pdfBase64,
        defaultFilename: `${filePrefix}-${assignment.assessmentTitle.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (saveResult.success) {
        setGenerationComplete(true)
      }
    }
  }, [assignment, formData, generateScantron])

  const handleClose = useCallback(() => {
    setGenerationComplete(false)
    setResultInfo(null)
    onClose()
  }, [onClose])

  if (!assignment) return <></>

  const isQuiz = assignment.assessmentType === 'quiz'
  const modalTitle = isQuiz ? 'Generate Quiz PDF' : 'Generate Scantrons'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="md">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Store error */}
        {storeError && <Alert severity="error">{storeError}</Alert>}

        {/* Quiz format info */}
        {assignment.assessmentType === 'quiz' && (
          <Alert severity="info" icon={<QuizIcon />} sx={{ py: 0.5 }}>
            This is a quiz - generating single-page format with questions and bubbles together.
          </Alert>
        )}

        {/* Success message */}
        {generationComplete && resultInfo && (
          <Alert
            severity="success"
            icon={<CheckCircleIcon />}
            sx={{ mb: 1 }}
          >
            Generated {resultInfo.pageCount} {assignment.assessmentType === 'quiz' ? 'quiz' : 'scantron'} page
            {resultInfo.pageCount !== 1 ? 's' : ''} for {resultInfo.studentCount} student
            {resultInfo.studentCount !== 1 ? 's' : ''}. The PDF has been downloaded.
          </Alert>
        )}

        {/* Assignment Info */}
        <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2">
              {assignment.assessmentTitle}
            </Typography>
            {assignment.assessmentType === 'quiz' && (
              <Chip label="Quiz" size="small" color="info" />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {assignment.questionCount} questions | {assignment.studentCount} student
            {assignment.studentCount !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Paper Size */}
        <TextField
          select
          label="Paper Size"
          value={formData.paperSize}
          onChange={(e) => handleChange('paperSize', e.target.value as 'letter' | 'a4')}
          disabled={generatingScantron}
          size="small"
          fullWidth
        >
          <MenuItem value="letter">US Letter (8.5 x 11 in)</MenuItem>
          <MenuItem value="a4">A4 (210 x 297 mm)</MenuItem>
        </TextField>

        {/* Bubble Style */}
        <TextField
          select
          label="Bubble Style"
          value={formData.bubbleStyle}
          onChange={(e) => handleChange('bubbleStyle', e.target.value as 'circle' | 'oval')}
          disabled={generatingScantron}
          size="small"
          fullWidth
        >
          <MenuItem value="circle">Circle</MenuItem>
          <MenuItem value="oval">Oval</MenuItem>
        </TextField>

        {/* Options */}
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.includeNameField}
                onChange={(e) => handleChange('includeNameField', e.target.checked)}
                disabled={generatingScantron}
              />
            }
            label="Include name field"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.includeInstructions}
                onChange={(e) => handleChange('includeInstructions', e.target.checked)}
                disabled={generatingScantron}
              />
            }
            label="Include instructions"
          />
        </Box>

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
          <Button variant="outlined" onClick={handleClose} disabled={generatingScantron}>
            {generationComplete ? 'Close' : 'Cancel'}
          </Button>
          {!generationComplete && (
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={generatingScantron}
              startIcon={
                generatingScantron ? <CircularProgress size={16} color="inherit" /> : undefined
              }
            >
              {generatingScantron ? 'Generating...' : 'Generate & Download'}
            </Button>
          )}
        </Box>
      </Box>
    </Modal>
  )
}
