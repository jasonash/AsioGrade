import { type ReactElement, useState, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import UploadIcon from '@mui/icons-material/Upload'
import DescriptionIcon from '@mui/icons-material/Description'
import ErrorIcon from '@mui/icons-material/Error'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DownloadIcon from '@mui/icons-material/Download'
import { Modal } from '../ui'
import { useRosterStore } from '../../stores'
import type { CreateStudentInput } from '../../../../shared/types'

interface CSVImportModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  onSuccess?: (count: number) => void
}

interface ParsedStudent {
  firstName: string
  lastName: string
  email?: string
  studentNumber?: string
  valid: boolean
  error?: string
}

export function CSVImportModal({
  isOpen,
  onClose,
  sectionId,
  onSuccess
}: CSVImportModalProps): ReactElement {
  const { importStudents, error: storeError, clearError } = useRosterStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const resetState = useCallback(() => {
    setFile(null)
    setParsedStudents([])
    setParseError(null)
    clearError()
  }, [clearError])

  const downloadTemplate = useCallback(async () => {
    const templateContent = `firstName,lastName,email,studentNumber
John,Smith,john.smith@school.edu,12345
Jane,Doe,jane.doe@school.edu,12346
`
    // Convert to base64 for the save dialog
    const base64Data = btoa(templateContent)

    // Use save dialog (remembers last directory)
    await window.electronAPI.invoke('file:saveWithDialog', {
      data: base64Data,
      defaultFilename: 'student_roster_template.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
  }, [])

  const parseCSV = useCallback((content: string): ParsedStudent[] => {
    const lines = content.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one student')
    }

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim())

    // Find column indices
    const firstNameIdx = header.findIndex(
      (h) => h === 'firstname' || h === 'first name' || h === 'first'
    )
    const lastNameIdx = header.findIndex(
      (h) => h === 'lastname' || h === 'last name' || h === 'last'
    )
    const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail')
    const studentNumberIdx = header.findIndex(
      (h) => h === 'studentnumber' || h === 'student number' || h === 'id' || h === 'student id'
    )

    if (firstNameIdx === -1 || lastNameIdx === -1) {
      throw new Error('CSV must have "firstName" and "lastName" columns')
    }

    const students: ParsedStudent[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map((v) => v.trim())

      const firstName = values[firstNameIdx] ?? ''
      const lastName = values[lastNameIdx] ?? ''
      const email = emailIdx !== -1 ? values[emailIdx] : undefined
      const studentNumber = studentNumberIdx !== -1 ? values[studentNumberIdx] : undefined

      const valid = firstName.length > 0 && lastName.length > 0

      students.push({
        firstName,
        lastName,
        email: email || undefined,
        studentNumber: studentNumber || undefined,
        valid,
        error: valid ? undefined : 'Missing first or last name'
      })
    }

    return students
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (!selectedFile) return

      setFile(selectedFile)
      setParseError(null)

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string
          const students = parseCSV(content)
          setParsedStudents(students)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse CSV'
          setParseError(message)
          setParsedStudents([])
        }
      }
      reader.onerror = () => {
        setParseError('Failed to read file')
        setParsedStudents([])
      }
      reader.readAsText(selectedFile)
    },
    [parseCSV]
  )

  const handleImport = useCallback(async () => {
    const validStudents = parsedStudents.filter((s) => s.valid)
    if (validStudents.length === 0) return

    setIsImporting(true)

    const inputs: CreateStudentInput[] = validStudents.map((s) => ({
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      studentNumber: s.studentNumber
    }))

    const count = await importStudents(sectionId, inputs)

    setIsImporting(false)

    if (count > 0) {
      onSuccess?.(count)
      onClose()
      resetState()
    }
  }, [parsedStudents, sectionId, importStudents, onSuccess, onClose, resetState])

  const handleClose = useCallback(() => {
    onClose()
    resetState()
  }, [onClose, resetState])

  const validCount = parsedStudents.filter((s) => s.valid).length
  const invalidCount = parsedStudents.filter((s) => !s.valid).length

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Students from CSV" size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Instructions */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Upload a CSV file with student information. Required columns:
            </Typography>
            <Box component="ul" sx={{ mt: 0.5, ml: 2, pl: 2, listStyleType: 'disc' }}>
              <Typography component="li" variant="body2" color="text.secondary">
                <code>firstName</code> (required)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                <code>lastName</code> (required)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                <code>email</code> (optional)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                <code>studentNumber</code> (optional)
              </Typography>
            </Box>
          </Box>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={downloadTemplate}
            sx={{ flexShrink: 0 }}
          >
            Template
          </Button>
        </Box>

        {/* Error display */}
        {(parseError || storeError) && (
          <Alert severity="error">{parseError || storeError}</Alert>
        )}

        {/* File upload */}
        <Box>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: 'dashed',
              borderWidth: 2,
              '&:hover': {
                borderColor: 'primary.main'
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Typography fontWeight={500}>{file.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Click to change file
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <UploadIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                <Typography color="text.secondary">Click to upload CSV file</Typography>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Preview */}
        {parsedStudents.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">
                Preview ({parsedStudents.length} rows)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                  <CheckCircleIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption">{validCount} valid</Typography>
                </Box>
                {invalidCount > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
                    <ErrorIcon sx={{ fontSize: 14 }} />
                    <Typography variant="caption">{invalidCount} invalid</Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>Student #</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedStudents.slice(0, 10).map((student, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {student.valid ? (
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {student.firstName} {student.lastName}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {student.email || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {student.studentNumber || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {parsedStudents.length > 10 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                ... and {parsedStudents.length - 10} more
              </Typography>
            )}
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            variant="outlined"
            onClick={handleClose}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={isImporting || validCount === 0}
            startIcon={isImporting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isImporting ? 'Importing...' : `Import ${validCount} Students`}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}
