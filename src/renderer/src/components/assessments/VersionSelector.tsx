import { type ReactElement, useMemo } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import type { AssessmentVersion, VersionId, Question } from '../../../../shared/types'

interface VersionSelectorProps {
  versions: AssessmentVersion[]
  baseQuestions: Question[]
  selectedVersionId: VersionId | null // null means original order
  onSelectVersion: (versionId: VersionId | null) => void
  disabled?: boolean
}

const VERSION_COLORS: Record<VersionId, 'primary' | 'secondary' | 'success' | 'warning'> = {
  A: 'primary',
  B: 'secondary',
  C: 'success',
  D: 'warning'
}

export function VersionSelector({
  versions,
  baseQuestions,
  selectedVersionId,
  onSelectVersion,
  disabled
}: VersionSelectorProps): ReactElement {
  const handleChange = (_event: React.SyntheticEvent, newValue: string): void => {
    onSelectVersion(newValue === 'original' ? null : (newValue as VersionId))
  }

  // Get current version for answer key preview
  const currentVersion = useMemo(() => {
    if (!selectedVersionId) return null
    return versions.find((v) => v.versionId === selectedVersionId) ?? null
  }, [versions, selectedVersionId])

  // Generate answer key preview for current version
  const answerKeyPreview = useMemo(() => {
    if (!currentVersion) return null

    // Create question map
    const questionMap = new Map(baseQuestions.map((q) => [q.id, q]))

    return currentVersion.questionOrder.slice(0, 10).map((qId, index) => {
      const question = questionMap.get(qId)
      if (!question || question.type !== 'multiple_choice') return null

      const choiceOrder = currentVersion.choiceOrders[qId]
      if (!choiceOrder) return null

      const correctPosition = choiceOrder.indexOf(question.correctAnswer)
      const letters = ['A', 'B', 'C', 'D']
      const correctLetter = correctPosition >= 0 ? letters[correctPosition] : '?'

      return { questionNumber: index + 1, correctLetter }
    }).filter(Boolean) as { questionNumber: number; correctLetter: string }[]
  }, [currentVersion, baseQuestions])

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs
          value={selectedVersionId ?? 'original'}
          onChange={handleChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 48
            }
          }}
        >
          {/* Original Order Tab */}
          <Tab
            value="original"
            disabled={disabled}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  Original Order
                </Typography>
              </Box>
            }
          />

          {/* Version Tabs */}
          {versions.map((version) => (
            <Tab
              key={version.versionId}
              value={version.versionId}
              disabled={disabled}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`Version ${version.versionId}`}
                    size="small"
                    color={VERSION_COLORS[version.versionId]}
                  />
                </Box>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Answer Key Preview */}
      {currentVersion && answerKeyPreview && answerKeyPreview.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Answer Key Preview (Version {currentVersion.versionId}):
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {answerKeyPreview.map((entry) => (
              <Chip
                key={entry.questionNumber}
                label={`${entry.questionNumber}. ${entry.correctLetter}`}
                size="small"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontWeight: 600 }}
              />
            ))}
            {baseQuestions.length > 10 && (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                ... and {baseQuestions.length - 10} more
              </Typography>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  )
}
