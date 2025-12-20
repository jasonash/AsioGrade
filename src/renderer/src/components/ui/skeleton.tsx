import * as React from 'react'
import MuiSkeleton, { type SkeletonProps as MuiSkeletonProps } from '@mui/material/Skeleton'

interface SkeletonProps extends MuiSkeletonProps {}

const Skeleton = React.forwardRef<HTMLSpanElement, SkeletonProps>(
  ({ variant = 'rounded', animation = 'pulse', sx, ...props }, ref) => {
    return (
      <MuiSkeleton
        ref={ref}
        variant={variant}
        animation={animation}
        sx={{
          bgcolor: 'action.hover',
          ...sx
        }}
        {...props}
      />
    )
  }
)

Skeleton.displayName = 'Skeleton'

export { Skeleton }
export type { SkeletonProps }
