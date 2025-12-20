import type { ReactElement, ReactNode } from 'react'
import { Sidebar, type NavItem } from './Sidebar'
import { useUIStore, useAppStore } from '../../stores'
import type { CourseSummary, SectionSummary } from '../../../../shared/types'
import { cn } from '@/lib/utils'

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

  const getSyncStatusDisplay = (): { text: string; colorClass: string } => {
    switch (syncStatus) {
      case 'syncing':
        return { text: 'Syncing...', colorClass: 'bg-blue-500' }
      case 'synced':
        return { text: 'Up to date', colorClass: 'bg-green-500' }
      case 'error':
        return { text: 'Sync error', colorClass: 'bg-destructive' }
      case 'offline':
        return { text: 'Offline', colorClass: 'bg-yellow-500' }
      default:
        return { text: 'Ready', colorClass: 'bg-green-500' }
    }
  }

  const { text: statusText, colorClass } = getSyncStatusDisplay()

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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isExpanded={sidebarExpanded}
        onToggle={toggleSidebar}
        activeItem={activeItem}
        onNavigate={onNavigate}
        onCourseSelect={onCourseSelect}
        onSectionSelect={onSectionSelect}
        onNewCourse={onNewCourse}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content area */}
        <main className="flex-1 overflow-auto">{children}</main>

        {/* Status bar */}
        <footer className="h-8 px-4 flex items-center gap-4 text-xs text-muted-foreground bg-muted/50 border-t border-border">
          <span className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', colorClass)} />
            {statusText}
            {lastSyncTime && syncStatus === 'synced' && (
              <span className="text-muted-foreground">({formatLastSync()})</span>
            )}
          </span>
          <span className="ml-auto">TeachingHelp v1.0.0</span>
        </footer>
      </div>
    </div>
  )
}
