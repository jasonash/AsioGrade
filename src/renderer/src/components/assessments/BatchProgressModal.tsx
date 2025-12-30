import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import { Modal } from '../ui'
import type { BatchGenerationProgress } from '../../../../shared/types/ai.types'

interface BatchProgressModalProps {
  isOpen: boolean
  progress: BatchGenerationProgress | null
}

export function BatchProgressModal({
  isOpen,
  progress
}: BatchProgressModalProps): ReactElement {
  const percentage = progress
    ? Math.round((progress.currentItem / Math.max(progress.totalItems, 1)) * 100)
    : 0

  const isComplete = progress?.stage === 'complete'
  const isError = progress?.stage === 'error'

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="Generating Variants" size="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          py: 4
        }}
      >
        {/* Progress Circle */}
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress
            variant={isComplete || isError ? 'determinate' : 'indeterminate'}
            value={isComplete ? 100 : percentage}
            size={100}
            thickness={4}
            color={isError ? 'error' : isComplete ? 'success' : 'primary'}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography variant="h5" component="span" color="text.secondary">
              {isComplete ? '100' : percentage}%
            </Typography>
          </Box>
        </Box>

        {/* Status Text */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="subtitle1" gutterBottom>
            {progress?.message ?? 'Preparing...'}
          </Typography>
          {progress && progress.totalItems > 0 && !isComplete && !isError && (
            <Typography variant="body2" color="text.secondary">
              Step {progress.currentItem} of {progress.totalItems}
            </Typography>
          )}
        </Box>

        {/* Linear Progress */}
        <Box sx={{ width: '100%' }}>
          <LinearProgress
            variant={isComplete || isError ? 'determinate' : 'indeterminate'}
            value={isComplete ? 100 : percentage}
            color={isError ? 'error' : isComplete ? 'success' : 'primary'}
          />
        </Box>

        {/* Stage indicator */}
        <Typography variant="body2" color="text.secondary">
          {progress?.stage === 'preparing' && 'Loading assessment data...'}
          {progress?.stage === 'generating_variant' &&
            `Generating DOK ${progress.dokLevel} variant...`}
          {progress?.stage === 'generating_versions' && 'Creating A/B/C/D versions...'}
          {progress?.stage === 'saving' && 'Saving changes...'}
          {progress?.stage === 'complete' && 'Generation complete!'}
          {progress?.stage === 'error' && 'An error occurred'}
        </Typography>
      </Box>
    </Modal>
  )
}
