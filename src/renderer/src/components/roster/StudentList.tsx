import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import EmailIcon from '@mui/icons-material/Email'
import TagIcon from '@mui/icons-material/Tag'
import type { Student, DOKLevel } from '../../../../shared/types'
import { DOK_LABELS, DOK_DESCRIPTIONS, DOK_LEVELS } from '../../../../shared/types'

// Color coding for DOK levels
const DOK_COLORS: Record<DOKLevel, string> = {
  1: '#4caf50', // Green - Recall
  2: '#2196f3', // Blue - Skill/Concept
  3: '#ff9800', // Orange - Strategic Thinking
  4: '#9c27b0'  // Purple - Extended Thinking
}

interface StudentListProps {
  students: Student[]
  onEdit: (student: Student) => void
  onDelete: (student: Student) => void
  onUpdateDOK?: (studentId: string, dokLevel: DOKLevel) => void
}

export function StudentList({ students, onEdit, onDelete, onUpdateDOK }: StudentListProps): ReactElement {
  // Filter to show only active students, sorted by last name
  const activeStudents = students
    .filter((s) => s.active)
    .sort((a, b) => a.lastName.localeCompare(b.lastName))

  if (activeStudents.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No students in this section yet.
        </Typography>
      </Box>
    )
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 500 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 500 }}>Student #</TableCell>
            <TableCell sx={{ fontWeight: 500 }}>Email</TableCell>
            <TableCell sx={{ fontWeight: 500 }}>DOK Level</TableCell>
            <TableCell align="right" sx={{ fontWeight: 500 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {activeStudents.map((student) => (
            <TableRow
              key={student.id}
              hover
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={500}>
                  {student.lastName}, {student.firstName}
                </Typography>
              </TableCell>
              <TableCell>
                {student.studentNumber ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TagIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">
                      {student.studentNumber}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.disabled">-</Typography>
                )}
              </TableCell>
              <TableCell>
                {student.email ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EmailIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">
                      {student.email}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.disabled">-</Typography>
                )}
              </TableCell>
              <TableCell>
                <Tooltip title={DOK_DESCRIPTIONS[student.dokLevel]} placement="top">
                  <Select
                    value={student.dokLevel}
                    onChange={(e) => onUpdateDOK?.(student.id, e.target.value as DOKLevel)}
                    size="small"
                    variant="standard"
                    disabled={!onUpdateDOK}
                    sx={{
                      minWidth: 120,
                      '& .MuiSelect-select': {
                        py: 0.5,
                        color: DOK_COLORS[student.dokLevel],
                        fontWeight: 500
                      },
                      '&:before': { borderBottom: 'none' },
                      '&:hover:not(.Mui-disabled):before': { borderBottom: 'none' }
                    }}
                  >
                    {DOK_LEVELS.map((level) => (
                      <MenuItem key={level} value={level}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: DOK_COLORS[level]
                            }}
                          />
                          <Typography variant="body2">
                            {level} - {DOK_LABELS[level]}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => onEdit(student)}
                    title="Edit student"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main',
                        bgcolor: 'primary.light'
                      }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => onDelete(student)}
                    title="Delete student"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'error.main',
                        bgcolor: 'error.light'
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
