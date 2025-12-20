import type { ReactElement, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Sidebar, type NavItem } from './Sidebar'
import { useUIStore, useAppStore } from '../../stores'
import type { CourseSummary, SectionSummary } from '../../../../shared/types'

interface LayoutProps {
  children: ReactNode
  activeItem: NavItem
  onNavigate: (item: NavItem) => void
  onCourseSelect?: (course: CourseSummary) => void
  onSectionSelect?: (section: SectionSummary, course: CourseSummary) => void
  onNewCourse?: () => void
}

export function Layout({
  children,
  activeItem,
  onNavigate,
  onCourseSelect,
  onSectionSelect,
  onNewCourse
}: LayoutProps): ReactElement {
  const { sidebarExpanded, toggleSidebar } = useUIStore()
  const { syncStatus, lastSyncTime } = useAppStore()

  const getSyncStatusDisplay = (): { text: string; color: string } => {
    switch (syncStatus) {
      case 'syncing':
        return { text: 'Syncing...', color: 'info.main' }
      case 'synced':
        return { text: 'Up to date', color: 'success.main' }
      case 'error':
        return { text: 'Sync error', color: 'error.main' }
      case 'offline':
        return { text: 'Offline', color: 'warning.main' }
      default:
        return { text: 'Ready', color: 'success.main' }
    }
  }

  const { text: statusText, color: statusColor } = getSyncStatusDisplay()

  const formatLastSync = (): string => {
    if (!lastSyncTime) return ''
    const now = new Date()
    const diff = now.getTime() - lastSyncTime.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just now'
    if (minutes === 1) return '1 min ago'
    if (minutes < 60) return `${minutes} min ago`

    const hours = Math.floor(minutes / 60)
    if (hours === 1) return '1 hour ago'
    if (hours < 24) return `${hours} hours ago`

    return lastSyncTime.toLocaleDateString()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}
    >
      <Sidebar
        isExpanded={sidebarExpanded}
        onToggle={toggleSidebar}
        activeItem={activeItem}
        onNavigate={onNavigate}
        onCourseSelect={onCourseSelect}
        onSectionSelect={onSectionSelect}
        onNewCourse={onNewCourse}
      />

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Main content area */}
        <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
          {children}
        </Box>

        {/* Status bar */}
        <Box
          component="footer"
          sx={{
            height: 32,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'action.hover',
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: statusColor
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {statusText}
              {lastSyncTime && syncStatus === 'synced' && (
                <Box component="span" sx={{ ml: 0.5 }}>
                  ({formatLastSync()})
                </Box>
              )}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            TeachingHelp v1.0.0
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
