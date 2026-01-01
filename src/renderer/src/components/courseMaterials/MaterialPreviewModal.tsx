import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import { Modal } from '../ui'
import type { CourseMaterial } from '../../../../shared/types'
import { formatFileSize } from '../../../../shared/types'

interface MaterialPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  materialId: string | null
}

export function MaterialPreviewModal({
  isOpen,
  onClose,
  materialId
}: MaterialPreviewModalProps): ReactElement {
  const [material, setMaterial] = useState<CourseMaterial | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && materialId) {
      setIsLoading(true)
      setError(null)

      window.electronAPI
        .invoke<{ success: boolean; data?: CourseMaterial; error?: string }>('material:get', materialId)
        .then((result) => {
          if (result.success && result.data) {
            setMaterial(result.data)
          } else {
            setError(result.error ?? 'Failed to load material')
          }
        })
        .catch((err: Error) => {
          setError(err.message ?? 'Failed to load material')
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setMaterial(null)
      setError(null)
    }
  }, [isOpen, materialId])

  const charCount = material?.extractedText?.length ?? 0
  const wordCount = material?.extractedText?.split(/\s+/).filter(Boolean).length ?? 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={material?.name ?? 'Material Preview'}
      description={material?.originalFileName}
      size="lg"
    >
      <Box sx={{ py: 1 }}>
        {/* Loading */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Content */}
        {material && !isLoading && (
          <>
            {/* Meta info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                label={material.type.toUpperCase()}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                {formatFileSize(material.fileSize)}
              </Typography>
              {material.extractionStatus === 'complete' && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {wordCount.toLocaleString()} words
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {charCount.toLocaleString()} characters
                  </Typography>
                </>
              )}
            </Box>

            {/* Extracted Text */}
            {material.extractionStatus === 'complete' && material.extractedText ? (
              <Box
                sx={{
                  maxHeight: 500,
                  overflowY: 'auto',
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.6
                  }}
                >
                  {material.extractedText}
                </Typography>
              </Box>
            ) : material.extractionStatus === 'failed' ? (
              <Alert severity="error">
                Text extraction failed: {material.extractionError ?? 'Unknown error'}
              </Alert>
            ) : (
              <Alert severity="info">
                Text extraction is still in progress...
              </Alert>
            )}
          </>
        )}
      </Box>
    </Modal>
  )
}
