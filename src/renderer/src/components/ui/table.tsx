import * as React from 'react'
import MuiTable from '@mui/material/Table'
import MuiTableBody from '@mui/material/TableBody'
import MuiTableCell from '@mui/material/TableCell'
import MuiTableContainer from '@mui/material/TableContainer'
import MuiTableHead from '@mui/material/TableHead'
import MuiTableRow from '@mui/material/TableRow'
import MuiTableFooter from '@mui/material/TableFooter'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

interface TableProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function Table({ children, className, sx }: TableProps) {
  return (
    <MuiTableContainer className={className} sx={sx}>
      <MuiTable size="small">{children}</MuiTable>
    </MuiTableContainer>
  )
}

interface TableHeaderProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function TableHeader({ children, className, sx }: TableHeaderProps) {
  return (
    <MuiTableHead className={className} sx={sx}>
      {children}
    </MuiTableHead>
  )
}

interface TableBodyProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function TableBody({ children, className, sx }: TableBodyProps) {
  return (
    <MuiTableBody className={className} sx={sx}>
      {children}
    </MuiTableBody>
  )
}

interface TableFooterProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function TableFooter({ children, className, sx }: TableFooterProps) {
  return (
    <MuiTableFooter
      className={className}
      sx={{
        bgcolor: 'action.hover',
        ...sx
      }}
    >
      {children}
    </MuiTableFooter>
  )
}

interface TableRowProps {
  children?: React.ReactNode
  className?: string
  selected?: boolean
  sx?: SxProps<Theme>
}

function TableRow({ children, className, selected, sx }: TableRowProps) {
  return (
    <MuiTableRow
      className={className}
      selected={selected}
      hover
      sx={sx}
    >
      {children}
    </MuiTableRow>
  )
}

interface TableHeadProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function TableHead({ children, className, sx }: TableHeadProps) {
  return (
    <MuiTableCell
      component="th"
      className={className}
      sx={{
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...sx
      }}
    >
      {children}
    </MuiTableCell>
  )
}

interface TableCellProps {
  children?: React.ReactNode
  className?: string
  colSpan?: number
  sx?: SxProps<Theme>
}

function TableCell({ children, className, colSpan, sx }: TableCellProps) {
  return (
    <MuiTableCell
      className={className}
      colSpan={colSpan}
      sx={{
        whiteSpace: 'nowrap',
        ...sx
      }}
    >
      {children}
    </MuiTableCell>
  )
}

interface TableCaptionProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function TableCaption({ children, className, sx }: TableCaptionProps) {
  return (
    <Typography
      component="caption"
      variant="body2"
      color="text.secondary"
      className={className}
      sx={{
        mt: 2,
        captionSide: 'bottom',
        ...sx
      }}
    >
      {children}
    </Typography>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
}

export type {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableFooterProps,
  TableRowProps,
  TableHeadProps,
  TableCellProps,
  TableCaptionProps
}
