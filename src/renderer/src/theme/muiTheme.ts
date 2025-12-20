import { createTheme, type ThemeOptions } from '@mui/material/styles'

// Convert HSL to hex values
// Primary: hsl(45, 93%, 47%) = #E5A80D (mustard yellow)
// Calculated using: https://www.rapidtables.com/convert/color/hsl-to-hex.html

const mustardYellow = {
  main: '#E5A80D',
  light: '#F0C040',
  dark: '#B8860B',
  contrastText: '#000000'
}

// Dark theme palette (matches original :root)
const darkPalette: ThemeOptions['palette'] = {
  mode: 'dark',
  primary: mustardYellow,
  secondary: {
    main: '#27272A', // hsl(240, 3.7%, 15.9%)
    light: '#3F3F46',
    dark: '#18181B',
    contrastText: '#FAFAFA'
  },
  background: {
    default: '#0A0A0B', // hsl(240, 10%, 3.9%)
    paper: '#0F0F11' // hsl(240, 10%, 6%)
  },
  text: {
    primary: '#FAFAFA', // hsl(0, 0%, 98%)
    secondary: '#A1A1AA' // hsl(240, 5%, 64.9%)
  },
  error: {
    main: '#DC2626', // hsl(0, 62.8%, 50.6%)
    contrastText: '#FAFAFA'
  },
  success: {
    main: '#16A34A', // hsl(142, 76%, 36%)
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#F59E0B', // hsl(38, 92%, 50%)
    contrastText: '#000000'
  },
  info: {
    main: '#3B82F6', // hsl(217, 91%, 60%)
    contrastText: '#FFFFFF'
  },
  divider: '#3D3D42', // hsl(220, 10%, 25%)
  action: {
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(229, 168, 13, 0.16)', // primary with opacity
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)'
  }
}

// Light theme palette (matches original .light)
const lightPalette: ThemeOptions['palette'] = {
  mode: 'light',
  primary: mustardYellow,
  secondary: {
    main: '#F4F4F5', // hsl(240, 4.8%, 95.9%)
    light: '#FAFAFA',
    dark: '#E4E4E7',
    contrastText: '#18181B'
  },
  background: {
    default: '#FFFFFF', // hsl(0, 0%, 100%)
    paper: '#FFFFFF'
  },
  text: {
    primary: '#0A0A0B', // hsl(240, 10%, 3.9%)
    secondary: '#71717A' // hsl(240, 3.8%, 46.1%)
  },
  error: {
    main: '#EF4444', // hsl(0, 84.2%, 60.2%)
    contrastText: '#FAFAFA'
  },
  success: {
    main: '#16A34A',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#F59E0B',
    contrastText: '#000000'
  },
  info: {
    main: '#3B82F6',
    contrastText: '#FFFFFF'
  },
  divider: '#E4E4E7', // hsl(240, 5.9%, 90%)
  action: {
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(229, 168, 13, 0.12)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  }
}

// Shared component overrides
const componentOverrides: ThemeOptions['components'] = {
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        borderRadius: 6
      }
    },
    defaultProps: {
      disableElevation: true
    }
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        backgroundImage: 'none'
      }
    }
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none'
      }
    }
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 12
      }
    }
  },
  MuiTextField: {
    defaultProps: {
      size: 'small',
      variant: 'outlined'
    }
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 6
      }
    }
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6
      }
    }
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 4
      }
    }
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundImage: 'none'
      }
    }
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 6
      }
    }
  }
}

// Shared typography
const typography: ThemeOptions['typography'] = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    'Oxygen',
    'Ubuntu',
    'Cantarell',
    '"Open Sans"',
    '"Helvetica Neue"',
    'sans-serif'
  ].join(','),
  button: {
    textTransform: 'none'
  }
}

// Shape settings
const shape = {
  borderRadius: 6
}

export function createMuiTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: mode === 'dark' ? darkPalette : lightPalette,
    typography,
    shape,
    components: componentOverrides
  })
}

// Export palette for use in components that need direct access
export { mustardYellow, darkPalette, lightPalette }
