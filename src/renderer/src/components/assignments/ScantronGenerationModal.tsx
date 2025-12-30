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
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Chip from '@mui/material/Chip'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import QuizIcon from '@mui/icons-material/Quiz'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import TuneIcon from '@mui/icons-material/Tune'
import DescriptionIcon from '@mui/icons-material/Description'
import GridOnIcon from '@mui/icons-material/GridOn'
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

type GenerationMode = 'scantron' | 'fullTest'

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
  const [generationMode, setGenerationMode] = useState<GenerationMode>('scantron')
  const [generatingTestPDF, setGeneratingTestPDF] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // DOK and version state
  const [students, setStudents] = useState<Student[]>([])
  const [dokOverrides, setDokOverrides] = useState<DOKOverride[]>([])
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Check if assessment has versions (either on base or any DOK variant)
  const hasVersions = useMemo(() => {
    // Check base assessment versions
    if (assessment?.versions && assessment.versions.length > 0) {
      return true
    }
    // Check DOK variant versions
    if (assessment?.variants?.some((v) => v.versions && v.versions.length > 0)) {
      return true
    }
    return false
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

          // Load assessment to check for versions (force refresh to get latest data)
          const assessmentResult = await window.electronAPI.invoke<ServiceResult<Assessment>>(
            'drive:getAssessment',
            assignment.assessmentId,
            true // forceRefresh - bypass cache to ensure we have latest versions
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

  // Reset form when modal opens/closes
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
      setGenerationMode('scantron')
      setLocalError(null)
      clearError()
    } else {
      // Reset loaded data when modal closes to ensure fresh load next time
      setStudents([])
      setAssessment(null)
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

      return {
        studentId: student.id,
        versionId,
        dokOverride
      }
    })
  }, [students, dokOverrides, formData.versionStrategy])

  const handleGenerate = useCallback(async () => {
    if (!assignment) return

    setLocalError(null)

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
      setLocalError(updateResult.error ?? 'Failed to update assignment')
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
    let filePrefix = 'scantron'

    if (isQuiz) {
      // Use quiz PDF generation (single page with questions + bubbles)
      // Pass studentAssignments directly to avoid cache timing issues with Drive
      const quizResult = await window.electronAPI.invoke<
        ServiceResult<{ pdfBase64: string; studentCount: number; pageCount: number }>
      >('pdf:generateQuiz', {
        assignmentId: assignment.id,
        sectionId: assignment.sectionId,
        options,
        studentAssignments
      })

      if (quizResult.success) {
        result = quizResult.data
        filePrefix = 'quiz'
      } else {
        setLocalError(quizResult.error ?? 'Quiz PDF generation failed')
        return
      }
    } else if (generationMode === 'fullTest') {
      // Generate full test PDF (questions + scantron)
      setGeneratingTestPDF(true)
      try {
        const testResult = await window.electronAPI.invoke<
          ServiceResult<{ pdfBase64: string; studentCount: number; pageCount: number }>
        >('pdf:exportTest', {
          assignmentId: assignment.id,
          sectionId: assignment.sectionId,
          options,
          studentAssignments
        })

        if (testResult.success) {
          result = testResult.data
          filePrefix = 'test'
        } else {
          setLocalError(testResult.error ?? 'Test PDF generation failed')
          return
        }
      } finally {
        setGeneratingTestPDF(false)
      }
    } else {
      // Use standard scantron generation
      // Pass studentAssignments directly to avoid cache timing issues with Drive
      const request: ScantronGenerationRequest = {
        assignmentId: assignment.id,
        sectionId: assignment.sectionId,
        options,
        studentAssignments
      }
      result = await generateScantron(request)
      filePrefix = 'scantron'
    }

    if (result) {
      setResultInfo({
        studentCount: result.studentCount,
        pageCount: result.pageCount
      })

      // Use save dialog (remembers last directory)
      // Build filename with section name if available
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
  }, [assignment, formData, generationMode, buildStudentAssignments, generateScantron, sectionName])

  const handleClose = useCallback(() => {
    setGenerationComplete(false)
    setResultInfo(null)
    onClose()
  }, [onClose])

  if (!assignment) return <></>

  const isQuiz = assignment.assessmentType === 'quiz'
  const isLoading = loadingData || generatingScantron || generatingTestPDF

  // Dynamic title based on mode
  let modalTitle = 'Generate Scantrons'
  if (isQuiz) {
    modalTitle = 'Generate Quiz PDF'
  } else if (generationMode === 'fullTest') {
    modalTitle = 'Generate Full Test PDF'
  }

  // Dynamic label for output type
  const outputLabel = isQuiz ? 'quiz' : generationMode === 'fullTest' ? 'test' : 'scantron'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Errors */}
        {(storeError || localError) && (
          <Alert severity="error">{storeError || localError}</Alert>
        )}

        {/* Quiz format info */}
        {isQuiz && (
          <Alert severity="info" icon={<QuizIcon />} sx={{ py: 0.5 }}>
            This is a quiz - generating single-page format with questions and bubbles together.
          </Alert>
        )}

        {/* Success message */}
        {generationComplete && resultInfo && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1 }}>
            Generated {resultInfo.pageCount} {outputLabel} page
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

        {/* Generation Mode Selection (non-quiz only) */}
        {!isQuiz && (
          <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Output Format
            </Typography>
            <RadioGroup
              value={generationMode}
              onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
              sx={{ gap: 0.5 }}
            >
              <FormControlLabel
                value="scantron"
                control={<Radio size="small" />}
                disabled={isLoading}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GridOnIcon fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2">Scantron Only</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Bubble sheets for grading - print questions separately
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ m: 0, py: 0.5 }}
              />
              <FormControlLabel
                value="fullTest"
                control={<Radio size="small" />}
                disabled={isLoading}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DescriptionIcon fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2">Full Test PDF</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Questions + scantron for each student (DOK/version personalized)
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ m: 0, py: 0.5 }}
              />
            </RadioGroup>
          </Box>
        )}

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
