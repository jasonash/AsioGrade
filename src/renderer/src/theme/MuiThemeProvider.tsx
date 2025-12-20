import { type ReactNode, useMemo } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useUIStore } from '../stores/ui.store'
import { createMuiTheme } from './muiTheme'

interface MuiThemeProviderProps {
  children: ReactNode
}

export function MuiThemeProvider({ children }: MuiThemeProviderProps) {
  const resolvedTheme = useUIStore((state) => state.resolvedTheme)

  const theme = useMemo(() => createMuiTheme(resolvedTheme), [resolvedTheme])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
