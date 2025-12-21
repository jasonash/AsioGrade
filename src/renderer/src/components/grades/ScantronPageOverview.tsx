import { type ReactElement, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DescriptionIcon from '@mui/icons-material/Description'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import CloseIcon from '@mui/icons-material/Close'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import type { ParsedScantron, UnidentifiedPage, Student } from '../../../../shared/types'

interface ScantronPageOverviewProps {
  parsedPages: ParsedScantron[]
  unidentifiedPages: UnidentifiedPage[]
  students: Student[]
  onAssignPage: (page: UnidentifiedPage) => void
}

type PageStatus = 'valid' | 'unidentified' | 'blank' | 'unknown'

interface PageInfo {
  pageNumber: number
  status: PageStatus
  studentName?: string
  wasRotated: boolean
  answers: string[]
  ocrName?: string
  qrError?: string
}

export function ScantronPageOverview({
  parsedPages,
  unidentifiedPages,
  students,
  onAssignPage
}: ScantronPageOverviewProps): ReactElement {
  const [selectedPage, setSelectedPage] = useState<PageInfo | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Build student ID to name mapping
  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, `${s.lastName}, ${s.firstName}`])),
    [students]
  )

  // Build page info from parsed pages and unidentified pages
  const pageInfoList = useMemo<PageInfo[]>(() => {
    const unidentifiedMap = new Map(unidentifiedPages.map((p) => [p.pageNumber, p]))

    return parsedPages.map((page) => {
      const unidentified = unidentifiedMap.get(page.pageNumber)
      const wasRotated = page.flags.includes('rotated_180')
      const answers = page.answers.map((a) => a.selected || '-')

      if (unidentified) {
        return {
          pageNumber: page.pageNumber,
          status: 'unidentified' as PageStatus,
          wasRotated,
          answers,
          ocrName: unidentified.ocrStudentName,
          qrError: unidentified.qrError
        }
      }

      if (page.qrData) {
        const studentName = studentMap.get(page.qrData.sid) || `Unknown (${page.qrData.sid})`
        return {
          pageNumber: page.pageNumber,
          status: 'valid' as PageStatus,
          studentName,
          wasRotated,
          answers
        }
      }

      // Check if page appears blank
      const hasAnswers = page.answers.some((a) => a.selected !== null)
      if (!hasAnswers && !page.qrData) {
        return {
          pageNumber: page.pageNumber,
          status: 'blank' as PageStatus,
          wasRotated,
          answers
        }
      }

      return {
        pageNumber: page.pageNumber,
        status: 'unknown' as PageStatus,
        wasRotated,
        answers
      }
    })
  }, [parsedPages, unidentifiedPages, studentMap])

  const getStatusColor = (status: PageStatus) => {
    switch (status) {
      case 'valid':
        return 'success'
      case 'unidentified':
        return 'warning'
      case 'blank':
        return 'default'
      case 'unknown':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: PageStatus) => {
    switch (status) {
      case 'valid':
        return <CheckCircleIcon fontSize="small" />
      case 'unidentified':
        return <WarningIcon fontSize="small" />
      case 'blank':
        return <DescriptionIcon fontSize="small" />
      case 'unknown':
        return <HelpOutlineIcon fontSize="small" />
      default:
        return <DescriptionIcon fontSize="small" />
    }
  }

  const handlePageClick = (pageInfo: PageInfo) => {
    setSelectedPage(pageInfo)
    setDetailsOpen(true)
  }

  const handleAssignClick = (pageInfo: PageInfo) => {
    const unidentifiedPage = unidentifiedPages.find((p) => p.pageNumber === pageInfo.pageNumber)
    if (unidentifiedPage) {
      onAssignPage(unidentifiedPage)
    }
  }

  // Group stats
  const stats = useMemo(() => {
    return {
      total: pageInfoList.length,
      valid: pageInfoList.filter((p) => p.status === 'valid').length,
      unidentified: pageInfoList.filter((p) => p.status === 'unidentified').length,
      rotated: pageInfoList.filter((p) => p.wasRotated).length
    }
  }, [pageInfoList])

  return (
    <Box>
      {/* Summary Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Chip
          icon={<DescriptionIcon />}
          label={`${stats.total} pages`}
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<CheckCircleIcon />}
          label={`${stats.valid} identified`}
          color="success"
          variant="outlined"
          size="small"
        />
        {stats.unidentified > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${stats.unidentified} unidentified`}
            color="warning"
            variant="outlined"
            size="small"
          />
        )}
        {stats.rotated > 0 && (
          <Chip
            icon={<RotateRightIcon />}
            label={`${stats.rotated} rotated`}
            variant="outlined"
            size="small"
          />
        )}
      </Box>

      {/* Page Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 1.5
        }}
      >
        {pageInfoList.map((pageInfo) => (
          <Paper
            key={pageInfo.pageNumber}
            elevation={pageInfo.status === 'unidentified' ? 3 : 1}
            sx={{
              p: 1.5,
              cursor: 'pointer',
              border: 2,
              borderColor:
                pageInfo.status === 'valid'
                  ? 'success.light'
                  : pageInfo.status === 'unidentified'
                    ? 'warning.main'
                    : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4
              }
            }}
            onClick={() => handlePageClick(pageInfo)}
          >
            {/* Page Number and Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Page {pageInfo.pageNumber}</Typography>
              <Chip
                icon={getStatusIcon(pageInfo.status)}
                label={pageInfo.status}
                size="small"
                color={getStatusColor(pageInfo.status) as 'success' | 'warning' | 'error' | 'default'}
                sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-icon': { fontSize: 12 } }}
              />
            </Box>

            {/* Student Name or OCR */}
            <Typography
              variant="body2"
              color={pageInfo.status === 'valid' ? 'text.primary' : 'text.secondary'}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontStyle: pageInfo.ocrName ? 'italic' : 'normal'
              }}
            >
              {pageInfo.studentName || pageInfo.ocrName || '—'}
            </Typography>

            {/* Rotation indicator */}
            {pageInfo.wasRotated && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <RotateRightIcon sx={{ fontSize: 12, color: 'text.secondary', mr: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  Rotated
                </Typography>
              </Box>
            )}

            {/* Assign button for unidentified */}
            {pageInfo.status === 'unidentified' && (
              <Box sx={{ mt: 1 }}>
                <Tooltip title="Assign to student">
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAssignClick(pageInfo)
                    }}
                    sx={{
                      bgcolor: 'warning.light',
                      '&:hover': { bgcolor: 'warning.main' }
                    }}
                  >
                    <PersonAddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Paper>
        ))}
      </Box>

      {/* Page Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Page {selectedPage?.pageNumber} Details
          </Typography>
          <IconButton onClick={() => setDetailsOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPage && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Status */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Status
                </Typography>
                <Chip
                  icon={getStatusIcon(selectedPage.status)}
                  label={selectedPage.status.charAt(0).toUpperCase() + selectedPage.status.slice(1)}
                  color={getStatusColor(selectedPage.status) as 'success' | 'warning' | 'error' | 'default'}
                />
              </Box>

              {/* Student */}
              {selectedPage.studentName && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Student
                  </Typography>
                  <Typography variant="body1">{selectedPage.studentName}</Typography>
                </Box>
              )}

              {/* OCR Result */}
              {selectedPage.ocrName && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    OCR Detected Name
                  </Typography>
                  <Typography variant="body1" fontStyle="italic">
                    &ldquo;{selectedPage.ocrName}&rdquo;
                  </Typography>
                </Box>
              )}

              {/* QR Error */}
              {selectedPage.qrError && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    QR Code Issue
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    {selectedPage.qrError}
                  </Typography>
                </Box>
              )}

              {/* Rotation */}
              {selectedPage.wasRotated && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Orientation
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RotateRightIcon color="action" />
                    <Typography variant="body2">
                      Page was rotated 180° during processing
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Detected Answers */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Detected Answers
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 0.5,
                    bgcolor: 'action.hover',
                    p: 1.5,
                    borderRadius: 1
                  }}
                >
                  {selectedPage.answers.map((answer, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        py: 0.5
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {idx + 1}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: answer === '-' ? 'text.disabled' : 'text.primary'
                        }}
                      >
                        {answer}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
