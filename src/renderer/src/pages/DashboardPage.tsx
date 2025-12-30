import { type ReactElement, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Avatar from '@mui/material/Avatar'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { useAuthStore, useCourseStore } from '../stores'
import { CourseCard } from '../components/courses'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import logoImage from '../assets/logo.png'

interface DashboardPageProps {
  onOpenCreateModal?: () => void
}

export function DashboardPage({ onOpenCreateModal }: DashboardPageProps): ReactElement {
  const { status, user, error, isConfigured, login, checkAuth } = useAuthStore()
  const { courses, loading: coursesLoading, error: coursesError, fetchCourses } = useCourseStore()

  // Check auth status on mount
  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [])

  // Fetch courses when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      fetchCourses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [status])

  const isLoading = status === 'loading' || status === 'idle'
  const isAuthenticated = status === 'authenticated'

  // Show login prompt if not authenticated
  if (!isAuthenticated && !isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Card sx={{ maxWidth: 400, textAlign: 'center' }}>
          <CardHeader>
            <Box
              component="img"
              src={logoImage}
              alt="AsioGrade"
              sx={{ width: 64, height: 64, mx: 'auto', mb: 2, borderRadius: 1.5 }}
            />
            <CardTitle>Welcome to AsioGrade</CardTitle>
            <CardDescription>
              Sign in with Google to sync your classes, tests, and grades across devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {status === 'not_configured' && (
                <Alert severity="warning">
                  Google sign-in is not yet configured. Please contact your administrator.
                </Alert>
              )}

              {error && (
                <Alert severity="error">{error}</Alert>
              )}

              <Button
                onClick={login}
                disabled={!isConfigured}
                variant="contained"
                size="large"
                fullWidth
                sx={{
                  bgcolor: 'white',
                  color: '#1f1f1f',
                  fontWeight: 500,
                  '&:hover': { bgcolor: 'grey.100' },
                  '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' }
                }}
                startIcon={
                  <svg width="20" height="20" viewBox="0 0 24 24">
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
                }
              >
                Sign in with Google
              </Button>

              <Typography variant="caption" color="text.secondary">
                Your data is stored in your own Google Drive
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography color="text.secondary">Loading...</Typography>
        </Box>
      </Box>
    )
  }

  // Authenticated dashboard
  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box component="header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            component="img"
            src={logoImage}
            alt="AsioGrade Logo"
            sx={{ width: 64, height: 64, borderRadius: 1.5 }}
          />
          <Box>
            <Typography variant="h5" sx={{ fontFamily: '"DM Serif Text", serif', fontWeight: 400 }}>
              AsioGrade
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Create, print, and grade assessments with ease
            </Typography>
          </Box>
        </Box>
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {user.picture && (
              <Avatar src={user.picture} alt={user.name} sx={{ width: 40, height: 40 }} />
            )}
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" fontWeight={500}>{user.name}</Typography>
              <Typography variant="caption" color="text.secondary">{user.email}</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Courses Section */}
      <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Your Courses</Typography>
          <Button variant="contained" size="small" onClick={onOpenCreateModal} startIcon={<AddIcon />}>
            New Course
          </Button>
        </Box>

        {/* Loading state */}
        {coursesLoading && courses.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Error state */}
        {coursesError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button size="small" onClick={() => fetchCourses()}>Try again</Button>
            }
          >
            {coursesError}
          </Alert>
        )}

        {/* Empty state */}
        {!coursesLoading && !coursesError && courses.length === 0 && (
          <Card sx={{ textAlign: 'center', py: 4 }}>
            <CardContent>
              <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 2, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MenuBookIcon sx={{ fontSize: 24, color: 'primary.main' }} />
              </Box>
              <Typography fontWeight={500} gutterBottom>No courses yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create your first course to get started.
              </Typography>
              <Button variant="contained" onClick={onOpenCreateModal}>
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Course grid */}
        {courses.length > 0 && (
          <Grid container spacing={2}>
            {courses.map((course) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={course.id}>
                <CourseCard
                  course={course}
                  onClick={() => {
                    useCourseStore.getState().setCurrentCourse(course)
                  }}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  )
}
