/**
 * AIAssistantPanel Component
 *
 * Conversational AI interface for assessment creation assistance.
 * Includes quick actions, pending questions, and chat interface.
 */

import { type ReactElement, useState, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'
import SendIcon from '@mui/icons-material/Send'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useAIStore } from '../../stores'
import { GeneratedQuestionCard } from './GeneratedQuestionCard'
import { QuestionGenerationModal } from './QuestionGenerationModal'
import { QuestionImportModal } from './QuestionImportModal'
import { CoverageAnalysis } from './CoverageAnalysis'
import type { Standard, MultipleChoiceQuestion } from '../../../../shared/types'
import type { AIAssessmentContext, QuestionGenerationRequest } from '../../../../shared/types/ai.types'

interface AIAssistantPanelProps {
  courseId: string
  unitId: string
  assessmentId: string
  assessmentTitle: string
  gradeLevel: string
  subject: string
  unitStandards: Standard[]
  otherStandards: Standard[]
  existingQuestions: MultipleChoiceQuestion[]
  selectedQuestion?: MultipleChoiceQuestion
  onQuestionsAccepted: (questions: MultipleChoiceQuestion[]) => void
  onQuestionRefined: (questionId: string, refined: MultipleChoiceQuestion) => void
}

export function AIAssistantPanel({
  courseId,
  unitId,
  assessmentId,
  assessmentTitle,
  gradeLevel,
  subject,
  unitStandards,
  otherStandards,
  existingQuestions,
  selectedQuestion,
  onQuestionsAccepted,
  onQuestionRefined
}: AIAssistantPanelProps): ReactElement {
  const {
    conversation,
    isGenerating,
    streamingProgress,
    pendingQuestions,
    totalTokensUsed,
    error,
    sendChatMessage,
    acceptQuestion,
    rejectQuestion,
    acceptAllQuestions,
    rejectAllQuestions,
    clearError,
    clearConversation
  } = useAIStore()

  const [chatInput, setChatInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [showGenerationModal, setShowGenerationModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCoverage, setShowCoverage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { generateQuestions } = useAIStore()

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const context: AIAssessmentContext = {
    courseId,
    unitId,
    assessmentTitle,
    gradeLevel,
    subject,
    standardRefs: unitStandards.map((s) => s.code),
    existingQuestionCount: existingQuestions.length
  }

  // Handler for generating questions for uncovered standards
  const handleGenerateMissing = async (standardRefs: string[]): Promise<void> => {
    const request: QuestionGenerationRequest = {
      courseId,
      unitId,
      assessmentId,
      standardRefs,
      questionCount: Math.min(standardRefs.length * 2, 10), // 2 per standard, max 10
      questionTypes: ['multiple_choice'],
      difficulty: 'mixed',
      gradeLevel,
      subject
    }
    await generateQuestions(request)
  }

  const handleSendMessage = async (): Promise<void> => {
    if (!chatInput.trim() || isGenerating) return
    const message = chatInput.trim()
    setChatInput('')
    await sendChatMessage(message, context)
  }

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleAcceptQuestion = (questionId: string): void => {
    const question = acceptQuestion(questionId)
    if (question) {
      onQuestionsAccepted([question])
    }
  }

  const handleAcceptAll = (): void => {
    const questions = acceptAllQuestions()
    if (questions.length > 0) {
      onQuestionsAccepted(questions)
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            AI Assistant
          </Typography>
          {totalTokensUsed > 0 && (
            <Chip
              label={`${totalTokensUsed.toLocaleString()} tokens`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
        <IconButton size="small">
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        {/* Quick Actions */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowGenerationModal(true)}
              disabled={isGenerating || (unitStandards.length === 0 && otherStandards.length === 0)}
            >
              Generate
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => setShowImportModal(true)}
              disabled={isGenerating}
            >
              Import
            </Button>
            {selectedQuestion && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                disabled={isGenerating}
              >
                Improve
              </Button>
            )}
          </Box>
        </Box>

        {/* Coverage Analysis (Collapsible) */}
        {unitStandards.length > 0 && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
              onClick={() => setShowCoverage(!showCoverage)}
            >
              <Typography variant="subtitle2">Standards Coverage</Typography>
              <IconButton size="small">
                {showCoverage ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={showCoverage}>
              <Box sx={{ px: 2, pb: 2 }}>
                <CoverageAnalysis
                  standards={unitStandards}
                  questions={existingQuestions}
                  onGenerateMissing={handleGenerateMissing}
                  isGenerating={isGenerating}
                />
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Error display */}
        {error && (
          <Alert severity="error" onClose={clearError} sx={{ m: 1 }}>
            {error}
          </Alert>
        )}

        {/* Pending Questions */}
        {pendingQuestions.length > 0 && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="subtitle2">
                Generated Questions ({pendingQuestions.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" onClick={handleAcceptAll}>
                  Accept All
                </Button>
                <Button size="small" color="error" onClick={rejectAllQuestions}>
                  Reject All
                </Button>
              </Box>
            </Box>
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {pendingQuestions.map((question) => (
                <GeneratedQuestionCard
                  key={question.id}
                  question={question}
                  onAccept={() => handleAcceptQuestion(question.id)}
                  onReject={() => rejectQuestion(question.id)}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Conversation */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, minHeight: 200 }}>
          {conversation.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SmartToyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Ask me to generate questions, improve existing ones, or get suggestions for your
                assessment.
              </Typography>
            </Box>
          )}

          {conversation.map((message) => (
            <Box
              key={message.id}
              sx={{
                mb: 2,
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  maxWidth: '85%',
                  bgcolor: message.role === 'user' ? 'primary.main' : 'action.hover',
                  color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  borderRadius: 2
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
                {message.tokenUsage && (
                  <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                    {message.tokenUsage.totalTokens} tokens
                  </Typography>
                )}
              </Paper>
            </Box>
          ))}

          {isGenerating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {streamingProgress || 'Thinking...'}
              </Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask about your assessment..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isGenerating}
              multiline
              maxRows={3}
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isGenerating}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Collapse>

      {/* Question Generation Modal */}
      <QuestionGenerationModal
        isOpen={showGenerationModal}
        onClose={() => setShowGenerationModal(false)}
        courseId={courseId}
        unitId={unitId}
        assessmentId={assessmentId}
        gradeLevel={gradeLevel}
        subject={subject}
        unitStandards={unitStandards}
        otherStandards={otherStandards}
      />

      {/* Question Import Modal */}
      <QuestionImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        gradeLevel={gradeLevel}
        subject={subject}
        onQuestionsImported={onQuestionsAccepted}
      />
    </Paper>
  )
}
