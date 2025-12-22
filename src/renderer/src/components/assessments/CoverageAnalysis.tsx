/**
 * CoverageAnalysis Component
 *
 * Visualizes standards coverage for an assessment.
 * Shows which standards have questions and recommends filling gaps.
 */

import { type ReactElement, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import AddIcon from '@mui/icons-material/Add'
import type { Standard } from '../../../../shared/types'
import type { MultipleChoiceQuestion } from '../../../../shared/types/question.types'
import type { CoverageAnalysis as CoverageAnalysisType, StandardCoverage } from '../../../../shared/types/ai.types'

interface CoverageAnalysisProps {
  standards: Standard[]
  questions: MultipleChoiceQuestion[]
  onGenerateMissing: (standardRefs: string[]) => void
  isGenerating?: boolean
}

export function CoverageAnalysis({
  standards,
  questions,
  onGenerateMissing,
  isGenerating = false
}: CoverageAnalysisProps): ReactElement {
  // Calculate coverage analysis
  const analysis: CoverageAnalysisType = useMemo(() => {
    const coverageMap = new Map<string, StandardCoverage>()

    // Initialize all standards as uncovered
    for (const standard of standards) {
      coverageMap.set(standard.code, {
        standardRef: standard.code,
        questionCount: 0,
        totalPoints: 0,
        questionIds: []
      })
    }

    // Count questions per standard
    for (const question of questions) {
      if (question.standardRef) {
        const existing = coverageMap.get(question.standardRef)
        if (existing) {
          existing.questionCount++
          existing.totalPoints += question.points
          existing.questionIds.push(question.id)
        }
      }
    }

    const standardsCovered = Array.from(coverageMap.values()).filter((c) => c.questionCount > 0)
    const standardsUncovered = Array.from(coverageMap.entries())
      .filter(([, c]) => c.questionCount === 0)
      .map(([ref]) => ref)

    // Calculate balance
    let balance: CoverageAnalysisType['balance'] = 'good'
    if (standardsUncovered.length > 0) {
      const coverageRatio = standardsCovered.length / standards.length
      if (coverageRatio < 0.5) {
        balance = 'poor'
      } else if (coverageRatio < 0.8) {
        balance = 'uneven'
      }
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (standardsUncovered.length > 0) {
      recommendations.push(
        `Add questions for ${standardsUncovered.length} uncovered standard${standardsUncovered.length > 1 ? 's' : ''}`
      )
    }

    // Check for uneven distribution
    if (standardsCovered.length > 0) {
      const avgQuestions =
        standardsCovered.reduce((sum, c) => sum + c.questionCount, 0) / standardsCovered.length
      const underrepresented = standardsCovered.filter((c) => c.questionCount < avgQuestions * 0.5)
      if (underrepresented.length > 0) {
        recommendations.push(
          `Consider adding more questions for: ${underrepresented.map((c) => c.standardRef).join(', ')}`
        )
      }
    }

    return {
      standardsCovered,
      standardsUncovered,
      recommendations,
      balance,
      totalQuestions: questions.length,
      totalPoints: questions.reduce((sum, q) => sum + q.points, 0)
    }
  }, [standards, questions])

  // Find max questions for scaling progress bars
  const maxQuestions = Math.max(
    ...analysis.standardsCovered.map((c) => c.questionCount),
    1
  )

  const handleGenerateMissing = (): void => {
    if (analysis.standardsUncovered.length > 0) {
      onGenerateMissing(analysis.standardsUncovered)
    }
  }

  if (standards.length === 0) {
    return (
      <Alert severity="info">
        No standards assigned to this unit. Add standards to see coverage analysis.
      </Alert>
    )
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Standards Coverage
          </Typography>
          <Chip
            label={analysis.balance}
            size="small"
            color={
              analysis.balance === 'good'
                ? 'success'
                : analysis.balance === 'uneven'
                  ? 'warning'
                  : 'error'
            }
            icon={analysis.balance === 'good' ? <CheckCircleIcon /> : <WarningIcon />}
          />
        </Box>

        {/* Coverage bars */}
        <Box sx={{ mb: 2 }}>
          {standards.map((standard) => {
            const coverage = analysis.standardsCovered.find((c) => c.standardRef === standard.code)
            const isCovered = !!coverage && coverage.questionCount > 0
            const progress = coverage ? (coverage.questionCount / maxQuestions) * 100 : 0

            return (
              <Tooltip
                key={standard.code}
                title={`${standard.code}: ${standard.description}`}
                placement="top"
              >
                <Box sx={{ mb: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 0.5
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        color: isCovered ? 'text.primary' : 'text.secondary'
                      }}
                    >
                      {standard.code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {coverage?.questionCount ?? 0} question{(coverage?.questionCount ?? 0) !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: isCovered ? 'primary.main' : 'grey.400'
                      }
                    }}
                  />
                </Box>
              </Tooltip>
            )
          })}
        </Box>

        {/* Summary stats */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 2,
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1
          }}
        >
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h6">{analysis.totalQuestions}</Typography>
            <Typography variant="caption" color="text.secondary">
              Questions
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h6">{analysis.totalPoints}</Typography>
            <Typography variant="caption" color="text.secondary">
              Points
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h6">
              {analysis.standardsCovered.length}/{standards.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Standards
            </Typography>
          </Box>
        </Box>

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {analysis.recommendations.map((rec, index) => (
              <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                {rec}
              </Alert>
            ))}
          </Box>
        )}

        {/* Generate Missing button */}
        {analysis.standardsUncovered.length > 0 && (
          <Button
            variant="outlined"
            fullWidth
            startIcon={isGenerating ? undefined : <AddIcon />}
            onClick={handleGenerateMissing}
            disabled={isGenerating}
          >
            {isGenerating
              ? 'Generating...'
              : `Generate Questions for ${analysis.standardsUncovered.length} Uncovered Standard${analysis.standardsUncovered.length > 1 ? 's' : ''}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
