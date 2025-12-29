import { type ReactElement, useState, useCallback, useEffect, useMemo } from 'react'
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
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import QuizIcon from '@mui/icons-material/Quiz'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import TuneIcon from '@mui/icons-material/Tune'
import { Modal } from '../ui'
import { DOKChecklist } from './DOKChecklist'
import { useAssignmentStore } from '../../stores'
import type {
  AssignmentSummary,
  ScantronGenerationRequest,
  ScantronOptions,
  Student,
  Assessment,
  DOKLevel,
  VersionId,
  VersionAssignmentStrategy,
  StudentAssignment
} from '../../../../shared/types'
import type { ServiceResult } from '../../../../shared/types/common.types'

interface ScantronGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: AssignmentSummary | null
  sectionName?: string
}

interface FormData {
  paperSize: 'letter' | 'a4'
  includeNameField: boolean
  includeInstructions: boolean
  bubbleStyle: 'circle' | 'oval'
  versionStrategy: VersionAssignmentStrategy
}

interface DOKOverride {
  studentId: string
  dokLevel: DOKLevel
}

const VERSION_IDS: VersionId[] = ['A', 'B', 'C', 'D']

export function ScantronGenerationModal({
  isOpen,
  onClose,
  assignment,
  sectionName
}: ScantronGenerationModalProps): ReactElement {
  const { generateScantron, generatingScantron, error: storeError, clearError } = useAssignmentStore()

  const [formData, setFormData] = useState<FormData>({
    paperSize: 'letter',
    includeNameField: true,
    includeInstructions: true,
    bubbleStyle: 'circle',
    versionStrategy: 'single'
  })

  const [generationComplete, setGenerationComplete] = useState(false)
  const [resultInfo, setResultInfo] = useState<{ studentCount: number; pageCount: number } | null>(
    null
  )

  // DOK and version state
  const [students, setStudents] = useState<Student[]>([])
  const [dokOverrides, setDokOverrides] = useState<DOKOverride[]>([])
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Check if assessment has versions
  const hasVersions = useMemo(() => {
    return assessment?.versions && assessment.versions.length > 0
  }, [assessment])

  // Load roster and assessment when modal opens
  useEffect(() => {
    if (isOpen && assignment) {
      const loadData = async (): Promise<void> => {
        setLoadingData(true)

        try {
          // Load roster
          const rosterResult = await window.electronAPI.invoke<ServiceResult<{ students: Student[] }>>(
            'drive:getRoster',
            assignment.sectionId
          )
          if (rosterResult.success) {
            const activeStudents = rosterResult.data.students.filter((s) => s.active)
            setStudents(activeStudents)
          }

          // Load assessment to check for versions
          const assessmentResult = await window.electronAPI.invoke<ServiceResult<Assessment>>(
            'drive:getAssessment',
            assignment.assessmentId
          )
          if (assessmentResult.success) {
            setAssessment(assessmentResult.data)
          }
        } catch (err) {
          console.error('Failed to load data:', err)
        }

        setLoadingData(false)
      }

      loadData()
    }
  }, [isOpen, assignment])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        paperSize: 'letter',
        includeNameField: true,
        includeInstructions: true,
        bubbleStyle: 'circle',
        versionStrategy: 'single'
      })
      setGenerationComplete(false)
      setResultInfo(null)
      setDokOverrides([])
      clearError()
    }
  }, [isOpen, clearError])

  const handleChange = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Build student assignments with DOK overrides and versions
  const buildStudentAssignments = useCallback((): StudentAssignment[] => {
    return students.map((student, index) => {
      // Get DOK override if exists
      const override = dokOverrides.find((o) => o.studentId === student.id)
      const dokOverride = override ? override.dokLevel : undefined

      // Assign version based on strategy
      let versionId: VersionId = 'A'
      if (hasVersions) {
        switch (formData.versionStrategy) {
          case 'random':
            versionId = VERSION_IDS[Math.floor(Math.random() * VERSION_IDS.length)]
            break
          case 'sequential':
            versionId = VERSION_IDS[index % VERSION_IDS.length]
            break
          case 'single':
          default:
            versionId = 'A'
        }
      }

      return {
        studentId: student.id,
        versionId,
        dokOverride
      }
    })
  }, [students, dokOverrides, hasVersions, formData.versionStrategy])

  const handleGenerate = useCallback(async () => {
    if (!assignment) return

    // Build student assignments with DOK and version info
    const studentAssignments = buildStudentAssignments()

    // Update the assignment with the new student assignments
    const updateResult = await window.electronAPI.invoke<ServiceResult<unknown>>(
      'drive:updateAssignment',
      {
        id: assignment.id,
        sectionId: assignment.sectionId,
        studentAssignments
      }
    )

    if (!updateResult.success) {
      console.error('Failed to update assignment:', updateResult.error)
      return
    }

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
      // Build filename with section name if available
      const filePrefix = isQuiz ? 'quiz' : 'scantron'
      const sanitizedTitle = assignment.assessmentTitle.replace(/[^a-zA-Z0-9]/g, '-')
      const sanitizedSection = sectionName ? `-${sectionName.replace(/[^a-zA-Z0-9]/g, '-')}` : ''
      const saveResult = await window.electronAPI.invoke<{ success: boolean }>('file:saveWithDialog', {
        data: result.pdfBase64,
        defaultFilename: `${filePrefix}-${sanitizedTitle}${sanitizedSection}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (saveResult.success) {
        setGenerationComplete(true)
      }
    }
  }, [assignment, formData, buildStudentAssignments, generateScantron])

  const handleClose = useCallback(() => {
    setGenerationComplete(false)
    setResultInfo(null)
    onClose()
  }, [onClose])

  if (!assignment) return <></>

  const isQuiz = assignment.assessmentType === 'quiz'
  const modalTitle = isQuiz ? 'Generate Quiz PDF' : 'Generate Scantrons'
  const isLoading = loadingData || generatingScantron

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Store error */}
        {storeError && <Alert severity="error">{storeError}</Alert>}

        {/* Quiz format info */}
        {isQuiz && (
          <Alert severity="info" icon={<QuizIcon />} sx={{ py: 0.5 }}>
            This is a quiz - generating single-page format with questions and bubbles together.
          </Alert>
        )}

        {/* Success message */}
        {generationComplete && resultInfo && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1 }}>
            Generated {resultInfo.pageCount} {isQuiz ? 'quiz' : 'scantron'} page
            {resultInfo.pageCount !== 1 ? 's' : ''} for {resultInfo.studentCount} student
            {resultInfo.studentCount !== 1 ? 's' : ''}. The PDF has been downloaded.
          </Alert>
        )}

        {/* Assignment Info */}
        <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2">{assignment.assessmentTitle}</Typography>
            {isQuiz && <Chip label="Quiz" size="small" color="info" />}
            {hasVersions && <Chip label="Has Versions" size="small" color="success" />}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {assignment.questionCount} questions | {assignment.studentCount} student
            {assignment.studentCount !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* DOK Checklist Section */}
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon fontSize="small" />
              <Typography variant="subtitle2">DOK Levels</Typography>
              {dokOverrides.length > 0 && (
                <Chip
                  label={`${dokOverrides.length} override${dokOverrides.length !== 1 ? 's' : ''}`}
                  size="small"
                  color="warning"
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {loadingData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : students.length > 0 ? (
              <DOKChecklist
                students={students}
                overrides={dokOverrides}
                onOverridesChange={setDokOverrides}
                disabled={isLoading}
              />
            ) : (
              <Typography color="text.secondary">No active students found</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Version Assignment Section (only if assessment has versions) */}
        {hasVersions && (
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShuffleIcon fontSize="small" />
                <Typography variant="subtitle2">Version Assignment</Typography>
                <Chip
                  label={
                    formData.versionStrategy === 'single'
                      ? 'All Version A'
                      : formData.versionStrategy === 'random'
                        ? 'Random'
                        : 'Sequential'
                  }
                  size="small"
                  color={formData.versionStrategy === 'single' ? 'default' : 'primary'}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                select
                label="Version Assignment Strategy"
                value={formData.versionStrategy}
                onChange={(e) =>
                  handleChange('versionStrategy', e.target.value as VersionAssignmentStrategy)
                }
                disabled={isLoading}
                size="small"
                fullWidth
                helperText={
                  formData.versionStrategy === 'single'
                    ? 'All students receive Version A'
                    : formData.versionStrategy === 'random'
                      ? 'Randomly distribute versions A, B, C, D across students'
                      : 'Assign versions in order: A, B, C, D, A, B, C, D...'
                }
              >
                <MenuItem value="single">Single Version (A only)</MenuItem>
                <MenuItem value="random">Random Distribution</MenuItem>
                <MenuItem value="sequential">Sequential Assignment</MenuItem>
              </TextField>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Print Options */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Print Options</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Paper Size */}
              <TextField
                select
                label="Paper Size"
                value={formData.paperSize}
                onChange={(e) => handleChange('paperSize', e.target.value as 'letter' | 'a4')}
                disabled={isLoading}
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
                disabled={isLoading}
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
                      disabled={isLoading}
                    />
                  }
                  label="Include name field"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.includeInstructions}
                      onChange={(e) => handleChange('includeInstructions', e.target.checked)}
                      disabled={isLoading}
                    />
                  }
                  label="Include instructions"
                />
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

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
          <Button variant="outlined" onClick={handleClose} disabled={isLoading}>
            {generationComplete ? 'Close' : 'Cancel'}
          </Button>
          {!generationComplete && (
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={isLoading || students.length === 0}
              startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isLoading ? 'Generating...' : 'Generate & Download'}
            </Button>
          )}
        </Box>
      </Box>
    </Modal>
  )
}
