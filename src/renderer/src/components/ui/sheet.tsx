import * as React from 'react'
import Drawer, { type DrawerProps } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import type { SxProps, Theme } from '@mui/material/styles'

type SheetSide = 'top' | 'right' | 'bottom' | 'left'

interface SheetProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface SheetContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

function Sheet({ children, open: controlledOpen, onOpenChange }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  )
}

interface SheetTriggerProps {
  children?: React.ReactNode
  asChild?: boolean
  className?: string
}

function SheetTrigger({ children, className }: SheetTriggerProps) {
  const context = React.useContext(SheetContext)

  const handleClick = () => {
    context?.setOpen(true)
  }

  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      onClick: handleClick
    })
  }

  return (
    <span className={className} onClick={handleClick}>
      {children}
    </span>
  )
}

interface SheetCloseProps {
  children?: React.ReactNode
  className?: string
}

function SheetClose({ children, className }: SheetCloseProps) {
  const context = React.useContext(SheetContext)

  const handleClick = () => {
    context?.setOpen(false)
  }

  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      onClick: handleClick
    })
  }

  return (
    <IconButton
      onClick={handleClick}
      className={className}
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

const anchorMap: Record<SheetSide, DrawerProps['anchor']> = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left'
}

interface SheetContentProps {
  children?: React.ReactNode
  className?: string
  side?: SheetSide
  sx?: SxProps<Theme>
  style?: React.CSSProperties
}

function SheetContent({ children, className, side = 'right', sx, style }: SheetContentProps) {
  const context = React.useContext(SheetContext)

  const handleClose = () => {
    context?.setOpen(false)
  }

  const isHorizontal = side === 'left' || side === 'right'

  const paperSx: SxProps<Theme> = {
    width: isHorizontal ? { xs: '75%', sm: 320 } : '100%',
    height: !isHorizontal ? 'auto' : '100%',
    ...(sx as object)
  }

  return (
    <Drawer
      anchor={anchorMap[side]}
      open={context?.open || false}
      onClose={handleClose}
      className={className}
      PaperProps={{ style }}
      sx={{
        '& .MuiDrawer-paper': paperSx
      }}
    >
      <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        {children}
      </Box>
    </Drawer>
  )
}

interface SheetHeaderProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function SheetHeader({ children, className, sx }: SheetHeaderProps) {
  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        p: 2,
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

interface SheetFooterProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function SheetFooter({ children, className, sx }: SheetFooterProps) {
  return (
    <Box
      className={className}
      sx={{
        mt: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

interface SheetTitleProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function SheetTitle({ children, className, sx }: SheetTitleProps) {
  return (
    <Typography
      variant="h6"
      className={className}
      sx={{
        fontWeight: 600,
        ...sx
      }}
    >
      {children}
    </Typography>
  )
}

interface SheetDescriptionProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function SheetDescription({ children, className, sx }: SheetDescriptionProps) {
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
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription
}

export type {
  SheetProps,
  SheetTriggerProps,
  SheetCloseProps,
  SheetContentProps,
  SheetHeaderProps,
  SheetFooterProps,
  SheetTitleProps,
  SheetDescriptionProps,
  SheetSide
}
