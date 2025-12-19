import type { ReactElement, ReactNode } from 'react'
import { Sidebar, type NavItem } from './Sidebar'
import { useUIStore, useAppStore } from '../../stores'

interface LayoutProps {
  children: ReactNode
  activeItem: NavItem
  onNavigate: (item: NavItem) => void
}

export function Layout({ children, activeItem, onNavigate }: LayoutProps): ReactElement {
  const { sidebarExpanded, toggleSidebar } = useUIStore()
  const { syncStatus, lastSyncTime } = useAppStore()

  const getSyncStatusDisplay = (): { text: string; color: string } => {
    switch (syncStatus) {
      case 'syncing':
        return { text: 'Syncing...', color: 'bg-[var(--color-info)]' }
      case 'synced':
        return { text: 'Up to date', color: 'bg-[var(--color-success)]' }
      case 'error':
        return { text: 'Sync error', color: 'bg-[var(--color-error)]' }
      case 'offline':
        return { text: 'Offline', color: 'bg-[var(--color-warning)]' }
      default:
        return { text: 'Ready', color: 'bg-[var(--color-success)]' }
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
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <Sidebar
        isExpanded={sidebarExpanded}
        onToggle={toggleSidebar}
        activeItem={activeItem}
        onNavigate={onNavigate}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">{children}</main>

        {/* Status bar */}
        <footer className="h-8 px-4 flex items-center gap-4 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)]">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            {statusText}
            {lastSyncTime && syncStatus === 'synced' && (
              <span className="text-[var(--color-text-muted)]">({formatLastSync()})</span>
            )}
          </span>
          <span className="ml-auto">TeachingHelp v1.0.0</span>
        </footer>
      </div>
    </div>
  )
}
