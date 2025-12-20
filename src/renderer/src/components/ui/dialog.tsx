import * as React from 'react'
import MuiDialog, { type DialogProps as MuiDialogProps } from '@mui/material/Dialog'
import MuiDialogTitle from '@mui/material/DialogTitle'
import MuiDialogContent from '@mui/material/DialogContent'
import MuiDialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import type { SxProps, Theme } from '@mui/material/styles'

interface DialogProps extends Omit<MuiDialogProps, 'open'> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

function Dialog({ open = false, onOpenChange, onClose, children, className, ...props }: DialogProps) {
  const handleClose = (event: object, reason: 'backdropClick' | 'escapeKeyDown') => {
    onClose?.(event, reason)
    onOpenChange?.(false)
  }

  return (
    <MuiDialog
      open={open}
      onClose={handleClose}
      className={className}
      {...props}
    >
      {children}
    </MuiDialog>
  )
}

// DialogTrigger - Not used with MUI, provided for API compatibility
interface DialogTriggerProps {
  children?: React.ReactNode
  asChild?: boolean
}

function DialogTrigger({ children }: DialogTriggerProps) {
  return <>{children}</>
}

// DialogPortal - Not needed with MUI
interface DialogPortalProps {
  children?: React.ReactNode
}

function DialogPortal({ children }: DialogPortalProps) {
  return <>{children}</>
}

// DialogClose - Provided for API compatibility
interface DialogCloseProps {
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}

function DialogClose({ children, onClick }: DialogCloseProps) {
  return (
    <IconButton
      onClick={onClick}
      size="small"
      sx={{
        position: 'absolute',
        right: 8,
        top: 8
      }}
    >
      {children || <CloseIcon fontSize="small" />}
    </IconButton>
  )
}

// DialogOverlay - Not needed with MUI
interface DialogOverlayProps {
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DialogOverlay(_props: DialogOverlayProps) {
  return null
}

interface DialogContentProps {
  children?: React.ReactNode
  className?: string
  showCloseButton?: boolean
  onClose?: () => void
  sx?: SxProps<Theme>
}

function DialogContent({ children, className, showCloseButton = true, onClose, sx }: DialogContentProps) {
  return (
    <MuiDialogContent className={className} sx={{ position: 'relative', ...sx }}>
      {showCloseButton && onClose && (
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute',
            right: 8,
            top: 8
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
      {children}
    </MuiDialogContent>
  )
}

interface DialogHeaderProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function DialogHeader({ children, className, sx }: DialogHeaderProps) {
  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        textAlign: { xs: 'center', sm: 'left' },
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

interface DialogFooterProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function DialogFooter({ children, className, sx }: DialogFooterProps) {
  return (
    <MuiDialogActions
      className={className}
      sx={{
        flexDirection: { xs: 'column-reverse', sm: 'row' },
        gap: 1,
        justifyContent: 'flex-end',
        ...sx
      }}
    >
      {children}
    </MuiDialogActions>
  )
}

interface DialogTitleProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function DialogTitle({ children, className, sx }: DialogTitleProps) {
  return (
    <MuiDialogTitle
      className={className}
      sx={{
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.2,
        ...sx
      }}
    >
      {children}
    </MuiDialogTitle>
  )
}

interface DialogDescriptionProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function DialogDescription({ children, className, sx }: DialogDescriptionProps) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      className={className}
      sx={sx}
    >
      {children}
    </Typography>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
}

export type {
  DialogProps,
  DialogTriggerProps,
  DialogPortalProps,
  DialogCloseProps,
  DialogOverlayProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogFooterProps,
  DialogTitleProps,
  DialogDescriptionProps
}
