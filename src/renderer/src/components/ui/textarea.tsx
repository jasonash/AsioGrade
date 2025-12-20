import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'

type TextareaProps = Omit<TextFieldProps, 'variant' | 'multiline'> & {
  rows?: number
  minRows?: number
  maxRows?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ rows, minRows = 3, maxRows, size = 'small', fullWidth = true, ...props }, ref) => {
    return (
      <TextField
        inputRef={ref}
        variant="outlined"
        multiline
        rows={rows}
        minRows={rows ? undefined : minRows}
        maxRows={maxRows}
        size={size}
        fullWidth={fullWidth}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
export type { TextareaProps }
