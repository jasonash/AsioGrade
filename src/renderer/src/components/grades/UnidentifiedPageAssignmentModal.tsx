import { type ReactElement, useState, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import WarningIcon from '@mui/icons-material/Warning'
import PersonIcon from '@mui/icons-material/Person'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { Modal } from '../ui'
import type { UnidentifiedPage, Student } from '../../../../shared/types'

interface UnidentifiedPageAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  page: UnidentifiedPage | null
  students: Student[]
  gradedStudentIds: Set<string>
  onAssign: (pageNumber: number, studentId: string) => void
}

export function UnidentifiedPageAssignmentModal({
  isOpen,
  onClose,
  page,
  students,
  gradedStudentIds,
  onAssign
}: UnidentifiedPageAssignmentModalProps): ReactElement {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)

  // Get available (ungraded) students
  const availableStudents = useMemo(() => {
    return students
      .filter((s) => !gradedStudentIds.has(s.id))
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
  }, [students, gradedStudentIds])

  // Get suggested students (from OCR matching)
  const suggestedStudents = useMemo(() => {
    if (!page?.suggestedStudents) return []
    return page.suggestedStudents
      .map((id) => students.find((s) => s.id === id))
      .filter((s): s is Student => s !== undefined)
  }, [page, students])

  const handleAssign = useCallback(async () => {
    if (!page || !selectedStudentId) return

    setIsAssigning(true)
    try {
      onAssign(page.pageNumber, selectedStudentId)
      setSelectedStudentId('')
      onClose()
    } finally {
      setIsAssigning(false)
    }
  }, [page, selectedStudentId, onAssign, onClose])

  const handleClose = useCallback(() => {
    if (!isAssigning) {
      setSelectedStudentId('')
      onClose()
    }
  }, [isAssigning, onClose])

  if (!page) return <></>

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Assign Unidentified Scantron" size="md">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Page Info */}
        <Alert
          severity="warning"
          icon={<WarningIcon />}
          sx={{ '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Page {page.pageNumber} - QR Code Unreadable
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {page.qrError || 'The QR code on this scantron could not be read.'}
          </Typography>
        </Alert>

        {/* OCR Result */}
        {page.ocrStudentName && (
          <Box sx={{ bgcolor: 'info.light', p: 2, borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AutoFixHighIcon color="info" fontSize="small" />
              <Typography variant="subtitle2">Name Detected via OCR</Typography>
            </Box>
            <Typography
              variant="body1"
              sx={{ fontWeight: 600, fontStyle: 'italic', pl: 3.5 }}
            >
              &ldquo;{page.ocrStudentName}&rdquo;
            </Typography>
          </Box>
        )}

        {/* Suggested Matches */}
        {suggestedStudents.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Suggested Matches
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {suggestedStudents.map((student, index) => (
                <Chip
                  key={student.id}
                  icon={<PersonIcon />}
                  label={`${student.lastName}, ${student.firstName}`}
                  color={index === 0 ? 'primary' : 'default'}
                  variant={selectedStudentId === student.id ? 'filled' : 'outlined'}
                  onClick={() => setSelectedStudentId(student.id)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Divider />

        {/* Student Selection */}
        <FormControl fullWidth>
          <InputLabel id="student-select-label">Assign to Student</InputLabel>
          <Select
            labelId="student-select-label"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            label="Assign to Student"
          >
            <MenuItem value="">
              <em>Select a student...</em>
            </MenuItem>
            {availableStudents.map((student) => {
              const isSuggested = page.suggestedStudents?.includes(student.id)
              return (
                <MenuItem key={student.id} value={student.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {student.lastName}, {student.firstName}
                    {isSuggested && (
                      <Chip
                        label="Match"
                        size="small"
                        color="primary"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </MenuItem>
              )
            })}
          </Select>
        </FormControl>

        {/* Already graded students info */}
        {gradedStudentIds.size > 0 && (
          <Typography variant="caption" color="text.secondary">
            {gradedStudentIds.size} student{gradedStudentIds.size !== 1 ? 's have' : ' has'} already
            been graded and {gradedStudentIds.size !== 1 ? 'are' : 'is'} not shown above.
          </Typography>
        )}

        {/* Detected Answers Preview */}
        {page.detectedAnswers && page.detectedAnswers.length > 0 && (
          <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Detected Answers
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {page.detectedAnswers.map((a) => a.selected || '-').join(', ')}
            </Typography>
          </Box>
        )}

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Button variant="outlined" onClick={handleClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={!selectedStudentId || isAssigning}
          >
            {isAssigning ? 'Assigning...' : 'Assign to Student'}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
