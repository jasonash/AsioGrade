import { type ReactElement, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import MenuItem from '@mui/material/MenuItem'
import Select, { type SelectChangeEvent } from '@mui/material/Select'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import type { Student, DOKLevel } from '../../../../shared/types'
import { DOK_LABELS, DOK_LEVELS, DOK_DESCRIPTIONS } from '../../../../shared/types'

interface DOKOverride {
  studentId: string
  dokLevel: DOKLevel
}

interface DOKChecklistProps {
  students: Student[]
  overrides: DOKOverride[]
  onOverridesChange: (overrides: DOKOverride[]) => void
  disabled?: boolean
}

// DOK level colors
const DOK_COLORS: Record<DOKLevel, 'success' | 'info' | 'warning' | 'secondary'> = {
  1: 'success',
  2: 'info',
  3: 'warning',
  4: 'secondary'
}

export function DOKChecklist({
  students,
  overrides,
  onOverridesChange,
  disabled = false
}: DOKChecklistProps): ReactElement {
  // Create a map of current effective DOK levels
  const effectiveDOK = useMemo(() => {
    const map = new Map<string, DOKLevel>()
    students.forEach((s) => {
      const override = overrides.find((o) => o.studentId === s.id)
      map.set(s.id, override?.dokLevel ?? s.dokLevel)
    })
    return map
  }, [students, overrides])

  // Check if student has override
  const hasOverride = useCallback(
    (studentId: string): boolean => {
      return overrides.some((o) => o.studentId === studentId)
    },
    [overrides]
  )

  // Handle DOK change for a single student
  const handleDOKChange = useCallback(
    (studentId: string, event: SelectChangeEvent<number>) => {
      const newDOK = event.target.value as DOKLevel
      const student = students.find((s) => s.id === studentId)
      if (!student) return

      // If setting back to roster DOK, remove override
      if (newDOK === student.dokLevel) {
        onOverridesChange(overrides.filter((o) => o.studentId !== studentId))
      } else {
        // Add or update override
        const existing = overrides.find((o) => o.studentId === studentId)
        if (existing) {
          onOverridesChange(
            overrides.map((o) => (o.studentId === studentId ? { ...o, dokLevel: newDOK } : o))
          )
        } else {
          onOverridesChange([...overrides, { studentId, dokLevel: newDOK }])
        }
      }
    },
    [students, overrides, onOverridesChange]
  )

  // Reset all overrides
  const handleResetAll = useCallback(() => {
    onOverridesChange([])
  }, [onOverridesChange])

  // Count overrides
  const overrideCount = overrides.length

  return (
    <Box>
      {/* Header with actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Student DOK Levels
          {overrideCount > 0 && (
            <Chip
              label={`${overrideCount} override${overrideCount !== 1 ? 's' : ''}`}
              size="small"
              color="warning"
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        {overrideCount > 0 && (
          <Button
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={handleResetAll}
            disabled={disabled}
          >
            Reset All
          </Button>
        )}
      </Box>

      {/* Student table */}
      <TableContainer sx={{ maxHeight: 280 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell align="center" width={100}>
                Roster DOK
              </TableCell>
              <TableCell align="center" width={140}>
                For This Assessment
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.map((student) => {
              const currentDOK = effectiveDOK.get(student.id) ?? student.dokLevel
              const isOverridden = hasOverride(student.id)

              return (
                <TableRow key={student.id} hover>
                  <TableCell>
                    {student.lastName}, {student.firstName}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={DOK_DESCRIPTIONS[student.dokLevel]}>
                      <Chip
                        label={`${student.dokLevel} - ${DOK_LABELS[student.dokLevel]}`}
                        size="small"
                        color={DOK_COLORS[student.dokLevel]}
                        variant="outlined"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Select
                      size="small"
                      value={currentDOK}
                      onChange={(e) => handleDOKChange(student.id, e)}
                      disabled={disabled}
                      sx={{
                        minWidth: 120,
                        ...(isOverridden && {
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'warning.main'
                          }
                        })
                      }}
                    >
                      {DOK_LEVELS.map((level) => (
                        <MenuItem key={level} value={level}>
                          {level} - {DOK_LABELS[level]}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Help text */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Override DOK levels for this assessment only. Changes don&apos;t affect roster DOK.
      </Typography>
    </Box>
  )
}
