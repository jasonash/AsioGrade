import { type ReactElement, useState, useCallback, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import { Modal } from '../ui'
import { useGradeStore } from '../../stores'
import type { Assignment } from '../../../../shared/types'

interface ScantronUploadModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: Assignment | null
  onProcessingComplete: () => void
}

export function ScantronUploadModal({
  isOpen,
  onClose,
  assignment,
  onProcessingComplete
}: ScantronUploadModalProps): ReactElement {
  const { processScantron, isProcessing, progressEvent, error: storeError, clearError, clearGrades } = useGradeStore()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null)
      setIsDragging(false)
      clearError()
      clearGrades()
    }
  }, [isOpen, clearError, clearGrades])

  const handleFileSelect = useCallback((file: File) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setSelectedFile(file)
    }
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleProcess = useCallback(async () => {
    if (!selectedFile || !assignment) return

    // Read file as base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]

      const result = await processScantron({
        assignmentId: assignment.id,
        sectionId: assignment.sectionId,
        pdfBase64: base64
      })

      if (result && result.success) {
        onProcessingComplete()
        onClose()
      }
    }
    reader.readAsDataURL(selectedFile)
  }, [selectedFile, assignment, processScantron, onProcessingComplete, onClose])

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      onClose()
    }
  }, [isProcessing, onClose])

  if (!assignment) return <></>

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Scanned Scantrons" size="md">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Store error */}
        {storeError && <Alert severity="error">{storeError}</Alert>}

        {/* Assignment Info */}
        <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            {assignment.assessmentTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {assignment.questionCount} questions | {assignment.studentAssignments.length} student
            {assignment.studentAssignments.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Upload Zone */}
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          sx={{
            border: 2,
            borderStyle: 'dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragging ? 'action.hover' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover'
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          {selectedFile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <InsertDriveFileIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              <Typography variant="subtitle1">{selectedFile.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </Typography>
              <Button size="small" onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}>
                Remove
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography variant="subtitle1">
                Drop your scanned PDF here
              </Typography>
              <Typography variant="body2" color="text.secondary">
                or click to browse
              </Typography>
            </Box>
          )}
        </Box>

        {/* Instructions */}
        {!isProcessing && (
          <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '0.875rem' } }}>
            Upload a PDF file containing scanned scantron answer sheets. Each page should contain one
            student&apos;s scantron with a visible QR code.
          </Alert>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant={progressEvent?.totalPages ? 'determinate' : 'indeterminate'}
                  value={progressEvent?.totalPages
                    ? (progressEvent.currentPage / progressEvent.totalPages) * 100
                    : undefined
                  }
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
              {progressEvent?.totalPages ? (
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 50 }}>
                  {Math.round((progressEvent.currentPage / progressEvent.totalPages) * 100)}%
                </Typography>
              ) : null}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              {progressEvent?.message || 'Initializing...'}
            </Typography>
          </Box>
        )}

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Button variant="outlined" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleProcess}
            disabled={!selectedFile || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Process Scantrons'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
