import * as React from 'react'
import InputLabel, { type InputLabelProps } from '@mui/material/InputLabel'
import FormLabel, { type FormLabelProps } from '@mui/material/FormLabel'

interface LabelProps extends FormLabelProps {
  htmlFor?: string
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, sx, ...props }, ref) => {
    return (
      <FormLabel
        ref={ref}
        sx={{
          fontSize: '0.875rem',
          fontWeight: 500,
          mb: 0.5,
          display: 'block',
          ...sx
        }}
        {...props}
      >
        {children}
      </FormLabel>
    )
  }
)

Label.displayName = 'Label'

export { Label, InputLabel }
export type { LabelProps, InputLabelProps }
