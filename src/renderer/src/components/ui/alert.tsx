import * as React from 'react'
import MuiAlert, { type AlertProps as MuiAlertProps } from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Typography from '@mui/material/Typography'

type AlertVariant = 'default' | 'destructive'

interface AlertProps extends Omit<MuiAlertProps, 'variant' | 'severity'> {
  variant?: AlertVariant
  className?: string
}

const variantToSeverity: Record<AlertVariant, MuiAlertProps['severity']> = {
  default: 'info',
  destructive: 'error'
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'default', children, className, sx, ...props }, ref) => {
    return (
      <MuiAlert
        ref={ref}
        severity={variantToSeverity[variant]}
        variant="outlined"
        className={className}
        sx={{
          borderRadius: 2,
          ...sx
        }}
        {...props}
      >
        {children}
      </MuiAlert>
    )
  }
)

Alert.displayName = 'Alert'

interface AlertDescriptionProps {
  children?: React.ReactNode
  className?: string
}

function AlertDescription({ children, className }: AlertDescriptionProps) {
  return (
    <Typography variant="body2" color="text.secondary" className={className}>
      {children}
    </Typography>
  )
}

export { Alert, AlertTitle, AlertDescription }
export type { AlertProps, AlertVariant }
