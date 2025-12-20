import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'

type InputProps = Omit<TextFieldProps, 'variant'> & {
  // Keep HTML input type for compatibility
  type?: React.HTMLInputTypeAttribute
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ type, size = 'small', fullWidth = true, ...props }, ref) => {
    return (
      <TextField
        inputRef={ref}
        type={type}
        variant="outlined"
        size={size}
        fullWidth={fullWidth}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
export type { InputProps }
