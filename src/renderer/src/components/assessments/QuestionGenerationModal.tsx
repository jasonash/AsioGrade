/**
 * QuestionGenerationModal Component
 *
 * Modal for configuring AI question generation parameters.
 * Shows course standards grouped by domain with full descriptions and keywords.
 */

import { type ReactElement, useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DescriptionIcon from '@mui/icons-material/Description'
import { Modal } from '../ui'
import { useAIStore, useCourseMaterialStore } from '../../stores'
import type { Standards, StandardDomain, Standard } from '../../../../shared/types'
import type {
  QuestionDifficulty,
  QuestionGenerationRequest
} from '../../../../shared/types/ai.types'
import type { AssessmentType } from '../../../../shared/types'
import { QUIZ_MAX_QUESTIONS } from '../../../../shared/types/assessment.types'

// Flattened standard with domain context and global index
interface IndexedStandard {
  index: number
  standard: Standard
  domainCode: string
  domainName: string
}

interface QuestionGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  assessmentId: string
  gradeLevel: string
  subject: string
  collections: Standards[]
  assessmentType?: AssessmentType
  existingQuestionCount?: number
  /** Taught content from assessment - defines scope for question generation */
  assessmentTaughtContent?: string
}

export function QuestionGenerationModal({
  isOpen,
  onClose,
  courseId,
  assessmentId,
  gradeLevel,
  subject,
  collections,
  assessmentType,
  existingQuestionCount = 0,
  assessmentTaughtContent
}: QuestionGenerationModalProps): ReactElement {
  const { generateQuestions, isGenerating } = useAIStore()
  const { materials, fetchMaterials } = useCourseMaterialStore()

  // Quiz-specific constraints
  const isQuiz = assessmentType === 'quiz'
  const remainingQuizSlots = isQuiz ? Math.max(0, QUIZ_MAX_QUESTIONS - existingQuestionCount) : 20
  const maxQuestionsAllowed = isQuiz ? remainingQuizSlots : 20

  const [questionCount, setQuestionCount] = useState(Math.min(5, maxQuestionsAllowed))
  // Use indices for selection to handle duplicate codes
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('mixed')
  const [focusTopics, setFocusTopics] = useState('')
  const [taughtContentOverride, setTaughtContentOverride] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())

  // Build flattened list with domain context and organize by domain
  const { indexedStandards, domainGroups, totalCount } = useMemo(() => {
    const indexed: IndexedStandard[] = []
    const groups: Map<string, { domain: StandardDomain; standards: IndexedStandard[]; collectionName: string }> = new Map()
    let globalIndex = 0

    for (const collection of collections) {
      for (const domain of collection.domains) {
        const domainKey = `${collection.id}-${domain.code}`
        const domainStandards: IndexedStandard[] = []

        for (const standard of domain.standards) {
          const indexedStd: IndexedStandard = {
            index: globalIndex,
            standard,
            domainCode: domain.code,
            domainName: domain.name
          }
          indexed.push(indexedStd)
          domainStandards.push(indexedStd)
          globalIndex++
        }

        if (domainStandards.length > 0) {
          groups.set(domainKey, {
            domain,
            standards: domainStandards,
            collectionName: collection.name
          })
        }
      }
    }

    return { indexedStandards: indexed, domainGroups: groups, totalCount: globalIndex }
  }, [collections])

  // Fetch materials and initialize standards when modal opens
  useEffect(() => {
    if (isOpen) {
      // Select all standards by index
      setSelectedIndices(new Set(indexedStandards.map((s) => s.index)))
      setSelectedMaterials(new Set())
      setCustomPrompt('')
      setExpandedDomains(new Set())
      fetchMaterials(courseId)
    }
  }, [isOpen, indexedStandards, courseId, fetchMaterials])

  // Filter to only show materials with successful extraction
  const availableMaterials = materials.filter(
    (m) => m.extractionStatus === 'complete'
  )

  const handleStandardToggle = (index: number): void => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleDomainToggle = (domainKey: string): void => {
    const group = domainGroups.get(domainKey)
    if (!group) return

    const domainIndices = group.standards.map((s) => s.index)
    const allSelected = domainIndices.every((i) => selectedIndices.has(i))

    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        // Deselect all in domain
        for (const idx of domainIndices) {
          next.delete(idx)
        }
      } else {
        // Select all in domain
        for (const idx of domainIndices) {
          next.add(idx)
        }
      }
      return next
    })
  }

  const handleExpandDomain = (domainKey: string): void => {
    setExpandedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domainKey)) {
        next.delete(domainKey)
      } else {
        next.add(domainKey)
      }
      return next
    })
  }

  const handleMaterialToggle = (id: string): void => {
    setSelectedMaterials((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = (): void => {
    setSelectedIndices(new Set(indexedStandards.map((s) => s.index)))
  }

  const handleSelectNone = (): void => {
    setSelectedIndices(new Set())
  }

  const handleSelectAllMaterials = (): void => {
    setSelectedMaterials(new Set(availableMaterials.map((m) => m.id)))
  }

  const handleSelectNoMaterials = (): void => {
    setSelectedMaterials(new Set())
  }

  const handleGenerate = async (): Promise<void> => {
    if (selectedIndices.size === 0) return

    // Convert selected indices to standard codes
    const selectedCodes = [...selectedIndices].map((i) => indexedStandards[i].standard.code)

    // Use override if provided, otherwise use assessment's taught content
    const effectiveTaughtContent = taughtContentOverride.trim() || assessmentTaughtContent

    const request: QuestionGenerationRequest = {
      courseId,
      assessmentId,
      standardRefs: selectedCodes,
      questionCount,
      questionTypes: ['multiple_choice'],
      difficulty,
      gradeLevel,
      subject,
      focusTopics: focusTopics ? focusTopics.split(',').map((t) => t.trim()) : undefined,
      // Taught content defines what can be assessed
      taughtContent: effectiveTaughtContent || undefined,
      // Materials provide context for wording/examples (not scope expansion)
      materialIds: selectedMaterials.size > 0 ? [...selectedMaterials] : undefined,
      customPrompt: customPrompt.trim() || undefined
    }

    await generateQuestions(request)
    onClose()
  }

  // Check if all standards in a domain are selected
  const isDomainFullySelected = (domainKey: string): boolean => {
    const group = domainGroups.get(domainKey)
    if (!group) return false
    return group.standards.every((s) => selectedIndices.has(s.index))
  }

  // Check if some standards in a domain are selected
  const isDomainPartiallySelected = (domainKey: string): boolean => {
    const group = domainGroups.get(domainKey)
    if (!group) return false
    const selectedCount = group.standards.filter((s) => selectedIndices.has(s.index)).length
    return selectedCount > 0 && selectedCount < group.standards.length
  }

  // Count selected in domain
  const getSelectedCountInDomain = (domainKey: string): number => {
    const group = domainGroups.get(domainKey)
    if (!group) return 0
    return group.standards.filter((s) => selectedIndices.has(s.index)).length
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Questions"
      description="Select standards and configure generation settings"
      size="lg"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
        {/* Question Count */}
        <TextField
          label="Number of Questions"
          type="number"
          value={questionCount}
          onChange={(e) =>
            setQuestionCount(Math.max(1, Math.min(maxQuestionsAllowed, parseInt(e.target.value) || 1)))
          }
          inputProps={{ min: 1, max: maxQuestionsAllowed }}
          helperText={
            isQuiz
              ? remainingQuizSlots === 0
                ? 'Quiz is at maximum capacity (10 questions)'
                : `Generate 1-${remainingQuizSlots} questions (quiz limit: ${existingQuestionCount}/${QUIZ_MAX_QUESTIONS})`
              : 'Generate 1-20 questions at a time'
          }
          disabled={isQuiz && remainingQuizSlots === 0}
          error={isQuiz && remainingQuizSlots === 0}
        />

        {/* Standards Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">
              Standards ({selectedIndices.size}/{totalCount} selected)
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

          {totalCount === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No standards assigned to this course. Add standards to the course first.
            </Typography>
          ) : (
            <Box
              sx={{
                maxHeight: 350,
                overflowY: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              {[...domainGroups.entries()].map(([domainKey, { domain, standards: domainStandards }]) => (
                <Accordion
                  key={domainKey}
                  expanded={expandedDomains.has(domainKey)}
                  onChange={() => handleExpandDomain(domainKey)}
                  disableGutters
                  sx={{
                    '&:before': { display: 'none' },
                    boxShadow: 'none',
                    '&:not(:last-child)': {
                      borderBottom: 1,
                      borderColor: 'divider'
                    }
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 1,
                        my: 1
                      }
                    }}
                  >
                    <Checkbox
                      checked={isDomainFullySelected(domainKey)}
                      indeterminate={isDomainPartiallySelected(domainKey)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleDomainToggle(domainKey)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      size="small"
                    />
                    <Chip
                      label={domain.code}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 500 }}
                    />
                    <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                      {domain.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getSelectedCountInDomain(domainKey)}/{domainStandards.length}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, pb: 1, px: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 4 }}>
                      {domainStandards.map(({ index, standard }) => (
                        <Paper
                          key={index}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                          onClick={() => handleStandardToggle(index)}
                        >
                          <Checkbox
                            checked={selectedIndices.has(index)}
                            onChange={() => handleStandardToggle(index)}
                            onClick={(e) => e.stopPropagation()}
                            size="small"
                            sx={{ mt: -0.5 }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Chip
                                label={standard.code}
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 500 }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                              {standard.description}
                            </Typography>
                            {standard.keywords && standard.keywords.length > 0 && (
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {standard.keywords.slice(0, 5).map((keyword) => (
                                  <Chip
                                    key={keyword}
                                    label={keyword}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 18 }}
                                  />
                                ))}
                                {standard.keywords.length > 5 && (
                                  <Chip
                                    label={`+${standard.keywords.length - 5}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 18 }}
                                  />
                                )}
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </Box>

        {/* Course Materials Section (Phase 4) */}
        {availableMaterials.length > 0 && (
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">
                  Course Materials ({selectedMaterials.size}/{availableMaterials.length} selected)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Select materials to use as context for question generation
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
                <Button size="small" onClick={handleSelectAllMaterials}>
                  All
                </Button>
                <Button size="small" onClick={handleSelectNoMaterials}>
                  None
                </Button>
              </Box>
              <Box
                sx={{
                  maxHeight: 150,
                  overflowY: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1
                }}
              >
                {availableMaterials.map((material) => (
                  <Box
                    key={material.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 1,
                      px: 0.5
                    }}
                    onClick={() => handleMaterialToggle(material.id)}
                  >
                    <Checkbox
                      checked={selectedMaterials.has(material.id)}
                      onChange={() => handleMaterialToggle(material.id)}
                      onClick={(e) => e.stopPropagation()}
                      size="small"
                    />
                    <Typography variant="body2">
                      {material.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Difficulty */}
        <TextField
          select
          label="Difficulty Level"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
        >
          <MenuItem value="easy">Easy</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="hard">Hard</MenuItem>
          <MenuItem value="mixed">Mixed (Recommended)</MenuItem>
        </TextField>

        {/* Focus Topics */}
        <TextField
          label="Focus Topics (optional)"
          value={focusTopics}
          onChange={(e) => setFocusTopics(e.target.value)}
          placeholder="e.g., photosynthesis, cell division"
          helperText="Comma-separated list of topics to emphasize"
        />

        {/* Taught Content Override */}
        <TextField
          label="Taught Content (for this generation)"
          value={taughtContentOverride}
          onChange={(e) => setTaughtContentOverride(e.target.value)}
          placeholder={assessmentTaughtContent || "List what was explicitly taught - this defines what can be assessed"}
          helperText={
            assessmentTaughtContent
              ? "Leave empty to use assessment's taught content, or enter here to override for this generation"
              : "Define what was taught - AI will only generate questions about this content"
          }
          multiline
          rows={3}
        />

        {/* Custom Prompt */}
        <TextField
          label="Custom Instructions (optional)"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="e.g., Focus on application questions, avoid vocabulary-only questions, include real-world scenarios..."
          helperText="Additional instructions for the AI when generating questions"
          multiline
          rows={2}
        />

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={isGenerating || selectedIndices.size === 0 || (isQuiz && remainingQuizSlots === 0)}
            startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isGenerating ? 'Generating...' : `Generate (${selectedIndices.size} standards)`}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
