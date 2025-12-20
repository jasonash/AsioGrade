import * as React from 'react'
import MuiCard, { type CardProps as MuiCardProps } from '@mui/material/Card'
import MuiCardContent from '@mui/material/CardContent'
import MuiCardActions from '@mui/material/CardActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

interface CardProps extends MuiCardProps {
  className?: string
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ sx, className, ...props }, ref) => {
  return (
    <MuiCard
      ref={ref}
      variant="outlined"
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        ...sx
      }}
      {...props}
    />
  )
})
Card.displayName = 'Card'

interface CardHeaderProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function CardHeader({ children, className, sx }: CardHeaderProps) {
  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 2,
        pb: 0,
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

interface CardTitleProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function CardTitle({ children, className, sx }: CardTitleProps) {
  return (
    <Typography
      variant="h6"
      component="div"
      className={className}
      sx={{
        fontWeight: 600,
        lineHeight: 1.2,
        ...sx
      }}
    >
      {children}
    </Typography>
  )
}

interface CardDescriptionProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function CardDescription({ children, className, sx }: CardDescriptionProps) {
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

interface CardActionProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function CardAction({ children, className, sx }: CardActionProps) {
  return (
    <Box
      className={className}
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

interface CardContentProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function CardContent({ children, className, sx }: CardContentProps) {
  return (
    <MuiCardContent className={className} sx={{ p: 2, '&:last-child': { pb: 2 }, ...sx }}>
      {children}
    </MuiCardContent>
  )
}

interface CardFooterProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function CardFooter({ children, className, sx }: CardFooterProps) {
  return (
    <MuiCardActions
      className={className}
      sx={{
        p: 2,
        pt: 0,
        justifyContent: 'flex-start',
        ...sx
      }}
    >
      {children}
    </MuiCardActions>
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardActionProps,
  CardContentProps,
  CardFooterProps
}
