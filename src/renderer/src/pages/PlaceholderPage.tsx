import type { ReactElement } from 'react'
import {
  Users,
  FileText,
  ClipboardList,
  CheckCircle,
  BarChart3,
  BookOpen,
  Settings
} from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  icon: 'roster' | 'tests' | 'scantrons' | 'grading' | 'analytics' | 'standards' | 'settings'
  description: string
}

const icons = {
  roster: Users,
  tests: FileText,
  scantrons: ClipboardList,
  grading: CheckCircle,
  analytics: BarChart3,
  standards: BookOpen,
  settings: Settings
}

export function PlaceholderPage({ title, icon, description }: PlaceholderPageProps): ReactElement {
  const Icon = icons[icon]

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <div className="p-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
          <Icon size={32} className="text-[var(--color-accent)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          {title}
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          {description}
        </p>
        <p className="text-[var(--color-text-muted)] text-sm mt-4">
          Coming soon
        </p>
      </div>
    </div>
  )
}
