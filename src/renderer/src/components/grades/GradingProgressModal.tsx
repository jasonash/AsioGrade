import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import { Modal } from '../ui'
import { useGradeStore } from '../../stores'

interface GradingProgressModalProps {
  isOpen: boolean
  totalPages: number
}

export function GradingProgressModal({
  isOpen,
  totalPages
}: GradingProgressModalProps): ReactElement {
  const { processingProgress, isProcessing } = useGradeStore()

  const currentPage = Math.ceil((processingProgress / 100) * totalPages)

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="Processing Scantrons" size="sm">
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
            variant={isProcessing ? 'indeterminate' : 'determinate'}
            value={processingProgress}
            size={100}
            thickness={4}
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
              {Math.round(processingProgress)}%
            </Typography>
          </Box>
        </Box>

        {/* Status Text */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="subtitle1" gutterBottom>
            {isProcessing ? 'Processing scantrons...' : 'Complete!'}
          </Typography>
          {totalPages > 0 && (
            <Typography variant="body2" color="text.secondary">
              Page {currentPage} of {totalPages}
            </Typography>
          )}
        </Box>

        {/* Linear Progress */}
        <Box sx={{ width: '100%' }}>
          <LinearProgress
            variant={isProcessing ? 'indeterminate' : 'determinate'}
            value={processingProgress}
          />
        </Box>

        {/* Current Operation */}
        <Typography variant="body2" color="text.secondary">
          {isProcessing ? (
            <>
              {processingProgress < 20 && 'Reading QR codes...'}
              {processingProgress >= 20 && processingProgress < 60 && 'Detecting bubbles...'}
              {processingProgress >= 60 && processingProgress < 90 && 'Calculating grades...'}
              {processingProgress >= 90 && 'Finalizing...'}
            </>
          ) : (
            'Processing complete'
          )}
        </Typography>
      </Box>
    </Modal>
  )
}
