import * as React from 'react'
import MuiTabs from '@mui/material/Tabs'
import MuiTab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'

interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: React.ReactNode
  sx?: SxProps<Theme>
}

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
  sx,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || '')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : uncontrolledValue

  const handleChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [isControlled, onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
      <Box
        className={className}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          ...sx
        }}
        {...props}
      >
        {children}
      </Box>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function TabsList({ children, className, sx }: TabsListProps) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('TabsList must be used within Tabs')
  }

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    context.onValueChange(newValue)
  }

  return (
    <MuiTabs
      value={context.value}
      onChange={handleChange}
      className={className}
      sx={{
        minHeight: 36,
        '& .MuiTabs-indicator': {
          height: 2
        },
        ...sx
      }}
    >
      {children}
    </MuiTabs>
  )
}

interface TabsTriggerProps {
  value: string
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  sx?: SxProps<Theme>
}

function TabsTrigger({ value, children, className, disabled, sx }: TabsTriggerProps) {
  return (
    <MuiTab
      value={value}
      label={children}
      className={className}
      disabled={disabled}
      sx={{
        minHeight: 36,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.875rem',
        ...sx
      }}
    />
  )
}

interface TabsContentProps {
  value: string
  children?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function TabsContent({ value, children, className, sx }: TabsContentProps) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('TabsContent must be used within Tabs')
  }

  if (context.value !== value) {
    return null
  }

  return (
    <Box
      role="tabpanel"
      className={className}
      sx={{
        flex: 1,
        outline: 'none',
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps }
