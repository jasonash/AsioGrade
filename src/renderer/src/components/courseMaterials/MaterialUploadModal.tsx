import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import { Modal } from '../ui'
import { useCourseMaterialStore } from '../../stores'
import type { CourseMaterial, ServiceResult } from '../../../../shared/types'

interface MaterialUploadModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
  onSuccess?: (material: CourseMaterial) => void
}

export function MaterialUploadModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  onSuccess
}: MaterialUploadModalProps): ReactElement {
  const { uploadMaterial, isUploading, error: storeError, clearError } = useCourseMaterialStore()

  const [name, setName] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setFilePath(null)
      setFileName(null)
      setLocalError(null)
      clearError()
    }
  }, [isOpen, clearError])

  const handleSelectFile = useCallback(async () => {
    try {
      setLocalError(null)
      const result = await window.electronAPI.invoke<ServiceResult<string | null>>(
        'import:openMaterialFileDialog'
      )

      if (result.success && result.data) {
        setFilePath(result.data)
        // Extract filename from path
        const pathParts = result.data.split(/[/\\]/)
        const file = pathParts[pathParts.length - 1]
        setFileName(file)

        // Auto-fill name if empty (remove extension)
        if (!name) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '')
          setName(nameWithoutExt)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select file'
      setLocalError(message)
    }
  }, [name])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLocalError(null)

      if (!filePath) {
        setLocalError('Please select a file to upload')
        return
      }

      if (!name.trim()) {
        setLocalError('Please enter a name for the material')
        return
      }

      const material = await uploadMaterial(courseId, filePath, name.trim())

      if (material) {
        onSuccess?.(material)
        onClose()
      }
    },
    [filePath, name, courseId, uploadMaterial, onSuccess, onClose]
  )

  const displayError = localError ?? storeError

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Course Material" size="md">
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        {/* Info */}
        <Typography variant="body2" color="text.secondary">
          Upload a document to use as reference material for {courseName}. The text will be
          extracted automatically for use with AI-powered question generation.
        </Typography>

        {/* Error */}
        {displayError && <Alert severity="error">{displayError}</Alert>}

        {/* File Selection */}
        <Box
          onClick={handleSelectFile}
          sx={{
            border: 2,
            borderColor: filePath ? 'primary.main' : 'divider',
            borderStyle: 'dashed',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background-color 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover'
            }
          }}
        >
          {filePath ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
              <InsertDriveFileIcon sx={{ color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={500}>
                {fileName}
              </Typography>
            </Box>
          ) : (
            <>
              <UploadFileIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Click to select a file
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Supports PDF, Word (.doc, .docx), and Text (.txt)
              </Typography>
            </>
          )}
        </Box>

        {/* Material Name */}
        <TextField
          label="Material Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Chapter 1 Notes, Unit 3 Textbook"
          disabled={isUploading}
          size="small"
          fullWidth
          helperText="A descriptive name for this material"
        />

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
          <Button variant="outlined" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isUploading || !filePath}
            startIcon={isUploading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
          >
            {isUploading ? 'Uploading...' : 'Upload Material'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
