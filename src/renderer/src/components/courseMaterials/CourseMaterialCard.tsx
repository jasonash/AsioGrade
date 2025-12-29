import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import DescriptionIcon from '@mui/icons-material/Description'
import SlideshowIcon from '@mui/icons-material/Slideshow'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import type { CourseMaterialSummary, CourseMaterialType } from '../../../../shared/types'
import { formatFileSize } from '../../../../shared/types'
import { Card } from '@/components/ui/card'

interface CourseMaterialCardProps {
  material: CourseMaterialSummary
  onDelete?: () => void
  isDeleting?: boolean
}

function getMaterialIcon(type: CourseMaterialType): ReactElement {
  switch (type) {
    case 'pdf':
      return <PictureAsPdfIcon sx={{ color: '#e53935' }} />
    case 'doc':
    case 'docx':
      return <DescriptionIcon sx={{ color: '#1976d2' }} />
    case 'ppt':
    case 'pptx':
      return <SlideshowIcon sx={{ color: '#ff9800' }} />
    case 'txt':
      return <TextSnippetIcon sx={{ color: '#757575' }} />
    default:
      return <DescriptionIcon />
  }
}

function getTypeLabel(type: CourseMaterialType): string {
  switch (type) {
    case 'pdf':
      return 'PDF'
    case 'doc':
    case 'docx':
      return 'Word'
    case 'ppt':
    case 'pptx':
      return 'PowerPoint'
    case 'txt':
      return 'Text'
  }
}

export function CourseMaterialCard({
  material,
  onDelete,
  isDeleting
}: CourseMaterialCardProps): ReactElement {
  return (
    <Card
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {getMaterialIcon(material.type)}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" fontWeight={600} noWrap>
          {material.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: 'block', mt: 0.25 }}
        >
          {material.originalFileName}
        </Typography>

        {/* Meta info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          <Chip
            label={getTypeLabel(material.type)}
            size="small"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(material.fileSize)}
          </Typography>

          {/* Extraction status */}
          {material.extractionStatus === 'complete' && (
            <Tooltip title="Text extracted successfully">
              <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
            </Tooltip>
          )}
          {material.extractionStatus === 'failed' && (
            <Tooltip title={material.extractionError ?? 'Text extraction failed'}>
              <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
            </Tooltip>
          )}
          {(material.extractionStatus === 'pending' ||
            material.extractionStatus === 'processing') && (
            <Tooltip title="Extracting text...">
              <CircularProgress size={14} />
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ flexShrink: 0 }}>
        <Tooltip title="Delete material">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.()
            }}
            disabled={isDeleting}
            sx={{ color: 'text.secondary' }}
          >
            {isDeleting ? (
              <CircularProgress size={18} />
            ) : (
              <DeleteOutlineIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  )
}
