import * as React from 'react'
import MuiDialog from '@mui/material/Dialog'
import MuiDialogTitle from '@mui/material/DialogTitle'
import MuiDialogContent from '@mui/material/DialogContent'
import MuiDialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Button } from '@/components/ui/button'
import type { SxProps, Theme } from '@mui/material/styles'

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  className?: string
}

function AlertDialog({ open = false, onOpenChange, children, className }: AlertDialogProps) {
  const handleClose = () => {
    onOpenChange?.(false)
  }

  return (
    <MuiDialog
      open={open}
      onClose={handleClose}
      className={className}
      maxWidth="sm"
      fullWidth
    >
      {children}
    </MuiDialog>
  )
}

// AlertDialogTrigger - Not used with MUI, provided for API compatibility
interface AlertDialogTriggerProps {
  children?: React.ReactNode
  asChild?: boolean
}

function AlertDialogTrigger({ children }: AlertDialogTriggerProps) {
  return <>{children}</>
}

// AlertDialogPortal - Not needed with MUI
interface AlertDialogPortalProps {
  children?: React.ReactNode
}

function AlertDialogPortal({ children }: AlertDialogPortalProps) {
  return <>{children}</>
}

// AlertDialogOverlay - Not needed with MUI
interface AlertDialogOverlayProps {
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AlertDialogOverlay(_props: AlertDialogOverlayProps) {
  return null
}

interface AlertDialogContentProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function AlertDialogContent({ children, className, sx }: AlertDialogContentProps) {
  return (
    <MuiDialogContent className={className} sx={sx}>
      {children}
    </MuiDialogContent>
  )
}

interface AlertDialogHeaderProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function AlertDialogHeader({ children, className, sx }: AlertDialogHeaderProps) {
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

interface AlertDialogFooterProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function AlertDialogFooter({ children, className, sx }: AlertDialogFooterProps) {
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

interface AlertDialogTitleProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function AlertDialogTitle({ children, className, sx }: AlertDialogTitleProps) {
  return (
    <MuiDialogTitle
      className={className}
      sx={{
        fontSize: '1.125rem',
        fontWeight: 600,
        ...sx
      }}
    >
      {children}
    </MuiDialogTitle>
  )
}

interface AlertDialogDescriptionProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function AlertDialogDescription({ children, className, sx }: AlertDialogDescriptionProps) {
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

interface AlertDialogActionProps {
  children?: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}

function AlertDialogAction({ children, className, onClick, disabled }: AlertDialogActionProps) {
  return (
    <Button variant="default" className={className} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  )
}

interface AlertDialogCancelProps {
  children?: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}

function AlertDialogCancel({ children, className, onClick, disabled }: AlertDialogCancelProps) {
  return (
    <Button variant="outline" className={className} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
}

export type {
  AlertDialogProps,
  AlertDialogTriggerProps,
  AlertDialogPortalProps,
  AlertDialogOverlayProps,
  AlertDialogContentProps,
  AlertDialogHeaderProps,
  AlertDialogFooterProps,
  AlertDialogTitleProps,
  AlertDialogDescriptionProps,
  AlertDialogActionProps,
  AlertDialogCancelProps
}
