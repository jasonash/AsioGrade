import { type ReactElement, memo, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Chip from '@mui/material/Chip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { Standards, StandardDomain, Standard, StandardRef } from '../../../../shared/types'

interface StandardsSelectorProps {
  allCollections: Standards[]
  selectedStandards: StandardRef[]
  loading: boolean
  onToggleStandard: (standardCode: string) => void
  onSelectAllInDomain: (domainStandardCodes: string[], isCurrentlyAllSelected: boolean) => void
  defaultExpandedDomains?: string[] // Domain codes that should be expanded by default
}

// Memoized individual standard checkbox to prevent unnecessary re-renders
const StandardCheckbox = memo(function StandardCheckbox({
  standard,
  isSelected,
  onToggle
}: {
  standard: Standard
  isSelected: boolean
  onToggle: () => void
}): ReactElement {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={isSelected}
          onChange={onToggle}
          size="small"
        />
      }
      label={
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Chip
            label={standard.code}
            size="small"
            variant="outlined"
            sx={{ flexShrink: 0, mt: 0.25 }}
          />
          <Typography variant="body2" color="text.secondary">
            {standard.description}
          </Typography>
        </Box>
      }
      sx={{
        alignItems: 'flex-start',
        mx: 0,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-child': { borderBottom: 0 }
      }}
    />
  )
})

// Memoized domain accordion
const DomainAccordion = memo(function DomainAccordion({
  collectionId,
  domain,
  selectedStandards,
  defaultExpanded,
  onToggleStandard,
  onSelectAllInDomain
}: {
  collectionId: string
  domain: StandardDomain
  selectedStandards: StandardRef[]
  defaultExpanded: boolean
  onToggleStandard: (standardCode: string) => void
  onSelectAllInDomain: (domainStandardCodes: string[], isCurrentlyAllSelected: boolean) => void
}): ReactElement {
  const domainStandardCodes = domain.standards.map((s) => s.code)
  const selectedInDomain = domainStandardCodes.filter((code) =>
    selectedStandards.includes(code)
  )
  const allSelected = selectedInDomain.length === domainStandardCodes.length && domainStandardCodes.length > 0
  const someSelected = selectedInDomain.length > 0 && !allSelected

  const handleSelectAll = useCallback(() => {
    onSelectAllInDomain(domainStandardCodes, allSelected)
  }, [domainStandardCodes, allSelected, onSelectAllInDomain])

  return (
    <Accordion
      key={`${collectionId}-${domain.code}`}
      disableGutters
      defaultExpanded={defaultExpanded}
      sx={{
        '&:before': { display: 'none' },
        boxShadow: 'none'
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={handleSelectAll}
            onClick={(e) => e.stopPropagation()}
            size="small"
          />
          <Chip label={domain.code} size="small" color="primary" variant="outlined" />
          <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
            {domain.name}
          </Typography>
          {selectedInDomain.length > 0 && (
            <Chip
              label={`${selectedInDomain.length}/${domain.standards.length}`}
              size="small"
              sx={{ mr: 1 }}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pl: 6 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {domain.standards.map((standard) => (
            <StandardCheckbox
              key={standard.code}
              standard={standard}
              isSelected={selectedStandards.includes(standard.code)}
              onToggle={() => onToggleStandard(standard.code)}
            />
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
})

export const StandardsSelector = memo(function StandardsSelector({
  allCollections,
  selectedStandards,
  loading,
  onToggleStandard,
  onSelectAllInDomain,
  defaultExpandedDomains = []
}: StandardsSelectorProps): ReactElement {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading standards...
        </Typography>
      </Box>
    )
  }

  if (allCollections.length === 0) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 1,
          bgcolor: 'action.hover',
          textAlign: 'center'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No standards imported for this course.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          You can import standards from the Course page.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      {allCollections.map((collection) => (
        <Box key={collection.id}>
          {/* Collection header */}
          <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {collection.name}
            </Typography>
          </Box>
          {collection.domains.map((domain) => (
            <DomainAccordion
              key={`${collection.id}-${domain.code}`}
              collectionId={collection.id}
              domain={domain}
              selectedStandards={selectedStandards}
              defaultExpanded={defaultExpandedDomains.includes(domain.code)}
              onToggleStandard={onToggleStandard}
              onSelectAllInDomain={onSelectAllInDomain}
            />
          ))}
        </Box>
      ))}
    </Box>
  )
})
