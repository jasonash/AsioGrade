/**
 * MaterialUploadModal Component
 *
 * Modal for uploading teaching materials to a unit.
 * Supports PDF, DOCX, and TXT files. Text is extracted
 * and stored for AI context during lesson/question generation.
 */

import { type ReactElement, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import CloseIcon from '@mui/icons-material/Close'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DescriptionIcon from '@mui/icons-material/Description'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import ArticleIcon from '@mui/icons-material/Article'
import { useLessonStore } from '../../stores/lesson.store'
import type { UnitMaterial } from '../../../../shared/types'

interface MaterialUploadModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  unitId: string
  unitName: string
  onSuccess?: (material: UnitMaterial) => void
}

type FileType = 'pdf' | 'docx' | 'txt' | 'unknown'

const getFileType = (fileName: string): FileType => {
  const ext = fileName.toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'docx':
    case 'doc':
      return 'docx'
    case 'txt':
      return 'txt'
    default:
      return 'unknown'
  }
}

const getFileIcon = (fileType: FileType): ReactElement => {
  switch (fileType) {
    case 'pdf':
      return <PictureAsPdfIcon sx={{ fontSize: 40, color: 'error.main' }} />
    case 'docx':
      return <ArticleIcon sx={{ fontSize: 40, color: 'info.main' }} />
    case 'txt':
      return <DescriptionIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
    default:
      return <DescriptionIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
  }
}

export function MaterialUploadModal({
  isOpen,
  onClose,
  courseId,
  unitId,
  unitName,
  onSuccess
}: MaterialUploadModalProps): ReactElement {
  const { uploadMaterial, materialsError, clearMaterialsError } = useLessonStore()

  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string } | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleClose = (): void => {
    if (!uploading) {
      setSelectedFile(null)
      setDisplayName('')
      setUploadProgress(0)
      clearMaterialsError()
      onClose()
    }
  }

  const handleFileSelect = async (): Promise<void> => {
    // Use Electron dialog to select file
    try {
      const result = await window.electronAPI.invoke<{
        canceled: boolean
        filePaths: string[]
      }>('import:openMaterialFileDialog')

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'file'
        const fileType = getFileType(fileName)

        if (fileType === 'unknown') {
          // Show error for unsupported file types
          return
        }

        setSelectedFile({ path: filePath, name: fileName })
        // Set default display name from file name (without extension)
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
        setDisplayName(nameWithoutExt)
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
    }
  }

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile || !displayName.trim()) return

    setUploading(true)
    setUploadProgress(10)

    try {
      // Simulate progress while uploading
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 80))
      }, 200)

      const result = await uploadMaterial({
        unitId,
        courseId,
        filePath: selectedFile.path,
        name: displayName.trim()
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (result) {
        // Success - close modal and notify parent
        setTimeout(() => {
          onSuccess?.(result)
          handleClose()
        }, 500)
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  const fileType = selectedFile ? getFileType(selectedFile.name) : null

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Upload Material</Typography>
          <IconButton onClick={handleClose} size="small" disabled={uploading}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Add teaching materials to {unitName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {materialsError && (
          <Alert severity="error" onClose={clearMaterialsError} sx={{ mb: 2 }}>
            {materialsError}
          </Alert>
        )}

        {/* File Drop Zone / Selection */}
        {!selectedFile ? (
          <Box
            onClick={handleFileSelect}
            sx={{
              border: 2,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
          >
            <UploadFileIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="body1" fontWeight={500}>
              Click to select a file
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Supported formats: PDF, DOCX, TXT
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Selected File Preview */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 1
              }}
            >
              {getFileIcon(fileType ?? 'unknown')}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" fontWeight={500} noWrap>
                  {selectedFile.name}
                </Typography>
                <Chip
                  label={fileType?.toUpperCase() ?? 'Unknown'}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Box>
              {!uploading && (
                <Button size="small" onClick={handleFileSelect}>
                  Change
                </Button>
              )}
            </Box>

            {/* Display Name Input */}
            <TextField
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              disabled={uploading}
              helperText="This name will be shown in the materials list"
            />

            {/* Upload Progress */}
            {uploading && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {uploadProgress < 80
                    ? 'Uploading and extracting text...'
                    : uploadProgress < 100
                      ? 'Finalizing...'
                      : 'Complete!'}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Info about materials */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.dark', borderRadius: 1, opacity: 0.9 }}>
          <Typography variant="body2" color="info.contrastText">
            <strong>About Unit Materials</strong>
          </Typography>
          <Typography variant="caption" color="info.contrastText" component="div" sx={{ mt: 0.5 }}>
            Materials you upload are used as context for AI-generated lessons and assessments. The
            AI will reference these materials to create content that aligns with what you've taught.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!selectedFile || !displayName.trim() || uploading}
          startIcon={uploading ? undefined : <UploadFileIcon />}
        >
          {uploading ? 'Uploading...' : 'Upload Material'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
