import * as React from 'react'
import Menu, { type MenuProps } from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import Radio from '@mui/material/Radio'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { SxProps, Theme } from '@mui/material/styles'

interface DropdownMenuProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface DropdownMenuContextValue {
  anchorEl: HTMLElement | null
  setAnchorEl: (el: HTMLElement | null) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null)

function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
      if (!newOpen) {
        setAnchorEl(null)
      }
    },
    [isControlled, onOpenChange]
  )

  return (
    <DropdownMenuContext.Provider value={{ anchorEl, setAnchorEl, open, setOpen }}>
      {children}
    </DropdownMenuContext.Provider>
  )
}

interface DropdownMenuTriggerProps {
  children?: React.ReactNode
  asChild?: boolean
  className?: string
}

function DropdownMenuTrigger({ children, className }: DropdownMenuTriggerProps) {
  const context = React.useContext(DropdownMenuContext)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    context?.setAnchorEl(event.currentTarget)
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

interface DropdownMenuContentProps extends Omit<MenuProps, 'open' | 'anchorEl'> {
  children?: React.ReactNode
  className?: string
  sideOffset?: number
}

function DropdownMenuContent({ children, className, sx, ...props }: DropdownMenuContentProps) {
  const context = React.useContext(DropdownMenuContext)

  const handleClose = () => {
    context?.setOpen(false)
  }

  return (
    <Menu
      anchorEl={context?.anchorEl}
      open={context?.open || false}
      onClose={handleClose}
      className={className}
      sx={{
        '& .MuiPaper-root': {
          minWidth: 160,
          borderRadius: 1.5
        },
        ...sx
      }}
      {...props}
    >
      {children}
    </Menu>
  )
}

// Portal - Not needed with MUI
interface DropdownMenuPortalProps {
  children?: React.ReactNode
}

function DropdownMenuPortal({ children }: DropdownMenuPortalProps) {
  return <>{children}</>
}

interface DropdownMenuGroupProps {
  children?: React.ReactNode
}

function DropdownMenuGroup({ children }: DropdownMenuGroupProps) {
  return <>{children}</>
}

interface DropdownMenuItemProps {
  children?: React.ReactNode
  className?: string
  inset?: boolean
  variant?: 'default' | 'destructive'
  disabled?: boolean
  onClick?: () => void
  sx?: SxProps<Theme>
}

function DropdownMenuItem({ children, className, variant, disabled, onClick, sx }: DropdownMenuItemProps) {
  const context = React.useContext(DropdownMenuContext)

  const handleClick = () => {
    onClick?.()
    context?.setOpen(false)
  }

  return (
    <MenuItem
      onClick={handleClick}
      disabled={disabled}
      className={className}
      sx={{
        fontSize: '0.875rem',
        py: 0.75,
        ...(variant === 'destructive' && {
          color: 'error.main',
          '&:hover': {
            bgcolor: 'error.light',
            color: 'error.contrastText'
          }
        }),
        ...sx
      }}
    >
      {children}
    </MenuItem>
  )
}

interface DropdownMenuCheckboxItemProps {
  children?: React.ReactNode
  className?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

function DropdownMenuCheckboxItem({
  children,
  className,
  checked,
  onCheckedChange,
  disabled
}: DropdownMenuCheckboxItemProps) {
  return (
    <MenuItem
      onClick={() => onCheckedChange?.(!checked)}
      disabled={disabled}
      className={className}
      sx={{ fontSize: '0.875rem', py: 0.75 }}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Checkbox checked={checked} size="small" />
      </ListItemIcon>
      <ListItemText>{children}</ListItemText>
    </MenuItem>
  )
}

interface DropdownMenuRadioGroupProps {
  children?: React.ReactNode
  value?: string
  onValueChange?: (value: string) => void
}

const RadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
} | null>(null)

function DropdownMenuRadioGroup({ children, value, onValueChange }: DropdownMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      {children}
    </RadioGroupContext.Provider>
  )
}

interface DropdownMenuRadioItemProps {
  children?: React.ReactNode
  className?: string
  value: string
  disabled?: boolean
}

function DropdownMenuRadioItem({ children, className, value, disabled }: DropdownMenuRadioItemProps) {
  const context = React.useContext(RadioGroupContext)

  return (
    <MenuItem
      onClick={() => context?.onValueChange?.(value)}
      disabled={disabled}
      className={className}
      sx={{ fontSize: '0.875rem', py: 0.75 }}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Radio checked={context?.value === value} size="small" />
      </ListItemIcon>
      <ListItemText>{children}</ListItemText>
    </MenuItem>
  )
}

interface DropdownMenuLabelProps {
  children?: React.ReactNode
  className?: string
  inset?: boolean
  sx?: SxProps<Theme>
}

function DropdownMenuLabel({ children, className, sx }: DropdownMenuLabelProps) {
  return (
    <Typography
      variant="caption"
      className={className}
      sx={{
        px: 2,
        py: 1,
        fontWeight: 600,
        display: 'block',
        color: 'text.secondary',
        ...sx
      }}
    >
      {children}
    </Typography>
  )
}

interface DropdownMenuSeparatorProps {
  className?: string
}

function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
  return <Divider className={className} sx={{ my: 0.5 }} />
}

interface DropdownMenuShortcutProps {
  children?: React.ReactNode
  className?: string
}

function DropdownMenuShortcut({ children, className }: DropdownMenuShortcutProps) {
  return (
    <Typography
      variant="caption"
      className={className}
      sx={{ ml: 'auto', color: 'text.secondary', letterSpacing: '0.05em' }}
    >
      {children}
    </Typography>
  )
}

// Sub menus - simplified implementation
interface DropdownMenuSubProps {
  children?: React.ReactNode
}

function DropdownMenuSub({ children }: DropdownMenuSubProps) {
  return <>{children}</>
}

interface DropdownMenuSubTriggerProps {
  children?: React.ReactNode
  className?: string
  inset?: boolean
}

function DropdownMenuSubTrigger({ children, className }: DropdownMenuSubTriggerProps) {
  return (
    <MenuItem className={className} sx={{ fontSize: '0.875rem', py: 0.75 }}>
      <ListItemText>{children}</ListItemText>
      <ChevronRightIcon fontSize="small" sx={{ ml: 1 }} />
    </MenuItem>
  )
}

interface DropdownMenuSubContentProps {
  children?: React.ReactNode
  className?: string
}

function DropdownMenuSubContent({ children }: DropdownMenuSubContentProps) {
  return <>{children}</>
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
}
