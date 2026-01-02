import { type ReactElement, useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import WarningIcon from '@mui/icons-material/Warning'
import { Modal } from '../ui'
import { useAssessmentStore } from '../../stores'
import type { AssessmentVariant, AssessmentVersion } from '../../../../shared/types'
import type { DOKLevel } from '../../../../shared/types/roster.types'
import type { BatchVariantConfig } from '../../../../shared/types/ai.types'

interface BatchVariantModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  assessmentId: string
  courseId: string
  gradeLevel: string
  subject: string
  standardRefs: string[]
  existingVariants: AssessmentVariant[]
  existingBaseVersions: AssessmentVersion[] | undefined
}

interface DOKSelection {
  selected: boolean
  exists: boolean
  hasVersions: boolean
}

const DOK_INFO: Record<DOKLevel, { label: string; description: string }> = {
  1: { label: 'DOK 1 - Recall', description: 'Basic recall of facts, terms, definitions' },
  2: { label: 'DOK 2 - Skills', description: 'Use of information with some reasoning' },
  3: { label: 'DOK 3 - Strategic', description: 'Complex reasoning, synthesis, evidence' },
  4: { label: 'DOK 4 - Extended', description: 'Extended reasoning over time' }
}

export function BatchVariantModal({
  isOpen,
  onClose,
  onSuccess,
  assessmentId,
  courseId,
  gradeLevel,
  subject,
  standardRefs,
  existingVariants,
  existingBaseVersions
}: BatchVariantModalProps): ReactElement {
  const { generateBatchVariants, batchGenerating, error: storeError, clearError } =
    useAssessmentStore()

  // DOK selection state (DOK 2 is always disabled as base)
  const [dokSelections, setDokSelections] = useState<Record<DOKLevel, DOKSelection>>({
    1: { selected: false, exists: false, hasVersions: false },
    2: { selected: false, exists: true, hasVersions: false }, // Base
    3: { selected: false, exists: false, hasVersions: false },
    4: { selected: false, exists: false, hasVersions: false }
  })
  const [generateVersions, setGenerateVersions] = useState(true)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Initialize based on existing variants
      const newSelections: Record<DOKLevel, DOKSelection> = {
        1: { selected: false, exists: false, hasVersions: false },
        2: { selected: false, exists: true, hasVersions: !!existingBaseVersions?.length },
        3: { selected: false, exists: false, hasVersions: false },
        4: { selected: false, exists: false, hasVersions: false }
      }

      for (const variant of existingVariants) {
        if (variant.dokLevel !== 2) {
          newSelections[variant.dokLevel] = {
            selected: true, // Pre-check existing
            exists: true,
            hasVersions: !!variant.versions?.length
          }
        }
      }

      setDokSelections(newSelections)
      setGenerateVersions(true)
      clearError()
    }
    // Note: clearError excluded from deps to prevent infinite re-render loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingVariants, existingBaseVersions])

  const handleDOKChange = (dok: DOKLevel, checked: boolean): void => {
    setDokSelections((prev) => ({
      ...prev,
      [dok]: { ...prev[dok], selected: checked }
    }))
  }

  const handleGenerate = async (): Promise<void> => {
    // Build variants array from selections
    // Always use 'questions' strategy - the AI determines the best transformation
    // based on pedagogical soundness (idea spine principle)
    const variants: BatchVariantConfig[] = []
    for (const dokStr of Object.keys(dokSelections)) {
      const dok = Number(dokStr) as DOKLevel
      const selection = dokSelections[dok]
      if (dok !== 2 && selection.selected) {
        variants.push({
          dokLevel: dok,
          strategy: 'questions', // AI intelligently transforms questions while preserving idea spine
          regenerate: selection.exists // Will replace if exists
        })
      }
    }

    // Determine if we need to add versions to existing variants
    const addVersionsToExisting =
      generateVersions &&
      existingVariants.some((v) => !v.versions?.length && !variants.some((nv) => nv.dokLevel === v.dokLevel))

    const result = await generateBatchVariants({
      assessmentId,
      courseId,
      gradeLevel,
      subject,
      standardRefs,
      variants,
      generateVersions,
      addVersionsToExisting
    })

    if (result) {
      onSuccess?.()
      onClose()
    }
  }

  // Calculate summary
  const summary = useMemo(() => {
    const selectedDOKs = Object.entries(dokSelections)
      .filter(([dok, sel]) => Number(dok) !== 2 && sel.selected)
      .map(([dok, sel]) => ({
        dok: Number(dok) as DOKLevel,
        isRegenerate: sel.exists
      }))

    const newVariants = selectedDOKs.filter((s) => !s.isRegenerate).length
    const regenerateVariants = selectedDOKs.filter((s) => s.isRegenerate).length

    // Count existing variants that would get versions added
    const existingWithoutVersions = existingVariants.filter(
      (v) => !v.versions?.length && !selectedDOKs.some((s) => s.dok === v.dokLevel)
    ).length

    // Total version sets: base + selected DOKs + existing without versions
    const versionSets = generateVersions ? 1 + selectedDOKs.length + existingWithoutVersions : 0
    const totalVersions = versionSets * 4 // A, B, C, D

    return {
      selectedDOKs,
      newVariants,
      regenerateVariants,
      totalVersions,
      existingWithoutVersions,
      hasWork: selectedDOKs.length > 0 || (generateVersions && (!existingBaseVersions?.length || existingWithoutVersions > 0))
    }
  }, [dokSelections, generateVersions, existingVariants, existingBaseVersions])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate DOK Variants & Versions" size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {storeError && (
          <Alert severity="error" onClose={clearError}>
            {storeError}
          </Alert>
        )}

        {/* DOK Level Selection */}
        <Box>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            DOK Variants
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which DOK levels to generate. Each changes the cognitive task while preserving
            the same content.
          </Typography>

          <FormGroup>
            {([1, 2, 3, 4] as DOKLevel[]).map((dok) => {
              const selection = dokSelections[dok]
              const isBase = dok === 2

              return (
                <Paper
                  key={dok}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    opacity: isBase ? 0.6 : 1,
                    backgroundColor: isBase ? 'action.hover' : 'background.paper'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isBase ? false : selection.selected}
                        onChange={(e) => handleDOKChange(dok, e.target.checked)}
                        disabled={isBase}
                      />
                    }
                    label={
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {DOK_INFO[dok].label}
                          </Typography>
                          {isBase && (
                            <Chip label="Base Assessment" size="small" color="primary" />
                          )}
                          {!isBase && selection.exists && (
                            <Chip
                              icon={<WarningIcon sx={{ fontSize: 14 }} />}
                              label="Exists (will regenerate)"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {DOK_INFO[dok].description}
                        </Typography>
                      </Box>
                    }
                    sx={{ flex: 1, m: 0 }}
                  />
                </Paper>
              )
            })}
          </FormGroup>
        </Box>

        <Divider />

        {/* Version Generation Option */}
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={generateVersions}
                onChange={(e) => setGenerateVersions(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Create A/B/C/D versions (shuffled for anti-cheat)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Applies to base assessment + all variants (new and existing)
                </Typography>
              </Box>
            }
          />
        </Box>

        <Divider />

        {/* Summary */}
        <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'action.hover' }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Summary
          </Typography>
          {!summary.hasWork ? (
            <Typography variant="body2" color="text.secondary">
              No changes selected. Check DOK levels to generate or enable version generation.
            </Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {summary.newVariants > 0 && (
                <Typography component="li" variant="body2">
                  Generate {summary.newVariants} new DOK variant
                  {summary.newVariants > 1 ? 's' : ''}
                </Typography>
              )}
              {summary.regenerateVariants > 0 && (
                <Typography component="li" variant="body2">
                  Regenerate {summary.regenerateVariants} existing DOK variant
                  {summary.regenerateVariants > 1 ? 's' : ''}
                </Typography>
              )}
              {summary.totalVersions > 0 && (
                <Typography component="li" variant="body2">
                  Create {summary.totalVersions} versions (A/B/C/D for{' '}
                  {1 + summary.selectedDOKs.length + summary.existingWithoutVersions} assessment
                  {1 + summary.selectedDOKs.length + summary.existingWithoutVersions > 1 ? 's' : ''})
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={batchGenerating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={batchGenerating || !summary.hasWork}
          >
            Generate
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
