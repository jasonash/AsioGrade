import * as React from 'react'
import MuiButton, { type ButtonProps as MuiButtonProps } from '@mui/material/Button'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'size' | 'color'> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean // Kept for API compatibility, not used with MUI
}

const variantToMui: Record<ButtonVariant, MuiButtonProps['variant']> = {
  default: 'contained',
  destructive: 'contained',
  outline: 'outlined',
  secondary: 'contained',
  ghost: 'text',
  link: 'text'
}

const variantToColor: Record<ButtonVariant, MuiButtonProps['color']> = {
  default: 'primary',
  destructive: 'error',
  outline: 'inherit',
  secondary: 'secondary',
  ghost: 'inherit',
  link: 'primary'
}

const sizeToMui: Record<ButtonSize, MuiButtonProps['size']> = {
  default: 'medium',
  sm: 'small',
  lg: 'large',
  icon: 'medium',
  'icon-sm': 'small',
  'icon-lg': 'large'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', sx, children, ...props }, ref) => {
    const isIconButton = size === 'icon' || size === 'icon-sm' || size === 'icon-lg'

    if (isIconButton) {
      return (
        <IconButton
          ref={ref}
          size={sizeToMui[size] as IconButtonProps['size']}
          color={variantToColor[variant] as IconButtonProps['color']}
          sx={{
            ...(variant === 'destructive' && {
              color: 'error.main',
              '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' }
            }),
            ...sx
          }}
          {...(props as IconButtonProps)}
        >
          {children}
        </IconButton>
      )
    }

    return (
      <MuiButton
        ref={ref}
        variant={variantToMui[variant]}
        size={sizeToMui[size]}
        color={variantToColor[variant]}
        sx={{
          ...(variant === 'link' && {
            textDecoration: 'underline',
            '&:hover': { textDecoration: 'underline' }
          }),
          ...sx
        }}
        {...props}
      >
        {children}
      </MuiButton>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
