import { type ReactElement, useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { useCourseMaterialStore } from '../../stores'
import { CourseMaterialCard } from './CourseMaterialCard'
import { MaterialUploadModal } from './MaterialUploadModal'
import { ConfirmModal } from '../ui'

interface CourseMaterialsSectionProps {
  courseId: string
  courseName: string
}

export function CourseMaterialsSection({
  courseId,
  courseName
}: CourseMaterialsSectionProps): ReactElement {
  const {
    materials,
    isLoading,
    error,
    fetchMaterials,
    deleteMaterial,
    clearError
  } = useCourseMaterialStore()

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch materials on mount and when courseId changes
  useEffect(() => {
    fetchMaterials(courseId)
  }, [courseId, fetchMaterials])

  const handleDeleteClick = useCallback((id: string, name: string) => {
    setMaterialToDelete({ id, name })
    setDeleteConfirmOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!materialToDelete) return

    setIsDeleting(true)
    await deleteMaterial(materialToDelete.id, courseId)
    setIsDeleting(false)
    setDeleteConfirmOpen(false)
    setMaterialToDelete(null)
  }, [materialToDelete, deleteMaterial, courseId])

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false)
    setMaterialToDelete(null)
  }, [])

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderOpenIcon sx={{ color: 'text.secondary' }} />
          <Typography variant="h6">Course Materials</Typography>
          <Typography variant="body2" color="text.secondary">
            ({materials.length})
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setIsUploadModalOpen(true)}
        >
          Upload Material
        </Button>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {isLoading && materials.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && materials.length === 0 && (
        <Box
          sx={{
            py: 6,
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper'
          }}
        >
          <FolderOpenIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Materials Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload reference materials like textbooks, notes, or worksheets.
            <br />
            Text will be extracted for use in AI-powered question generation.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload First Material
          </Button>
        </Box>
      )}

      {/* Materials Grid */}
      {materials.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 2
          }}
        >
          {materials.map((material) => (
            <CourseMaterialCard
              key={material.id}
              material={material}
              onDelete={() => handleDeleteClick(material.id, material.name)}
              isDeleting={isDeleting && materialToDelete?.id === material.id}
            />
          ))}
        </Box>
      )}

      {/* Upload Modal */}
      <MaterialUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        courseId={courseId}
        courseName={courseName}
        onSuccess={() => {
          // Modal handles closing itself
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Material"
        message={`Are you sure you want to delete "${materialToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />
    </Box>
  )
}
