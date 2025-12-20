import * as React from 'react'
import Chip, { type ChipProps } from '@mui/material/Chip'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface BadgeProps extends Omit<ChipProps, 'variant' | 'color'> {
  variant?: BadgeVariant
  asChild?: boolean // Kept for API compatibility
}

const variantToChipProps: Record<
  BadgeVariant,
  { variant: ChipProps['variant']; color: ChipProps['color'] }
> = {
  default: { variant: 'filled', color: 'primary' },
  secondary: { variant: 'filled', color: 'secondary' },
  destructive: { variant: 'filled', color: 'error' },
  outline: { variant: 'outlined', color: 'default' }
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ variant = 'default', label, children, sx, ...props }, ref) => {
    const chipProps = variantToChipProps[variant]

    return (
      <Chip
        ref={ref}
        label={label || children}
        variant={chipProps.variant}
        color={chipProps.color}
        size="small"
        sx={{
          height: 'auto',
          py: 0.25,
          fontSize: '0.75rem',
          fontWeight: 500,
          ...sx
        }}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }
export type { BadgeProps, BadgeVariant }
