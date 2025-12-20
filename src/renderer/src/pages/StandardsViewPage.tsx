import { type ReactElement, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Tooltip from '@mui/material/Tooltip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CategoryIcon from '@mui/icons-material/Category'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SourceIcon from '@mui/icons-material/Source'
import { useStandardsStore } from '../stores'
import { ConfirmModal } from '../components/ui'
import { StandardsImportModal } from '../components/standards/StandardsImportModal'
import { DomainFormModal } from '../components/standards/DomainFormModal'
import { StandardFormModal } from '../components/standards/StandardFormModal'
import type { CourseSummary, StandardDomain, Standard, StandardsSummary } from '../../../shared/types'

interface StandardsViewPageProps {
  course: CourseSummary
  onBack: () => void
}

export function StandardsViewPage({ course, onBack }: StandardsViewPageProps): ReactElement {
  const {
    summaries,
    currentCollection,
    loading,
    error,
    fetchCollections,
    fetchCollection,
    deleteCollection,
    deleteDomain,
    deleteStandard,
    clearError
  } = useStandardsStore()

  // Selected collection ID
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)

  // Modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false)
  const [isStandardModalOpen, setIsStandardModalOpen] = useState(false)
  const [isDeleteDomainModalOpen, setIsDeleteDomainModalOpen] = useState(false)
  const [isDeleteStandardModalOpen, setIsDeleteStandardModalOpen] = useState(false)
  const [isDeleteCollectionModalOpen, setIsDeleteCollectionModalOpen] = useState(false)

  // Edit/Delete targets
  const [editingDomain, setEditingDomain] = useState<StandardDomain | null>(null)
  const [editingStandard, setEditingStandard] = useState<{ domain: StandardDomain; standard: Standard } | null>(null)
  const [deletingDomain, setDeletingDomain] = useState<StandardDomain | null>(null)
  const [deletingStandard, setDeletingStandard] = useState<{ domain: StandardDomain; standard: Standard } | null>(null)
  const [addingStandardToDomain, setAddingStandardToDomain] = useState<StandardDomain | null>(null)

  // Loading states
  const [isDeleting, setIsDeleting] = useState(false)

  // Accordion expansion state - all closed by default
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())

  // Fetch collections when component mounts
  useEffect(() => {
    fetchCollections(course.id)
    setExpandedDomains(new Set())
  }, [course.id, fetchCollections])

  // Auto-select first collection when summaries load
  useEffect(() => {
    if (summaries.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(summaries[0].id)
    }
  }, [summaries, selectedCollectionId])

  // Fetch selected collection when it changes
  useEffect(() => {
    if (selectedCollectionId) {
      fetchCollection(course.id, selectedCollectionId)
    }
  }, [selectedCollectionId, course.id, fetchCollection])

  const handleCollectionChange = (collectionId: string): void => {
    setSelectedCollectionId(collectionId)
    setExpandedDomains(new Set())
  }

  const handleToggleDomain = (domainCode: string): void => {
    setExpandedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domainCode)) {
        next.delete(domainCode)
      } else {
        next.add(domainCode)
      }
      return next
    })
  }

  // Domain CRUD handlers
  const handleEditDomain = (domain: StandardDomain): void => {
    setEditingDomain(domain)
    setIsDomainModalOpen(true)
  }

  const handleAddDomain = (): void => {
    setEditingDomain(null)
    setIsDomainModalOpen(true)
  }

  const handleDeleteDomainClick = (domain: StandardDomain): void => {
    setDeletingDomain(domain)
    setIsDeleteDomainModalOpen(true)
  }

  const handleConfirmDeleteDomain = async (): Promise<void> => {
    if (!deletingDomain) return
    setIsDeleting(true)
    const success = await deleteDomain(deletingDomain.code)
    setIsDeleting(false)
    if (success) {
      setIsDeleteDomainModalOpen(false)
      setDeletingDomain(null)
    }
  }

  // Standard CRUD handlers
  const handleEditStandard = (domain: StandardDomain, standard: Standard): void => {
    setEditingStandard({ domain, standard })
    setAddingStandardToDomain(null)
    setIsStandardModalOpen(true)
  }

  const handleAddStandard = (domain: StandardDomain): void => {
    setEditingStandard(null)
    setAddingStandardToDomain(domain)
    setIsStandardModalOpen(true)
  }

  const handleDeleteStandardClick = (domain: StandardDomain, standard: Standard): void => {
    setDeletingStandard({ domain, standard })
    setIsDeleteStandardModalOpen(true)
  }

  const handleConfirmDeleteStandard = async (): Promise<void> => {
    if (!deletingStandard) return
    setIsDeleting(true)
    const success = await deleteStandard(
      deletingStandard.domain.code,
      deletingStandard.standard.code
    )
    setIsDeleting(false)
    if (success) {
      setIsDeleteStandardModalOpen(false)
      setDeletingStandard(null)
    }
  }

  // Collection delete handlers
  const handleDeleteCollectionClick = (): void => {
    setIsDeleteCollectionModalOpen(true)
  }

  const handleConfirmDeleteCollection = async (): Promise<void> => {
    if (!selectedCollectionId) return
    setIsDeleting(true)
    const success = await deleteCollection(course.id, selectedCollectionId)
    setIsDeleting(false)
    if (success) {
      setIsDeleteCollectionModalOpen(false)
      setSelectedCollectionId(summaries.length > 1 ? summaries.find(s => s.id !== selectedCollectionId)?.id ?? null : null)
    }
  }

  // Calculate totals
  const domainCount = currentCollection?.domains.length ?? 0
  const standardCount = currentCollection?.domains.reduce((sum: number, d: StandardDomain) => sum + d.standards.length, 0) ?? 0

  // Format source info
  const getSourceInfo = (): string => {
    if (!currentCollection) return ''
    const { source } = currentCollection
    if (source.type === 'url') return `Imported from URL`
    if (source.type === 'pdf') return `Imported from ${source.filename || 'PDF'}`
    return 'Manual entry'
  }

  const getSourceDate = (): string => {
    if (!currentCollection?.source.fetchedAt) return ''
    return new Date(currentCollection.source.fetchedAt).toLocaleDateString()
  }

  const selectedSummary: StandardsSummary | undefined = summaries.find(s => s.id === selectedCollectionId)

  // Loading state
  if (loading && summaries.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  // No collections
  if (summaries.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
        <Box component="header">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ mb: 2, color: 'text.secondary' }}
          >
            Back to {course.name}
          </Button>
          <Typography variant="h5" fontWeight={700}>
            Standards for {course.name}
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <MenuBookIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography fontWeight={500} gutterBottom>
            No standards imported
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Import teaching standards to align with your units and assessments.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsImportModalOpen(true)}
          >
            Import Standards
          </Button>
        </Paper>

        <StandardsImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          courseId={course.id}
          courseName={course.name}
          courseSubject={course.subject}
          courseGradeLevel={course.gradeLevel}
          onSuccess={() => {
            setIsImportModalOpen(false)
            fetchCollections(course.id)
          }}
        />
      </Box>
    )
  }

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
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={700}>
              Standards for {course.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {summaries.length} collection{summaries.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsImportModalOpen(true)}
          >
            Add Collection
          </Button>
        </Box>
      </Box>

      {/* Collection Selector */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          select
          label="Standards Collection"
          value={selectedCollectionId ?? ''}
          onChange={(e) => handleCollectionChange(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        >
          {summaries.map((summary: StandardsSummary) => (
            <MenuItem key={summary.id} value={summary.id}>
              {summary.name} ({summary.standardCount} standards)
            </MenuItem>
          ))}
        </TextField>
        {selectedCollectionId && (
          <Tooltip title="Delete this collection">
            <IconButton
              size="small"
              color="error"
              onClick={handleDeleteCollectionClick}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Loading selected collection */}
      {loading && !currentCollection && selectedCollectionId && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Selected collection content */}
      {currentCollection && selectedSummary && (
        <>
          {/* Collection header with edit actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip label={currentCollection.framework} size="small" variant="outlined" />
              <Typography variant="body2" color="text.secondary">
                {currentCollection.state} • {domainCount} domains, {standardCount} standards
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddDomain}
            >
              Add Domain
            </Button>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CategoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">Domains</Typography>
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  {domainCount}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <MenuBookIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">Standards</Typography>
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  {standardCount}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <SourceIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">Source</Typography>
                </Box>
                <Typography variant="body1" fontWeight={500}>
                  {getSourceInfo()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {getSourceDate()}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Domains List */}
          <Box component="section">
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Domains & Standards
            </Typography>

            {currentCollection.domains.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <CategoryIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">
                  No domains yet. Add a domain to get started.
                </Typography>
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={handleAddDomain}
                >
                  Add Domain
                </Button>
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {currentCollection.domains.map((domain: StandardDomain) => (
                  <Accordion
                    key={domain.code}
                    expanded={expandedDomains.has(domain.code)}
                    onChange={() => handleToggleDomain(domain.code)}
                    disableGutters
                    sx={{
                      '&:before': { display: 'none' },
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      '&:first-of-type': { borderRadius: 1 },
                      '&:last-of-type': { borderRadius: 1 }
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        '& .MuiAccordionSummary-content': {
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mr: 1
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                        <Chip label={domain.code} size="small" color="primary" />
                        <Typography variant="body1" fontWeight={500}>
                          {domain.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ({domain.standards.length} standards)
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: 'flex', gap: 0.5 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip title="Edit domain">
                          <IconButton
                            size="small"
                            onClick={() => handleEditDomain(domain)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete domain">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteDomainClick(domain)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, pb: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {domain.standards.map((standard: Standard) => (
                          <Paper
                            key={standard.code}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1.5,
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <Chip
                              label={standard.code}
                              size="small"
                              variant="outlined"
                              sx={{ flexShrink: 0 }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2">
                                {standard.description}
                              </Typography>
                              {standard.keywords && standard.keywords.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                  {standard.keywords.slice(0, 5).map((keyword: string) => (
                                    <Chip
                                      key={keyword}
                                      label={keyword}
                                      size="small"
                                      variant="outlined"
                                      sx={{ fontSize: '0.65rem', height: 18 }}
                                    />
                                  ))}
                                  {standard.keywords.length > 5 && (
                                    <Chip
                                      label={`+${standard.keywords.length - 5}`}
                                      size="small"
                                      variant="outlined"
                                      sx={{ fontSize: '0.65rem', height: 18 }}
                                    />
                                  )}
                                </Box>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                              <Tooltip title="Edit standard">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditStandard(domain, standard)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete standard">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteStandardClick(domain, standard)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Paper>
                        ))}

                        {/* Add Standard button */}
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleAddStandard(domain)}
                          sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                        >
                          Add Standard
                        </Button>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Box>
        </>
      )}

      {/* Import Modal */}
      <StandardsImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        courseId={course.id}
        courseName={course.name}
        courseSubject={course.subject}
        courseGradeLevel={course.gradeLevel}
        onSuccess={() => {
          setIsImportModalOpen(false)
          fetchCollections(course.id)
        }}
      />

      {/* Domain Form Modal */}
      <DomainFormModal
        isOpen={isDomainModalOpen}
        onClose={() => {
          setIsDomainModalOpen(false)
          setEditingDomain(null)
        }}
        domain={editingDomain ?? undefined}
        onSuccess={() => {
          setIsDomainModalOpen(false)
          setEditingDomain(null)
        }}
      />

      {/* Standard Form Modal */}
      <StandardFormModal
        isOpen={isStandardModalOpen}
        onClose={() => {
          setIsStandardModalOpen(false)
          setEditingStandard(null)
          setAddingStandardToDomain(null)
        }}
        domainCode={editingStandard?.domain.code ?? addingStandardToDomain?.code ?? ''}
        domainName={editingStandard?.domain.name ?? addingStandardToDomain?.name ?? ''}
        standard={editingStandard?.standard}
        onSuccess={() => {
          setIsStandardModalOpen(false)
          setEditingStandard(null)
          setAddingStandardToDomain(null)
        }}
      />

      {/* Delete Domain Confirmation */}
      <ConfirmModal
        isOpen={isDeleteDomainModalOpen}
        onClose={() => {
          setIsDeleteDomainModalOpen(false)
          setDeletingDomain(null)
        }}
        onConfirm={handleConfirmDeleteDomain}
        title="Delete Domain"
        message={
          deletingDomain
            ? `Are you sure you want to delete "${deletingDomain.name}"? This will also delete all ${deletingDomain.standards.length} standards in this domain. This action cannot be undone.`
            : ''
        }
        confirmText="Delete Domain"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Delete Standard Confirmation */}
      <ConfirmModal
        isOpen={isDeleteStandardModalOpen}
        onClose={() => {
          setIsDeleteStandardModalOpen(false)
          setDeletingStandard(null)
        }}
        onConfirm={handleConfirmDeleteStandard}
        title="Delete Standard"
        message={
          deletingStandard
            ? `Are you sure you want to delete standard "${deletingStandard.standard.code}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete Standard"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Delete Collection Confirmation */}
      <ConfirmModal
        isOpen={isDeleteCollectionModalOpen}
        onClose={() => setIsDeleteCollectionModalOpen(false)}
        onConfirm={handleConfirmDeleteCollection}
        title="Delete Collection"
        message={
          selectedSummary
            ? `Are you sure you want to delete "${selectedSummary.name}"? This will delete all ${selectedSummary.domainCount} domains and ${selectedSummary.standardCount} standards. This action cannot be undone.`
            : ''
        }
        confirmText="Delete Collection"
        variant="danger"
        isLoading={isDeleting}
      />
    </Box>
  )
}
