import type { ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import PeopleIcon from '@mui/icons-material/People'
import DescriptionIcon from '@mui/icons-material/Description'
import AssignmentIcon from '@mui/icons-material/Assignment'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BarChartIcon from '@mui/icons-material/BarChart'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SettingsIcon from '@mui/icons-material/Settings'
import type { SvgIconComponent } from '@mui/icons-material'

interface PlaceholderPageProps {
  title: string
  icon: 'roster' | 'tests' | 'scantrons' | 'grading' | 'analytics' | 'standards' | 'settings'
  description: string
}

const icons: Record<PlaceholderPageProps['icon'], SvgIconComponent> = {
  roster: PeopleIcon,
  tests: DescriptionIcon,
  scantrons: AssignmentIcon,
  grading: CheckCircleIcon,
  analytics: BarChartIcon,
  standards: MenuBookIcon,
  settings: SettingsIcon
}

export function PlaceholderPage({ title, icon, description }: PlaceholderPageProps): ReactElement {
  const Icon = icons[icon]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', maxWidth: 400 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            mx: 'auto',
            mb: 2,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon sx={{ fontSize: 32, color: 'primary.main' }} />
        </Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary">
          {description}
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 2 }}>
          Coming soon
        </Typography>
      </Paper>
    </Box>
  )
}
