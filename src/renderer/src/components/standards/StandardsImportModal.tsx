import { type ReactElement, useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Paper from '@mui/material/Paper'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import { Modal } from '../ui'
import { useStandardsStore } from '../../stores'
import type { StandardDomain, Standard, CreateStandardsInput, StandardsSource } from '../../../../shared/types'

interface StandardsImportModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
  courseSubject: string
  courseGradeLevel: string
  onSuccess?: () => void
}

interface FormData {
  state: string
  subject: string
  gradeLevel: string
  framework: string
  rawInput: string
}

interface ParsedDomain {
  code: string
  name: string
  standards: ParsedStandard[]
}

interface ParsedStandard {
  code: string
  description: string
  valid: boolean
  error?: string
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
]

const FRAMEWORKS = [
  'NGSS',
  'Common Core',
  'State Standards',
  'AP Framework',
  'IB Framework',
  'Custom'
]

const EXAMPLE_INPUT = `# Domain: MS-ESS2 - Earth's Systems

MS-ESS2-1: Develop a model to describe the cycling of Earth's materials and the flow of energy that drives this process.

MS-ESS2-2: Construct an explanation based on evidence for how geoscience processes have changed Earth's surface at varying time and spatial scales.

MS-ESS2-3: Analyze and interpret data on the distribution of fossils and rocks, continental shapes, and seafloor structures to provide evidence of the past plate motions.

# Domain: MS-ESS3 - Earth and Human Activity

MS-ESS3-1: Construct a scientific explanation based on evidence for how the uneven distributions of Earth's mineral, energy, and groundwater resources are the result of past and current geoscience processes.

MS-ESS3-2: Analyze and interpret data on natural hazards to forecast future catastrophic events and inform the development of technologies to mitigate their effects.`

export function StandardsImportModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  courseSubject,
  courseGradeLevel,
  onSuccess
}: StandardsImportModalProps): ReactElement {
  const { saveStandards, error: storeError, clearError } = useStandardsStore()

  const [activeTab, setActiveTab] = useState(0)
  const [formData, setFormData] = useState<FormData>({
    state: '',
    subject: courseSubject,
    gradeLevel: courseGradeLevel,
    framework: 'State Standards',
    rawInput: ''
  })
  const [parsedDomains, setParsedDomains] = useState<ParsedDomain[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        state: '',
        subject: courseSubject,
        gradeLevel: courseGradeLevel,
        framework: 'State Standards',
        rawInput: ''
      })
      setParsedDomains([])
      setParseError(null)
      setActiveTab(0)
      clearError()
    }
  }, [isOpen, courseSubject, courseGradeLevel, clearError])

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear parse error when input changes
    if (field === 'rawInput') {
      setParseError(null)
      setParsedDomains([])
    }
  }, [])

  const parseInput = useCallback((input: string): ParsedDomain[] => {
    const lines = input.trim().split('\n')
    const domains: ParsedDomain[] = []
    let currentDomain: ParsedDomain | null = null

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // Check for domain header (# Domain: CODE - Name or ## Domain: etc.)
      const domainMatch = trimmedLine.match(/^#+\s*Domain:\s*([A-Z0-9-]+)\s*[-–—]\s*(.+)$/i)
      if (domainMatch) {
        if (currentDomain && currentDomain.standards.length > 0) {
          domains.push(currentDomain)
        }
        currentDomain = {
          code: domainMatch[1].toUpperCase(),
          name: domainMatch[2].trim(),
          standards: []
        }
        continue
      }

      // Check for standard (CODE: Description or CODE - Description)
      const standardMatch = trimmedLine.match(/^([A-Z0-9-]+)[:–—-]\s*(.+)$/i)
      if (standardMatch) {
        const code = standardMatch[1].toUpperCase()
        const description = standardMatch[2].trim()

        // If no domain yet, create a default one
        if (!currentDomain) {
          // Extract domain code from standard code (e.g., MS-ESS2-1 -> MS-ESS2)
          const domainCode = code.replace(/-\d+$/, '')
          currentDomain = {
            code: domainCode,
            name: domainCode,
            standards: []
          }
        }

        currentDomain.standards.push({
          code,
          description,
          valid: description.length > 10
        })
      }
    }

    // Add the last domain
    if (currentDomain && currentDomain.standards.length > 0) {
      domains.push(currentDomain)
    }

    return domains
  }, [])

  const handleParse = useCallback(() => {
    if (!formData.rawInput.trim()) {
      setParseError('Please enter standards to parse')
      return
    }

    try {
      const domains = parseInput(formData.rawInput)
      if (domains.length === 0) {
        setParseError('Could not parse any standards. Please check the format.')
        return
      }
      setParsedDomains(domains)
      setParseError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse standards'
      setParseError(message)
    }
  }, [formData.rawInput, parseInput])

  const handleLoadExample = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      state: 'Kansas',
      framework: 'NGSS',
      rawInput: EXAMPLE_INPUT
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (parsedDomains.length === 0) {
      setParseError('Please parse standards before importing')
      return
    }

    if (!formData.state) {
      setParseError('Please select a state')
      return
    }

    setIsSubmitting(true)

    // Convert parsed domains to the proper format
    const domains: StandardDomain[] = parsedDomains.map((pd) => ({
      code: pd.code,
      name: pd.name,
      standards: pd.standards.map((ps): Standard => ({
        code: ps.code,
        description: ps.description,
        keywords: extractKeywords(ps.description)
      }))
    }))

    const source: StandardsSource = {
      type: 'manual' as const,
      fetchedAt: new Date().toISOString()
    }

    const input: CreateStandardsInput = {
      courseId,
      source,
      state: formData.state,
      subject: formData.subject,
      gradeLevel: formData.gradeLevel,
      framework: formData.framework,
      domains
    }

    const result = await saveStandards(input)

    setIsSubmitting(false)

    if (result) {
      onSuccess?.()
      onClose()
    }
  }, [parsedDomains, formData, courseId, saveStandards, onSuccess, onClose])

  const totalStandards = parsedDomains.reduce((sum, d) => sum + d.standards.length, 0)
  const validStandards = parsedDomains.reduce(
    (sum, d) => sum + d.standards.filter((s) => s.valid).length,
    0
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Standards" size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Course context */}
        <Typography variant="body2" color="text.secondary">
          Importing standards for{' '}
          <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {courseName}
          </Box>
        </Typography>

        {/* Import method tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Manual Entry" />
          <Tab label="From URL" disabled />
          <Tab label="From File" disabled />
        </Tabs>

        {/* Error display */}
        {(parseError || storeError) && (
          <Alert severity="error">{parseError || storeError}</Alert>
        )}

        {/* Manual Entry Tab */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Metadata row */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label="State"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                size="small"
                required
                sx={{ minWidth: 150, flex: 1 }}
              >
                {US_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Subject"
                value={formData.subject}
                onChange={(e) => handleChange('subject', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />

              <TextField
                label="Grade Level"
                value={formData.gradeLevel}
                onChange={(e) => handleChange('gradeLevel', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />

              <TextField
                select
                label="Framework"
                value={formData.framework}
                onChange={(e) => handleChange('framework', e.target.value)}
                size="small"
                sx={{ minWidth: 150, flex: 1 }}
              >
                {FRAMEWORKS.map((fw) => (
                  <MenuItem key={fw} value={fw}>
                    {fw}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Input area */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2">Standards Text</Typography>
                <Button size="small" onClick={handleLoadExample}>
                  Load Example
                </Button>
              </Box>
              <TextField
                multiline
                rows={8}
                value={formData.rawInput}
                onChange={(e) => handleChange('rawInput', e.target.value)}
                placeholder={`Enter standards in this format:

# Domain: CODE - Domain Name

CODE-1: First standard description...
CODE-2: Second standard description...

# Domain: ANOTHER-CODE - Another Domain

ANOTHER-CODE-1: Standard description...`}
                fullWidth
                sx={{ fontFamily: 'monospace' }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Use &quot;# Domain:&quot; to start a new domain. Each standard should be on its own line
                with code and description separated by a colon.
              </Typography>
            </Box>

            {/* Parse button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={handleParse}
                disabled={!formData.rawInput.trim()}
              >
                Parse Standards
              </Button>
            </Box>

            {/* Preview */}
            {parsedDomains.length > 0 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2">
                    Preview ({parsedDomains.length} domains, {totalStandards} standards)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {validStandards === totalStandards ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="All valid"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<WarningIcon />}
                        label={`${totalStandards - validStandards} need review`}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>

                <Paper variant="outlined" sx={{ maxHeight: 250, overflow: 'auto' }}>
                  {parsedDomains.map((domain, domainIdx) => (
                    <Accordion
                      key={domainIdx}
                      defaultExpanded={domainIdx === 0}
                      disableGutters
                      sx={{
                        '&:before': { display: 'none' },
                        boxShadow: 'none'
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={domain.code} size="small" color="primary" />
                          <Typography variant="body2" fontWeight={500}>
                            {domain.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({domain.standards.length} standards)
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {domain.standards.map((standard, stdIdx) => (
                            <Box
                              key={stdIdx}
                              sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                py: 0.5,
                                borderBottom: stdIdx < domain.standards.length - 1 ? 1 : 0,
                                borderColor: 'divider'
                              }}
                            >
                              <Chip
                                label={standard.code}
                                size="small"
                                variant="outlined"
                                sx={{ flexShrink: 0 }}
                              />
                              <Typography variant="body2" color="text.secondary">
                                {standard.description}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Paper>
              </Box>
            )}
          </Box>
        )}

        {/* Placeholder for URL tab */}
        {activeTab === 1 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              URL import coming soon. Use manual entry for now.
            </Typography>
          </Box>
        )}

        {/* Placeholder for File tab */}
        {activeTab === 2 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              File import coming soon. Use manual entry for now.
            </Typography>
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedDomains.length === 0 || !formData.state}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Importing...' : `Import ${totalStandards} Standards`}
          </Button>
        </Box>
      </Box>
    </Modal>
  )
}

/**
 * Extract keywords from a standard description
 * Simple implementation - splits on common words
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'that', 'which', 'who',
    'whom', 'this', 'these', 'those', 'it', 'its', 'they', 'their', 'them',
    'he', 'she', 'him', 'her', 'his', 'hers', 'we', 'our', 'us', 'you', 'your'
  ])

  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word))

  // Return unique keywords
  return [...new Set(words)].slice(0, 10)
}
