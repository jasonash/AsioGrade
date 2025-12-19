import type { ReactElement } from 'react'
import {
  Home,
  Users,
  FileText,
  ClipboardList,
  CheckCircle,
  BarChart3,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export type NavItem =
  | 'dashboard'
  | 'roster'
  | 'tests'
  | 'scantrons'
  | 'grading'
  | 'analytics'
  | 'standards'
  | 'settings'

interface NavItemConfig {
  id: NavItem
  label: string
  icon: ReactElement
}

const navItems: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} /> },
  { id: 'roster', label: 'Roster', icon: <Users size={20} /> },
  { id: 'tests', label: 'Tests', icon: <FileText size={20} /> },
  { id: 'scantrons', label: 'Scantrons', icon: <ClipboardList size={20} /> },
  { id: 'grading', label: 'Grading', icon: <CheckCircle size={20} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
  { id: 'standards', label: 'Standards', icon: <BookOpen size={20} /> }
]

const settingsItem: NavItemConfig = {
  id: 'settings',
  label: 'Settings',
  icon: <Settings size={20} />
}

interface SidebarProps {
  isExpanded: boolean
  onToggle: () => void
  activeItem: NavItem
  onNavigate: (item: NavItem) => void
}

export function Sidebar({
  isExpanded,
  onToggle,
  activeItem,
  onNavigate
}: SidebarProps): ReactElement {
  return (
    <aside
      className={`
        flex flex-col h-full
        bg-[var(--color-bg-secondary)]
        border-r border-[var(--color-border)]
        transition-all duration-200 ease-out
        ${isExpanded ? 'w-[200px]' : 'w-[60px]'}
      `}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`
          flex items-center justify-center
          h-12 w-full
          text-[var(--color-text-muted)]
          hover:text-[var(--color-text-primary)]
          hover:bg-[var(--color-surface-hover)]
          transition-colors duration-150
          border-b border-[var(--color-border)]
        `}
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Main navigation */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isExpanded={isExpanded}
            isActive={activeItem === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="py-2 border-t border-[var(--color-border)]">
        <NavButton
          item={settingsItem}
          isExpanded={isExpanded}
          isActive={activeItem === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </div>
    </aside>
  )
}

interface NavButtonProps {
  item: NavItemConfig
  isExpanded: boolean
  isActive: boolean
  onClick: () => void
}

function NavButton({ item, isExpanded, isActive, onClick }: NavButtonProps): ReactElement {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center w-full
        h-11 px-4 gap-3
        text-left
        transition-colors duration-150
        ${
          isActive
            ? 'bg-[var(--color-surface-active)] text-[var(--color-accent)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
        }
      `}
      title={!isExpanded ? item.label : undefined}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {isExpanded && (
        <span className="truncate text-sm font-medium">{item.label}</span>
      )}
    </button>
  )
}
