import { type ReactElement, useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import { Modal } from '../ui'
import { useAssessmentStore } from '../../stores'
import type { VariantStrategy, AssessmentVariant } from '../../../../shared/types'
import type { DOKLevel } from '../../../../shared/types/roster.types'

interface VariantGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (variant: AssessmentVariant) => void
  assessmentId: string
  courseId: string
  gradeLevel: string
  subject: string
  standardRefs: string[]
  existingVariantDOKs: DOKLevel[]
}

const DOK_LEVELS: { value: DOKLevel; label: string; description: string }[] = [
  {
    value: 1,
    label: 'DOK 1 - Recall',
    description: 'Basic recall of facts, terms, definitions, simple procedures'
  },
  {
    value: 2,
    label: 'DOK 2 - Skill/Concept',
    description: 'Use of information, concepts, skills with some reasoning'
  },
  {
    value: 3,
    label: 'DOK 3 - Strategic Thinking',
    description: 'Complex reasoning, planning, synthesis, using evidence'
  },
  {
    value: 4,
    label: 'DOK 4 - Extended Thinking',
    description: 'Complex reasoning over time, designing investigations'
  }
]

const STRATEGIES: { value: VariantStrategy; label: string; description: string }[] = [
  {
    value: 'questions',
    label: 'Generate New Questions',
    description: 'Create entirely new questions at the target DOK level while maintaining the same standard coverage'
  },
  {
    value: 'distractors',
    label: 'Update Distractors Only',
    description: 'Keep question stems unchanged but regenerate distractors appropriate for the target DOK level'
  }
]

export function VariantGenerationModal({
  isOpen,
  onClose,
  onSuccess,
  assessmentId,
  courseId,
  gradeLevel,
  subject,
  standardRefs,
  existingVariantDOKs
}: VariantGenerationModalProps): ReactElement {
  const { generateDOKVariant, generatingVariant, error: storeError, clearError } = useAssessmentStore()

  const [targetDOK, setTargetDOK] = useState<DOKLevel>(2)
  const [strategy, setStrategy] = useState<VariantStrategy>('distractors')

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Find a DOK level that doesn't have a variant yet
      const availableDOKs = DOK_LEVELS.filter((dok) => !existingVariantDOKs.includes(dok.value))
      if (availableDOKs.length > 0) {
        setTargetDOK(availableDOKs[0].value)
      }
      setStrategy('distractors')
      clearError()
    }
  }, [isOpen, existingVariantDOKs, clearError])

  const handleGenerate = async (): Promise<void> => {
    const result = await generateDOKVariant(
      assessmentId,
      courseId,
      targetDOK,
      strategy,
      standardRefs,
      gradeLevel,
      subject
    )

    if (result) {
      onSuccess?.(result)
      onClose()
    }
  }

  const isDOKAlreadyUsed = existingVariantDOKs.includes(targetDOK)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate DOK Variant"
      size="lg"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            DOK Variants are Optional
          </Typography>
          <Typography variant="body2">
            Use variants for <strong>differentiated instruction</strong> when you want to give different
            difficulty levels to different students. Students assigned a DOK level in their roster will
            automatically receive the matching variant; all other students receive the base assessment.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Skip this</strong> if all students should take the same assessment.
          </Typography>
        </Alert>

        {storeError && (
          <Alert severity="error" onClose={clearError}>
            {storeError}
          </Alert>
        )}

        {/* Existing variants indicator */}
        {existingVariantDOKs.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Existing variants:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {existingVariantDOKs.map((dok) => (
                <Chip
                  key={dok}
                  label={`DOK ${dok}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* DOK Level Selection */}
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
            Target DOK Level
          </FormLabel>
          <RadioGroup
            value={targetDOK}
            onChange={(e) => setTargetDOK(Number(e.target.value) as DOKLevel)}
          >
            {DOK_LEVELS.map((dok) => {
              const alreadyExists = existingVariantDOKs.includes(dok.value)
              return (
                <Paper
                  key={dok.value}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    mb: 1,
                    cursor: alreadyExists ? 'not-allowed' : 'pointer',
                    opacity: alreadyExists ? 0.5 : 1,
                    border: targetDOK === dok.value ? '2px solid' : '1px solid',
                    borderColor: targetDOK === dok.value ? 'primary.main' : 'divider',
                    '&:hover': alreadyExists ? {} : { borderColor: 'primary.light' }
                  }}
                  onClick={() => !alreadyExists && setTargetDOK(dok.value)}
                >
                  <FormControlLabel
                    value={dok.value}
                    control={<Radio size="small" disabled={alreadyExists} />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {dok.label}
                          {alreadyExists && (
                            <Chip
                              label="Already exists"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dok.description}
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                    disabled={alreadyExists}
                  />
                </Paper>
              )
            })}
          </RadioGroup>
        </FormControl>

        {/* Strategy Selection */}
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
            Generation Strategy
          </FormLabel>
          <RadioGroup
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as VariantStrategy)}
          >
            {STRATEGIES.map((strat) => (
              <Paper
                key={strat.value}
                variant="outlined"
                sx={{
                  p: 1.5,
                  mb: 1,
                  cursor: 'pointer',
                  border: strategy === strat.value ? '2px solid' : '1px solid',
                  borderColor: strategy === strat.value ? 'primary.main' : 'divider',
                  '&:hover': { borderColor: 'primary.light' }
                }}
                onClick={() => setStrategy(strat.value)}
              >
                <FormControlLabel
                  value={strat.value}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {strat.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {strat.description}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Paper>
            ))}
          </RadioGroup>
        </FormControl>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={generatingVariant}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={generatingVariant || isDOKAlreadyUsed}
            startIcon={generatingVariant ? <CircularProgress size={16} /> : undefined}
          >
            {generatingVariant ? 'Generating...' : 'Generate Variant'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
