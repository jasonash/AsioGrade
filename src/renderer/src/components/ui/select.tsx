import * as React from 'react'
import MuiSelect, { type SelectProps as MuiSelectProps, type SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import ListSubheader from '@mui/material/ListSubheader'
import Divider from '@mui/material/Divider'
import type { SxProps, Theme } from '@mui/material/styles'

interface SelectProps extends Omit<MuiSelectProps, 'onChange'> {
  onValueChange?: (value: string) => void
  onChange?: (event: SelectChangeEvent<unknown>, child: React.ReactNode) => void
  className?: string
}

function Select({
  value,
  onValueChange,
  onChange,
  children,
  className,
  ...props
}: SelectProps) {
  const handleChange = (event: SelectChangeEvent<unknown>, child: React.ReactNode) => {
    onChange?.(event, child)
    onValueChange?.(event.target.value as string)
  }

  return (
    <MuiSelect
      value={value}
      onChange={handleChange}
      className={className}
      size="small"
      {...props}
    >
      {children}
    </MuiSelect>
  )
}

// SelectGroup - maps to ListSubheader for grouping
interface SelectGroupProps {
  children?: React.ReactNode
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SelectGroup({ children, className: _className }: SelectGroupProps) {
  return <>{children}</>
}

// SelectValue - placeholder component for API compatibility
interface SelectValueProps {
  placeholder?: string
  children?: React.ReactNode
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SelectValue(_props: SelectValueProps) {
  // MUI Select handles this internally with displayEmpty and renderValue
  return null
}

// SelectTrigger - Not needed with MUI, provided for API compatibility
interface SelectTriggerProps {
  children?: React.ReactNode
  className?: string
  size?: 'sm' | 'default'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SelectTrigger({ children, className: _className }: SelectTriggerProps) {
  return <>{children}</>
}

// SelectContent - wrapper for API compatibility
interface SelectContentProps {
  children?: React.ReactNode
  className?: string
  position?: 'item-aligned' | 'popper'
  align?: 'start' | 'center' | 'end'
}

function SelectContent({ children }: SelectContentProps) {
  return <>{children}</>
}

// SelectLabel - maps to ListSubheader
interface SelectLabelProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function SelectLabel({ children, className, sx }: SelectLabelProps) {
  return (
    <ListSubheader className={className} sx={sx}>
      {children}
    </ListSubheader>
  )
}

// SelectItem - maps to MenuItem
interface SelectItemProps {
  children?: React.ReactNode
  value: string
  disabled?: boolean
  className?: string
  sx?: SxProps<Theme>
}

function SelectItem({ children, value, disabled, className, sx }: SelectItemProps) {
  return (
    <MenuItem value={value} disabled={disabled} className={className} sx={sx}>
      {children}
    </MenuItem>
  )
}

// SelectSeparator - maps to Divider
interface SelectSeparatorProps {
  className?: string
}

function SelectSeparator({ className }: SelectSeparatorProps) {
  return <Divider className={className} sx={{ my: 0.5 }} />
}

// ScrollUpButton and ScrollDownButton - Not needed with MUI
interface SelectScrollButtonProps {
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SelectScrollUpButton(_props: SelectScrollButtonProps) {
  return null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SelectScrollDownButton(_props: SelectScrollButtonProps) {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  FormControl,
  InputLabel,
  MenuItem
}

export type {
  SelectProps,
  SelectGroupProps,
  SelectValueProps,
  SelectTriggerProps,
  SelectContentProps,
  SelectLabelProps,
  SelectItemProps,
  SelectSeparatorProps,
  SelectScrollButtonProps
}
