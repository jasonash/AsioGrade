import * as React from 'react'
import MuiAvatar, { type AvatarProps as MuiAvatarProps } from '@mui/material/Avatar'

interface AvatarProps extends MuiAvatarProps {
  className?: string
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ sx, className, ...props }, ref) => {
    return (
      <MuiAvatar
        ref={ref}
        className={className}
        sx={{
          width: 32,
          height: 32,
          fontSize: '0.875rem',
          ...sx
        }}
        {...props}
      />
    )
  }
)

Avatar.displayName = 'Avatar'

// For compatibility with existing code that uses AvatarImage and AvatarFallback
// MUI Avatar handles this internally with src and children props
interface AvatarImageProps {
  src?: string
  alt?: string
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AvatarImage(_props: AvatarImageProps) {
  // This component exists for API compatibility
  // MUI Avatar uses src prop directly on the main component
  return null
}

interface AvatarFallbackProps {
  children?: React.ReactNode
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AvatarFallback(_props: AvatarFallbackProps) {
  // This component exists for API compatibility
  // MUI Avatar uses children prop for fallback content
  return null
}

export { Avatar, AvatarImage, AvatarFallback }
export type { AvatarProps, AvatarImageProps, AvatarFallbackProps }
