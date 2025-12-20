import type { ReactElement } from 'react'
import MuiDialog from '@mui/material/Dialog'
import MuiDialogContent from '@mui/material/DialogContent'
import MuiDialogTitle from '@mui/material/DialogTitle'
import MuiDialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { Button } from './button'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'danger'
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false
}: ConfirmModalProps): ReactElement {
  const isDestructive = variant === 'destructive' || variant === 'danger'

  return (
    <MuiDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <MuiDialogTitle sx={{ fontWeight: 600 }}>
        {title}
      </MuiDialogTitle>
      <MuiDialogContent>
        <Typography color="text.secondary">
          {message}
        </Typography>
      </MuiDialogContent>
      <MuiDialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={isDestructive ? 'destructive' : 'default'}
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading && (
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              <CircularProgress size={16} color="inherit" />
            </Box>
          )}
          {confirmText}
        </Button>
      </MuiDialogActions>
    </MuiDialog>
  )
}
