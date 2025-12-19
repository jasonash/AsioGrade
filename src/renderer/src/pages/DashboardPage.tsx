import type { ReactElement } from 'react'

export function DashboardPage(): ReactElement {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Welcome back
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Your AI-powered teaching assistant
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Your Classes
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm">
            No classes yet. Create your first class to get started.
          </p>
          <button className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
            + New Class
          </button>
        </div>

        <div className="p-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Recent Activity
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm">
            No recent activity to show.
          </p>
        </div>

        <div className="p-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <button className="w-full px-3 py-2 text-left text-sm rounded bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-active)] transition-colors">
              Create Test
            </button>
            <button className="w-full px-3 py-2 text-left text-sm rounded bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-active)] transition-colors">
              Generate Scantrons
            </button>
            <button className="w-full px-3 py-2 text-left text-sm rounded bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-active)] transition-colors">
              Grade Tests
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
