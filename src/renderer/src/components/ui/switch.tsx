import * as React from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

interface SwitchProps extends Omit<MuiSwitchProps, 'checked'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: React.ReactNode
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, onChange, label, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event, event.target.checked)
      onCheckedChange?.(event.target.checked)
    }

    const switchElement = (
      <MuiSwitch
        ref={ref}
        checked={checked}
        onChange={handleChange}
        size="small"
        {...props}
      />
    )

    if (label) {
      return <FormControlLabel control={switchElement} label={label} />
    }

    return switchElement
  }
)

Switch.displayName = 'Switch'

export { Switch }
export type { SwitchProps }
