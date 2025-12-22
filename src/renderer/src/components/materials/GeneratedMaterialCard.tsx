/**
 * GeneratedMaterialCard Component
 *
 * Displays a generated material with actions for download, regenerate, and delete.
 */

import { type ReactElement, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DescriptionIcon from '@mui/icons-material/Description'
import GridOnIcon from '@mui/icons-material/GridOn'
import ExtensionIcon from '@mui/icons-material/Extension'
import ListAltIcon from '@mui/icons-material/ListAlt'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ImageIcon from '@mui/icons-material/Image'
import AssignmentIcon from '@mui/icons-material/Assignment'
import CalculateIcon from '@mui/icons-material/Calculate'
import type { GeneratedMaterial, GeneratedMaterialType } from '../../../../shared/types/material.types'

interface GeneratedMaterialCardProps {
  material: GeneratedMaterial
  onDownload: (material: GeneratedMaterial) => void
  onDelete: (materialId: string) => void
  onRegenerate?: (material: GeneratedMaterial) => void
  isDownloading?: boolean
  compact?: boolean
}

const MATERIAL_ICONS: Record<GeneratedMaterialType, ReactElement> = {
  worksheet: <DescriptionIcon />,
  'word-search': <GridOnIcon />,
  crossword: <ExtensionIcon />,
  'vocabulary-list': <ListAltIcon />,
  'graphic-organizer': <AccountTreeIcon />,
  diagram: <ImageIcon />,
  'exit-ticket': <AssignmentIcon />,
  'practice-problems': <CalculateIcon />
}

const MATERIAL_COLORS: Record<GeneratedMaterialType, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error'> = {
  worksheet: 'primary',
  'word-search': 'secondary',
  crossword: 'secondary',
  'vocabulary-list': 'info',
  'graphic-organizer': 'success',
  diagram: 'warning',
  'exit-ticket': 'error',
  'practice-problems': 'primary'
}

const MATERIAL_LABELS: Record<GeneratedMaterialType, string> = {
  worksheet: 'Worksheet',
  'word-search': 'Word Search',
  crossword: 'Crossword',
  'vocabulary-list': 'Vocabulary',
  'graphic-organizer': 'Graphic Org.',
  diagram: 'Diagram',
  'exit-ticket': 'Exit Ticket',
  'practice-problems': 'Problems'
}

export function GeneratedMaterialCard({
  material,
  onDownload,
  onDelete,
  onRegenerate,
  isDownloading = false,
  compact = false
}: GeneratedMaterialCardProps): ReactElement {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(menuAnchor)

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>): void => {
    setMenuAnchor(event.currentTarget)
  }

  const handleMenuClose = (): void => {
    setMenuAnchor(null)
  }

  const handleDownload = (): void => {
    handleMenuClose()
    onDownload(material)
  }

  const handleDelete = (): void => {
    handleMenuClose()
    onDelete(material.id)
  }

  const handleRegenerate = (): void => {
    handleMenuClose()
    onRegenerate?.(material)
  }

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1,
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
      >
        <Box sx={{ color: `${MATERIAL_COLORS[material.type]}.main` }}>
          {MATERIAL_ICONS[material.type]}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap fontWeight={500}>
            {material.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {MATERIAL_LABELS[material.type]} - {formatDate(material.generatedAt)}
          </Typography>
        </Box>
        <Tooltip title="Download PDF">
          <IconButton size="small" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={handleMenuOpen}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={menuOpen} onClose={handleMenuClose}>
          {onRegenerate && (
            <MenuItem onClick={handleRegenerate}>
              <ListItemIcon>
                <RefreshIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Regenerate</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    )
  }

  return (
    <Card
      elevation={1}
      sx={{
        transition: 'all 0.2s',
        '&:hover': {
          elevation: 3,
          transform: 'translateY(-2px)'
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          {/* Icon */}
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: `${MATERIAL_COLORS[material.type]}.main`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {MATERIAL_ICONS[material.type]}
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {material.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {material.topic}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Chip
                label={MATERIAL_LABELS[material.type]}
                size="small"
                color={MATERIAL_COLORS[material.type]}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                {formatDate(material.generatedAt)}
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Download PDF">
              <IconButton
                size="small"
                onClick={handleDownload}
                disabled={isDownloading}
                color="primary"
              >
                {isDownloading ? <CircularProgress size={18} /> : <DownloadIcon />}
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>
      </CardContent>

      <Menu anchorEl={menuAnchor} open={menuOpen} onClose={handleMenuClose}>
        <MenuItem onClick={handleDownload}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download PDF</ListItemText>
        </MenuItem>
        {onRegenerate && (
          <MenuItem onClick={handleRegenerate}>
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Regenerate</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  )
}
