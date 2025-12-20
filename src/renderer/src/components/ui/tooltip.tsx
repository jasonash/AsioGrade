import * as React from 'react'
import MuiTooltip from '@mui/material/Tooltip'

// TooltipProvider - Not needed with MUI, provided for API compatibility
interface TooltipProviderProps {
  children?: React.ReactNode
  delayDuration?: number
}

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>
}

interface TooltipProps {
  children?: React.ReactNode
  content?: React.ReactNode
  title?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

function Tooltip({
  children,
  content,
  title,
  open,
  onOpenChange,
  className
}: TooltipProps) {
  const handleOpen = () => onOpenChange?.(true)
  const handleClose = () => onOpenChange?.(false)

  // Check if children contains TooltipTrigger and TooltipContent (shadcn pattern)
  const childArray = React.Children.toArray(children)

  let triggerElement: React.ReactElement | null = null
  let tooltipContent: React.ReactNode = content || title || ''

  childArray.forEach((child) => {
    if (React.isValidElement(child)) {
      const displayName = (child.type as { displayName?: string })?.displayName
      if (displayName === 'TooltipTrigger') {
        // Get the actual trigger element from TooltipTrigger
        const triggerChild = (child.props as { children?: React.ReactNode }).children
        if (React.isValidElement(triggerChild)) {
          triggerElement = triggerChild
        } else if (triggerChild) {
          triggerElement = <span>{triggerChild}</span>
        }
      } else if (displayName === 'TooltipContent') {
        const contentProps = child.props as TooltipContentProps
        // Only use content if not hidden
        if (!contentProps.hidden) {
          tooltipContent = contentProps.children
        } else {
          tooltipContent = ''
        }
      }
    }
  })

  // If no trigger found, use children directly (simple pattern)
  if (!triggerElement) {
    if (React.isValidElement(children)) {
      triggerElement = children
    } else if (children) {
      triggerElement = <span>{children}</span>
    } else {
      return null
    }
  }

  return (
    <MuiTooltip
      title={tooltipContent}
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      className={className}
      arrow
    >
      {triggerElement}
    </MuiTooltip>
  )
}

// TooltipTrigger - Used to mark the trigger element
interface TooltipTriggerProps {
  children?: React.ReactNode
  asChild?: boolean
  className?: string
}

function TooltipTrigger({ children, className }: TooltipTriggerProps) {
  // If children is not a valid element, wrap it in a span
  if (!React.isValidElement(children)) {
    return <span className={className}>{children}</span>
  }
  return <>{children}</>
}
TooltipTrigger.displayName = 'TooltipTrigger'

// TooltipContent - Used to provide content for the tooltip
interface TooltipContentProps {
  children?: React.ReactNode
  className?: string
  sideOffset?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  hidden?: boolean
}

function TooltipContent({ children }: TooltipContentProps) {
  // This component is processed by Tooltip parent
  // MUI Tooltip uses title prop, this is for API compatibility
  return <>{children}</>
}
TooltipContent.displayName = 'TooltipContent'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
export type { TooltipProps, TooltipTriggerProps, TooltipContentProps, TooltipProviderProps }
