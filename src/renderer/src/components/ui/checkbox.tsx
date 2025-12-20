import * as React from 'react'
import MuiCheckbox, { type CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'

interface CheckboxProps extends Omit<MuiCheckboxProps, 'checked'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: React.ReactNode
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, onChange, label, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event, event.target.checked)
      onCheckedChange?.(event.target.checked)
    }

    const checkbox = (
      <MuiCheckbox
        ref={ref}
        checked={checked}
        onChange={handleChange}
        size="small"
        {...props}
      />
    )

    if (label) {
      return <FormControlLabel control={checkbox} label={label} />
    }

    return checkbox
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
export type { CheckboxProps }
