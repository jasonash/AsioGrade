import { type ReactElement } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteIcon from '@mui/icons-material/Delete'
import type { AssessmentVariant } from '../../../../shared/types'

interface VariantSelectorProps {
  variants: AssessmentVariant[]
  selectedVariantId: string | null // null means base assessment
  onSelectVariant: (variantId: string | null) => void
  onDeleteVariant?: (variantId: string) => void
  disabled?: boolean
}

const DOK_COLORS: Record<number, 'success' | 'info' | 'warning' | 'error'> = {
  1: 'success',
  2: 'info',
  3: 'warning',
  4: 'error'
}

const DOK_LABELS: Record<number, string> = {
  1: 'Recall',
  2: 'Skill/Concept',
  3: 'Strategic',
  4: 'Extended'
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelectVariant,
  onDeleteVariant,
  disabled
}: VariantSelectorProps): ReactElement {
  const handleChange = (_event: React.SyntheticEvent, newValue: string | null): void => {
    onSelectVariant(newValue === 'base' ? null : newValue)
  }

  // Sort variants by DOK level
  const sortedVariants = [...variants].sort((a, b) => a.dokLevel - b.dokLevel)

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
      <Tabs
        value={selectedVariantId ?? 'base'}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            textTransform: 'none',
            minHeight: 48
          }
        }}
      >
        {/* Base Assessment Tab */}
        <Tab
          value="base"
          disabled={disabled}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                Base Assessment
              </Typography>
            </Box>
          }
        />

        {/* Variant Tabs */}
        {sortedVariants.map((variant) => (
          <Tab
            key={variant.id}
            value={variant.id}
            disabled={disabled}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={`DOK ${variant.dokLevel}`}
                  size="small"
                  color={DOK_COLORS[variant.dokLevel]}
                />
                <Typography variant="body2">
                  {DOK_LABELS[variant.dokLevel]}
                </Typography>
                <Chip
                  label={variant.strategy === 'questions' ? 'New Q' : 'Distractors'}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 18 }}
                />
                {variant.isModified && (
                  <Chip
                    label="Modified"
                    size="small"
                    color="secondary"
                    sx={{ fontSize: '0.65rem', height: 18 }}
                  />
                )}
                {onDeleteVariant && (
                  <Tooltip title="Delete variant">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteVariant(variant.id)
                      }}
                      sx={{
                        ml: 0.5,
                        opacity: 0.6,
                        '&:hover': { opacity: 1, color: 'error.main' }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  )
}
