import * as React from 'react'
import Divider, { type DividerProps } from '@mui/material/Divider'

interface SeparatorProps extends DividerProps {
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ orientation = 'horizontal', decorative = true, sx, ...props }, ref) => {
    return (
      <Divider
        ref={ref}
        orientation={orientation}
        aria-hidden={decorative}
        sx={{
          my: orientation === 'horizontal' ? 1 : 0,
          mx: orientation === 'vertical' ? 1 : 0,
          ...sx
        }}
        {...props}
      />
    )
  }
)

Separator.displayName = 'Separator'

export { Separator }
export type { SeparatorProps }
