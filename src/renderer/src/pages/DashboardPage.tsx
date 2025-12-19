import { type ReactElement, useEffect, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useAuthStore, useCourseStore } from '../stores'
import { CourseCard, CourseCreationModal } from '../components/courses'

export function DashboardPage(): ReactElement {
  const { status, user, error, isConfigured, login, checkAuth } = useAuthStore()
  const { courses, loading: coursesLoading, error: coursesError, fetchCourses } = useCourseStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Check auth status on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Fetch courses when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      fetchCourses()
    }
  }, [status, fetchCourses])

  const isLoading = status === 'loading' || status === 'idle'
  const isAuthenticated = status === 'authenticated'

  // Show login prompt if not authenticated
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md p-8 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Welcome to TeachingHelp
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Sign in with Google to sync your classes, tests, and grades across devices.
          </p>

          {status === 'not_configured' && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
              <p className="text-sm text-[var(--color-warning)]">
                OAuth not configured. Check config/oauth.json
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          <button
            onClick={login}
            disabled={!isConfigured}
            className="w-full px-6 py-3 rounded-lg bg-white text-gray-700 font-medium border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            Your data is stored in your own Google Drive
          </p>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-muted)]">Loading...</p>
        </div>
      </div>
    )
  }

  // Authenticated dashboard
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Your AI-powered teaching assistant
          </p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {user.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="text-right">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{user.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
            </div>
          </div>
        )}
      </header>

      {/* Courses Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Your Courses
          </h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus size={16} />
            New Course
          </button>
        </div>

        {/* Loading state */}
        {coursesLoading && courses.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--color-accent)] animate-spin" />
          </div>
        )}

        {/* Error state */}
        {coursesError && (
          <div className="p-4 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 mb-4">
            <p className="text-sm text-[var(--color-error)]">{coursesError}</p>
            <button
              onClick={() => fetchCourses()}
              className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!coursesLoading && !coursesError && courses.length === 0 && (
          <div className="p-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-[var(--color-text-primary)] font-medium mb-1">
              No courses yet
            </h3>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Create your first course to get started.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Create Your First Course
            </button>
          </div>
        )}

        {/* Course grid */}
        {courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => {
                  // TODO: Navigate to course view
                  console.log('Open course:', course.id)
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Course Creation Modal */}
      <CourseCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(course) => {
          console.log('Course created:', course.name)
        }}
      />
    </div>
  )
}
