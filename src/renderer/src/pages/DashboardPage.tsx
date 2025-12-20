import { type ReactElement, useEffect } from 'react'
import { Plus, Loader2, BookOpen } from 'lucide-react'
import { useAuthStore, useCourseStore } from '../stores'
import { CourseCard } from '../components/courses'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DashboardPageProps {
  onOpenCreateModal?: () => void
}

export function DashboardPage({ onOpenCreateModal }: DashboardPageProps): ReactElement {
  const { status, user, error, isConfigured, login, checkAuth } = useAuthStore()
  const { courses, loading: coursesLoading, error: coursesError, fetchCourses } = useCourseStore()

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
        <Card className="max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to TeachingHelp</CardTitle>
            <CardDescription>
              Sign in with Google to sync your classes, tests, and grades across devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'not_configured' && (
              <Alert variant="destructive" className="bg-warning/10 border-warning/20 text-warning">
                <AlertDescription>OAuth not configured. Check config/oauth.json</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={login}
              disabled={!isConfigured}
              variant="outline"
              size="lg"
              className="w-full bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>

            <p className="text-xs text-muted-foreground">
              Your data is stored in your own Google Drive
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Authenticated dashboard
  return (
    <div className="space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1">Your AI-powered teaching assistant</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
            )}
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
      </header>

      {/* Courses Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Your Courses</h2>
          <Button onClick={onOpenCreateModal} size="sm">
            <Plus size={16} className="mr-2" />
            New Course
          </Button>
        </div>

        {/* Loading state */}
        {coursesLoading && courses.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {/* Error state */}
        {coursesError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-center justify-between">
              <span>{coursesError}</span>
              <Button variant="link" size="sm" onClick={() => fetchCourses()} className="p-0 h-auto">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {!coursesLoading && !coursesError && courses.length === 0 && (
          <Card className="text-center py-8">
            <CardContent className="pt-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-foreground font-medium mb-1">No courses yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first course to get started.
              </p>
              <Button onClick={onOpenCreateModal}>Create Your First Course</Button>
            </CardContent>
          </Card>
        )}

        {/* Course grid */}
        {courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => {
                  useCourseStore.getState().setCurrentCourse(course)
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No recent activity to show.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="secondary" className="w-full justify-start">
              Create Test
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              Generate Scantrons
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              Grade Tests
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
