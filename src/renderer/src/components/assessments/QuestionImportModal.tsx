/**
 * QuestionImportModal Component
 *
 * Modal for importing existing questions from old tests, worksheets, or question banks.
 * Upload a PDF, DOCX, or TXT containing questions and AI will extract and structure them.
 *
 * Note: This is for importing EXISTING QUESTIONS, not teaching materials.
 * Teaching materials for AI context will be a separate unit-level feature.
 */

import { type ReactElement, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorIcon from '@mui/icons-material/Error'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { Modal } from '../ui'
import type { ServiceResult } from '../../../../shared/types/common.types'
import type {
  MaterialImportRequest,
  MaterialImportResult,
  ExtractedQuestion,
  FillInBlankConversionRequest,
  FillInBlankConversionResult
} from '../../../../shared/types/ai.types'
import type { MultipleChoiceQuestion, Choice } from '../../../../shared/types/question.types'

interface QuestionImportModalProps {
  isOpen: boolean
  onClose: () => void
  gradeLevel: string
  subject: string
  onQuestionsImported: (questions: MultipleChoiceQuestion[]) => void
}

type ImportStep = 'upload' | 'extracting' | 'review'

export function QuestionImportModal({
  isOpen,
  onClose,
  gradeLevel,
  subject,
  onQuestionsImported
}: QuestionImportModalProps): ReactElement {
  const [step, setStep] = useState<ImportStep>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<MaterialImportResult | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [selectedFillInBlank, setSelectedFillInBlank] = useState<Set<string>>(new Set())
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal closes
  const handleClose = (): void => {
    setStep('upload')
    setFileName(null)
    setImportResult(null)
    setSelectedQuestions(new Set())
    setSelectedFillInBlank(new Set())
    setIsConverting(false)
    setError(null)
    onClose()
  }

  const handleSelectFile = async (): Promise<void> => {
    setError(null)

    try {
      // Open file dialog
      const fileResult = await window.electronAPI.invoke<ServiceResult<string | null>>(
        'import:openMaterialFileDialog'
      )

      if (!fileResult.success) {
        setError(fileResult.error ?? 'Failed to open file dialog')
        return
      }

      if (!fileResult.data) {
        // User cancelled
        return
      }

      const filePath = fileResult.data
      const name = filePath.split('/').pop() ?? filePath
      setFileName(name)

      // Extract text from file
      const textResult = await window.electronAPI.invoke<ServiceResult<string>>(
        'import:extractTextFromFile',
        filePath
      )

      if (!textResult.success) {
        setError(textResult.error ?? 'Failed to extract text from file')
        return
      }

      setStep('extracting')

      // Send to AI for question extraction
      const request: MaterialImportRequest = {
        text: textResult.data,
        sourceFileName: name,
        gradeLevel,
        subject
      }

      const aiResult = await window.electronAPI.invoke<ServiceResult<MaterialImportResult>>(
        'ai:extractQuestionsFromMaterial',
        request
      )

      if (!aiResult.success) {
        setError(aiResult.error ?? 'Failed to extract questions')
        setStep('upload')
        return
      }

      setImportResult(aiResult.data)

      // Pre-select high confidence multiple choice questions
      const preSelectedMC = new Set<string>()
      const preSelectedFIB = new Set<string>()
      for (const q of aiResult.data.questions) {
        if (q.type === 'multiple_choice' && q.confidence !== 'low') {
          preSelectedMC.add(q.id)
        } else if (q.type === 'fill_in_blank' && q.correctAnswer && q.confidence !== 'low') {
          preSelectedFIB.add(q.id)
        }
      }
      setSelectedQuestions(preSelectedMC)
      setSelectedFillInBlank(preSelectedFIB)

      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('upload')
    }
  }

  const handleToggleQuestion = (questionId: string): void => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  const handleSelectAll = (): void => {
    if (!importResult) return
    const mcQuestions = importResult.questions.filter((q) => q.type === 'multiple_choice')
    setSelectedQuestions(new Set(mcQuestions.map((q) => q.id)))
  }

  const handleSelectNone = (): void => {
    setSelectedQuestions(new Set())
  }

  const handleToggleFillInBlank = (questionId: string): void => {
    setSelectedFillInBlank((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  const handleSelectAllFillInBlank = (): void => {
    if (!importResult) return
    const fibQuestions = importResult.questions.filter(
      (q) => q.type === 'fill_in_blank' && q.correctAnswer
    )
    setSelectedFillInBlank(new Set(fibQuestions.map((q) => q.id)))
  }

  const handleSelectNoneFillInBlank = (): void => {
    setSelectedFillInBlank(new Set())
  }

  const handleConvertFillInBlank = async (): Promise<void> => {
    if (!importResult || selectedFillInBlank.size === 0) return

    setIsConverting(true)
    setError(null)

    try {
      // Get the selected fill-in-blank questions
      const questionsToConvert = importResult.questions.filter(
        (q) => q.type === 'fill_in_blank' && selectedFillInBlank.has(q.id)
      )

      const request: FillInBlankConversionRequest = {
        questions: questionsToConvert,
        gradeLevel,
        subject
      }

      const result = await window.electronAPI.invoke<ServiceResult<FillInBlankConversionResult>>(
        'ai:convertFillInBlank',
        request
      )

      if (!result.success) {
        setError(result.error ?? 'Failed to convert questions')
        setIsConverting(false)
        return
      }

      // Update the import result with converted questions
      const convertedIds = new Set(result.data.convertedQuestions.map((q) => q.id))
      const updatedQuestions = importResult.questions.map((q) => {
        if (convertedIds.has(q.id)) {
          // Find the converted version
          const converted = result.data.convertedQuestions.find((c) => c.id === q.id)
          return converted ?? q
        }
        return q
      })

      setImportResult({
        ...importResult,
        questions: updatedQuestions
      })

      // Move converted questions to MC selection, clear from FIB selection
      setSelectedQuestions((prev) => {
        const next = new Set(prev)
        convertedIds.forEach((id) => next.add(id))
        return next
      })
      setSelectedFillInBlank((prev) => {
        const next = new Set(prev)
        convertedIds.forEach((id) => next.delete(id))
        return next
      })

      setIsConverting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
      setIsConverting(false)
    }
  }

  const handleImport = (): void => {
    if (!importResult) return

    // Convert selected extracted questions to MultipleChoiceQuestion format
    const questions: MultipleChoiceQuestion[] = []

    for (const extracted of importResult.questions) {
      if (!selectedQuestions.has(extracted.id)) continue
      if (extracted.type !== 'multiple_choice') continue
      if (!extracted.choices || extracted.choices.length < 2) continue

      // Ensure choices have proper structure
      const choices: Choice[] = extracted.choices.map((c, i) => ({
        id: c.id ?? String.fromCharCode(97 + i),
        text: c.text,
        isCorrect: c.isCorrect ?? false
      }))

      // Ensure at least one correct answer
      if (!choices.some((c) => c.isCorrect)) {
        // If we have a correctAnswer hint, use it
        if (extracted.correctAnswer) {
          const correctChoice = choices.find((c) => c.id === extracted.correctAnswer)
          if (correctChoice) {
            correctChoice.isCorrect = true
          } else {
            choices[0].isCorrect = true
          }
        } else {
          choices[0].isCorrect = true
        }
      }

      const correctChoice = choices.find((c) => c.isCorrect)

      const question: MultipleChoiceQuestion = {
        id: `q-${Date.now().toString(36)}-${questions.length}`,
        type: 'multiple_choice',
        text: extracted.text,
        choices,
        correctAnswer: correctChoice?.id ?? 'a',
        points: 1,
        createdAt: new Date().toISOString()
      }

      questions.push(question)
    }

    onQuestionsImported(questions)
    handleClose()
  }

  const getConfidenceIcon = (confidence: ExtractedQuestion['confidence']): ReactElement => {
    switch (confidence) {
      case 'high':
        return <CheckCircleIcon color="success" fontSize="small" />
      case 'medium':
        return <WarningIcon color="warning" fontSize="small" />
      case 'low':
        return <ErrorIcon color="error" fontSize="small" />
    }
  }

  const getConfidenceLabel = (confidence: ExtractedQuestion['confidence']): string => {
    switch (confidence) {
      case 'high':
        return 'High confidence'
      case 'medium':
        return 'Medium confidence'
      case 'low':
        return 'Low confidence'
    }
  }

  const renderUploadStep = (): ReactElement => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
      <UploadFileIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
      <Typography variant="h6">Import Existing Questions</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Upload an old test, quiz, or question bank document.
        <br />
        AI will extract the questions and format them for this assessment.
      </Typography>
      <Button variant="contained" onClick={handleSelectFile} startIcon={<UploadFileIcon />}>
        Select File
      </Button>
      <Typography variant="caption" color="text.secondary">
        Supported formats: PDF, DOCX, TXT
      </Typography>
    </Box>
  )

  const renderExtractingStep = (): ReactElement => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
      <CircularProgress size={64} />
      <Typography variant="h6">Extracting Questions</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Analyzing {fileName} and extracting questions...
      </Typography>
    </Box>
  )

  const renderReviewStep = (): ReactElement => {
    if (!importResult) return <></>

    const mcQuestions = importResult.questions.filter((q) => q.type === 'multiple_choice')
    const fibQuestions = importResult.questions.filter(
      (q) => q.type === 'fill_in_blank' && q.correctAnswer
    )
    const otherQuestions = importResult.questions.filter(
      (q) => q.type !== 'multiple_choice' && q.type !== 'fill_in_blank'
    )
    const selectedCount = selectedQuestions.size

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Summary */}
        <Alert severity="info" sx={{ mb: 1 }}>
          {importResult.summary}
        </Alert>

        {/* Selection controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">
            Multiple Choice Questions ({selectedCount}/{mcQuestions.length} selected)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={handleSelectAll}>
              All
            </Button>
            <Button size="small" onClick={handleSelectNone}>
              None
            </Button>
          </Box>
        </Box>

        {/* Questions list */}
        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {mcQuestions.length === 0 ? (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic', py: 2 }}>
              No multiple choice questions found in the document.
            </Typography>
          ) : (
            mcQuestions.map((question) => (
              <Card
                key={question.id}
                variant="outlined"
                sx={{
                  mb: 1,
                  opacity: selectedQuestions.has(question.id) ? 1 : 0.6
                }}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Checkbox
                      checked={selectedQuestions.has(question.id)}
                      onChange={() => handleToggleQuestion(question.id)}
                      size="small"
                    />
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {getConfidenceIcon(question.confidence)}
                        <Chip
                          label={getConfidenceLabel(question.confidence)}
                          size="small"
                          variant="outlined"
                        />
                        {question.notes && (
                          <Typography variant="caption" color="text.secondary">
                            {question.notes}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {question.text}
                      </Typography>
                      {question.choices && (
                        <Box sx={{ mt: 1, pl: 1 }}>
                          {question.choices.map((choice) => (
                            <Typography
                              key={choice.id}
                              variant="body2"
                              color={choice.isCorrect ? 'success.main' : 'text.secondary'}
                              sx={{ fontSize: '0.85rem' }}
                            >
                              {choice.id.toUpperCase()}. {choice.text}
                              {choice.isCorrect && ' ✓'}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>

        {/* Fill-in-the-blank questions */}
        {fibQuestions.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">
                Fill-in-the-Blank Questions ({selectedFillInBlank.size}/{fibQuestions.length}{' '}
                selected)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" onClick={handleSelectAllFillInBlank}>
                  All
                </Button>
                <Button size="small" onClick={handleSelectNoneFillInBlank}>
                  None
                </Button>
              </Box>
            </Box>

            <Alert severity="info" sx={{ py: 0.5 }}>
              AI can convert fill-in-the-blank questions to multiple choice by generating answer
              choices.
            </Alert>

            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {fibQuestions.map((question) => (
                <Card
                  key={question.id}
                  variant="outlined"
                  sx={{
                    mb: 1,
                    opacity: selectedFillInBlank.has(question.id) ? 1 : 0.6
                  }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Checkbox
                        checked={selectedFillInBlank.has(question.id)}
                        onChange={() => handleToggleFillInBlank(question.id)}
                        size="small"
                      />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          {getConfidenceIcon(question.confidence)}
                          <Chip label="Fill-in-blank" size="small" color="info" variant="outlined" />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {question.text}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="success.main"
                          sx={{ mt: 0.5, fontSize: '0.85rem' }}
                        >
                          Answer: {question.correctAnswer}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Button
              variant="contained"
              color="secondary"
              onClick={handleConvertFillInBlank}
              disabled={selectedFillInBlank.size === 0 || isConverting}
              startIcon={isConverting ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            >
              {isConverting
                ? 'Converting...'
                : `Convert ${selectedFillInBlank.size} to Multiple Choice`}
            </Button>
          </>
        )}

        {/* Other question types notice */}
        {otherQuestions.length > 0 && (
          <>
            <Divider />
            <Typography variant="body2" color="text.secondary">
              {otherQuestions.length} other question(s) found (true/false, short answer) - these
              cannot be imported as multiple choice.
            </Typography>
          </>
        )}

        {/* Non-question content */}
        {importResult.nonQuestionContent && (
          <>
            <Divider />
            <Typography variant="subtitle2">Other Content Found</Typography>
            <TextField
              multiline
              rows={3}
              value={importResult.nonQuestionContent}
              InputProps={{ readOnly: true }}
              fullWidth
              size="small"
            />
          </>
        )}
      </Box>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Existing Questions"
      description={
        step === 'upload'
          ? 'Upload an old test, quiz, or question bank'
          : step === 'extracting'
            ? 'Extracting questions...'
            : 'Review extracted questions'
      }
      size="lg"
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {step === 'upload' && renderUploadStep()}
      {step === 'extracting' && renderExtractingStep()}
      {step === 'review' && renderReviewStep()}

      {/* Actions */}
      {step === 'review' && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button onClick={() => setStep('upload')}>Upload Different File</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={selectedQuestions.size === 0}
            >
              Import {selectedQuestions.size} Question{selectedQuestions.size !== 1 ? 's' : ''}
            </Button>
          </Box>
        </Box>
      )}
    </Modal>
  )
}
