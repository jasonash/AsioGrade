import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import UploadIcon from '@mui/icons-material/Upload'
import PeopleIcon from '@mui/icons-material/People'
import ScheduleIcon from '@mui/icons-material/Schedule'
import RoomIcon from '@mui/icons-material/Room'
import { useRosterStore } from '../stores'
import { StudentList, StudentFormModal, CSVImportModal } from '../components/roster'
import { ConfirmModal } from '../components/ui'
import type { Student, CourseSummary, SectionSummary } from '../../../shared/types'

interface SectionViewPageProps {
  course: CourseSummary
  section: SectionSummary
  onBack: () => void
}

export function SectionViewPage({ course, section, onBack }: SectionViewPageProps): ReactElement {
  const { roster, loading, error, fetchRoster, deleteStudent, clearRoster } = useRosterStore()

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch roster when section changes
  useEffect(() => {
    fetchRoster(section.id)
    return () => {
      clearRoster()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Store functions are stable
  }, [section.id])

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deletingStudent) return

    setIsDeleting(true)
    const success = await deleteStudent(section.id, deletingStudent.id)
    setIsDeleting(false)

    if (success) {
      setDeletingStudent(null)
    }
  }

  const activeStudentCount = roster?.students.filter((s) => s.active).length ?? 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
      {/* Header */}
      <Box component="header">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Back to {course.name}
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>{section.name}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <PeopleIcon sx={{ fontSize: 14 }} />
                <Typography variant="body2">{activeStudentCount} students</Typography>
              </Box>
              {section.schedule && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  <ScheduleIcon sx={{ fontSize: 14 }} />
                  <Typography variant="body2">{section.schedule}</Typography>
                </Box>
              )}
              {section.room && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  <RoomIcon sx={{ fontSize: 14 }} />
                  <Typography variant="body2">{section.room}</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAddModalOpen(true)}>
          Add Student
        </Button>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setIsImportModalOpen(true)}>
          Import CSV
        </Button>
      </Box>

      {/* Loading state */}
      {loading && !roster && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert
          severity="error"
          action={
            <Button size="small" onClick={() => fetchRoster(section.id)}>Try again</Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Student list */}
      {roster && (
        <StudentList
          students={roster.students}
          onEdit={(student) => setEditingStudent(student)}
          onDelete={(student) => setDeletingStudent(student)}
        />
      )}

      {/* Add Student Modal */}
      <StudentFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        sectionId={section.id}
      />

      {/* Edit Student Modal */}
      <StudentFormModal
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        sectionId={section.id}
        student={editingStudent ?? undefined}
        onSuccess={() => setEditingStudent(null)}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sectionId={section.id}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingStudent}
        onClose={() => setDeletingStudent(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Student"
        message={`Are you sure you want to delete ${deletingStudent?.firstName} ${deletingStudent?.lastName}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </Box>
  )
}
