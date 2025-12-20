import * as React from 'react'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'

interface ScrollAreaProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function ScrollArea({ children, className, sx }: ScrollAreaProps) {
  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        overflow: 'auto',
        // Custom scrollbar styling
        '&::-webkit-scrollbar': {
          width: 8,
          height: 8
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'action.hover',
          borderRadius: 4
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'action.disabled',
          borderRadius: 4,
          '&:hover': {
            bgcolor: 'action.active'
          }
        },
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

interface ScrollBarProps {
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

// ScrollBar - Not needed with MUI, using CSS scrollbar styling
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ScrollBar(_props: ScrollBarProps) {
  return null
}

export { ScrollArea, ScrollBar }
export type { ScrollAreaProps, ScrollBarProps }
