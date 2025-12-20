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
import Link from '@mui/material/Link'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Modal } from '../ui'
import { useStandardsStore } from '../../stores'
import type { StandardDomain, Standard, CreateStandardsInput, StandardsSource } from '../../../../shared/types'
import type { ServiceResult } from '../../../../shared/types/common.types'
import type { LLMResponse } from '../../../../shared/types/llm.types'

// System prompt for AI standards parsing
const STANDARDS_PARSING_PROMPT = `You are a teaching standards parser. Extract teaching standards from the provided text and return valid JSON.

Output format:
{
  "domains": [
    {
      "code": "DOMAIN-CODE",
      "name": "Domain Name",
      "standards": [
        { "code": "STANDARD-CODE", "description": "Full standard description..." }
      ]
    }
  ]
}

Rules:
1. Extract domain codes and names from headers or groupings
2. Each standard needs a unique code and its full description
3. Group standards under appropriate domains
4. If no clear domain structure, create logical groupings based on topic
5. Preserve original wording of standards
6. Return ONLY valid JSON, no additional text or markdown code blocks`

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
  name: string // Collection name
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
  const { createCollection, error: storeError, clearError } = useStandardsStore()

  const [activeTab, setActiveTab] = useState(0)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    state: '',
    subject: courseSubject,
    gradeLevel: courseGradeLevel,
    framework: 'State Standards',
    rawInput: ''
  })
  const [parsedDomains, setParsedDomains] = useState<ParsedDomain[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // AI configuration state
  const [aiConfigured, setAiConfigured] = useState<boolean>(false)
  const [checkingAi, setCheckingAi] = useState<boolean>(true)

  // URL import state
  const [urlInput, setUrlInput] = useState('')
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)

  // File import state
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [isReadingFile, setIsReadingFile] = useState(false)

  // AI parsing state
  const [isParsingWithAI, setIsParsingWithAI] = useState(false)

  // Check AI configuration when modal opens
  useEffect(() => {
    const checkAiConfig = async (): Promise<void> => {
      setCheckingAi(true)
      try {
        const result = await window.electronAPI.invoke<ServiceResult<boolean>>(
          'llm:hasConfiguredProvider'
        )
        setAiConfigured(result.success && result.data === true)
      } catch {
        setAiConfigured(false)
      }
      setCheckingAi(false)
    }

    if (isOpen) {
      checkAiConfig()
    }
  }, [isOpen])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        state: '',
        subject: courseSubject,
        gradeLevel: courseGradeLevel,
        framework: 'State Standards',
        rawInput: ''
      })
      setParsedDomains([])
      setParseError(null)
      setActiveTab(0)
      setUrlInput('')
      setSelectedFile(null)
      setSelectedFileName('')
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

  // Parse a single chunk of content with AI
  const parseChunkWithAI = useCallback(async (content: string): Promise<ParsedDomain[] | null> => {
    const result = await window.electronAPI.invoke<ServiceResult<LLMResponse>>(
      'llm:complete',
      {
        prompt: `Parse these teaching standards:\n\n${content}`,
        systemPrompt: STANDARDS_PARSING_PROMPT,
        temperature: 0.1,
        maxTokens: 4000
      }
    )

    if (!result.success) {
      throw new Error(result.error || 'AI parsing failed')
    }

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = result.data.content.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    // Parse the JSON
    let parsed: { domains?: Array<{ code: string; name: string; standards: Array<{ code: string; description: string }> }> }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return null // This chunk didn't parse, skip it
    }

    if (!parsed.domains || !Array.isArray(parsed.domains) || parsed.domains.length === 0) {
      return null
    }

    // Convert to ParsedDomain format
    return parsed.domains.map((d) => ({
      code: d.code,
      name: d.name,
      standards: d.standards.map((s) => ({
        code: s.code,
        description: s.description,
        valid: s.description.length > 10
      }))
    }))
  }, [])

  // Merge domains from multiple chunks, combining standards for matching domain codes
  const mergeDomains = useCallback((allDomains: ParsedDomain[][]): ParsedDomain[] => {
    const domainMap = new Map<string, ParsedDomain>()

    for (const domains of allDomains) {
      for (const domain of domains) {
        const existing = domainMap.get(domain.code)
        if (existing) {
          // Merge standards, avoiding duplicates by code
          const existingCodes = new Set(existing.standards.map((s) => s.code))
          for (const standard of domain.standards) {
            if (!existingCodes.has(standard.code)) {
              existing.standards.push(standard)
              existingCodes.add(standard.code)
            }
          }
        } else {
          domainMap.set(domain.code, { ...domain, standards: [...domain.standards] })
        }
      }
    }

    return Array.from(domainMap.values())
  }, [])

  // Parse content with AI (handles large documents by chunking)
  const parseWithAI = useCallback(async (content: string): Promise<void> => {
    if (!content.trim()) {
      setParseError('No content to parse')
      return
    }

    setIsParsingWithAI(true)
    setParseError(null)
    setParsedDomains([])

    // Chunk size - roughly 40K chars to stay well under token limits
    const CHUNK_SIZE = 40000
    const OVERLAP = 2000 // Small overlap to avoid splitting standards

    try {
      const chunks: string[] = []

      if (content.length <= CHUNK_SIZE) {
        chunks.push(content)
      } else {
        // Split into chunks at paragraph boundaries
        let start = 0
        while (start < content.length) {
          let end = Math.min(start + CHUNK_SIZE, content.length)

          // Try to end at a paragraph boundary (only if not at the end)
          if (end < content.length) {
            const searchStart = start + Math.floor(CHUNK_SIZE * 0.7)
            const lastParagraph = content.lastIndexOf('\n\n', end)
            if (lastParagraph > searchStart) {
              end = lastParagraph
            }
          }

          chunks.push(content.substring(start, end))

          // Move to next chunk, ensuring we always make forward progress
          const nextStart = end - OVERLAP
          start = Math.max(nextStart, start + 1)

          // If we're near the end, break to avoid tiny trailing chunks
          if (content.length - start < CHUNK_SIZE * 0.1) {
            break
          }
        }
      }

      // Parse each chunk
      const allResults: ParsedDomain[][] = []
      for (let i = 0; i < chunks.length; i++) {
        // Update status for multi-chunk processing
        if (chunks.length > 1) {
          setParseError(`Processing chunk ${i + 1} of ${chunks.length}...`)
        }

        const result = await parseChunkWithAI(chunks[i])
        if (result && result.length > 0) {
          allResults.push(result)
        }

        // Small delay between chunks to avoid rate limits
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      setParseError(null)

      if (allResults.length === 0) {
        setParseError('AI could not identify any standards. Try manual entry instead.')
        setIsParsingWithAI(false)
        return
      }

      // Merge all results
      const mergedDomains = mergeDomains(allResults)
      setParsedDomains(mergedDomains)

      // Show info if processed in multiple chunks
      if (chunks.length > 1) {
        setParseError(`Processed ${chunks.length} sections. Review the results below.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI parsing failed'
      setParseError(message)
    }

    setIsParsingWithAI(false)
  }, [parseChunkWithAI, mergeDomains])

  // Handle URL fetch and parse
  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      setParseError('Please enter a URL')
      return
    }

    // Basic URL validation
    try {
      new URL(urlInput)
    } catch {
      setParseError('Please enter a valid URL')
      return
    }

    setIsFetchingUrl(true)
    setParseError(null)
    setParsedDomains([])

    try {
      const result = await window.electronAPI.invoke<ServiceResult<string>>(
        'import:fetchUrl',
        urlInput
      )

      if (!result.success) {
        setParseError(result.error || 'Failed to fetch URL')
        setIsFetchingUrl(false)
        return
      }

      setIsFetchingUrl(false)

      // Parse with AI
      await parseWithAI(result.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch URL'
      setParseError(message)
      setIsFetchingUrl(false)
    }
  }, [urlInput, parseWithAI])

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    setParseError(null)
    setParsedDomains([])

    try {
      const result = await window.electronAPI.invoke<ServiceResult<string | null>>(
        'import:openFileDialog'
      )

      if (!result.success) {
        setParseError(result.error || 'Failed to open file dialog')
        return
      }

      if (!result.data) {
        // User cancelled
        return
      }

      const filePath = result.data
      const fileName = filePath.split(/[/\\]/).pop() || filePath

      setSelectedFile(filePath)
      setSelectedFileName(fileName)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select file'
      setParseError(message)
    }
  }, [])

  // Handle file read and parse
  const handleParseFile = useCallback(async () => {
    if (!selectedFile) {
      setParseError('Please select a file first')
      return
    }

    setIsReadingFile(true)
    setParseError(null)
    setParsedDomains([])

    try {
      let content: string

      if (selectedFile.toLowerCase().endsWith('.pdf')) {
        const result = await window.electronAPI.invoke<ServiceResult<string>>(
          'import:readPdfText',
          selectedFile
        )
        if (!result.success) {
          setParseError(result.error || 'Failed to read PDF')
          setIsReadingFile(false)
          return
        }
        content = result.data
      } else {
        const result = await window.electronAPI.invoke<ServiceResult<string>>(
          'import:readTextFile',
          selectedFile
        )
        if (!result.success) {
          setParseError(result.error || 'Failed to read file')
          setIsReadingFile(false)
          return
        }
        content = result.data
      }

      setIsReadingFile(false)

      // Parse with AI
      await parseWithAI(content)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read file'
      setParseError(message)
      setIsReadingFile(false)
    }
  }, [selectedFile, parseWithAI])

  const handleSubmit = useCallback(async () => {
    if (parsedDomains.length === 0) {
      setParseError('Please parse standards before importing')
      return
    }

    if (!formData.state) {
      setParseError('Please select a state')
      return
    }

    if (!formData.name.trim()) {
      setParseError('Please enter a collection name')
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

    // Set source based on active tab
    let source: StandardsSource
    if (activeTab === 1) {
      source = {
        type: 'url' as const,
        url: urlInput,
        fetchedAt: new Date().toISOString()
      }
    } else if (activeTab === 2) {
      source = {
        type: 'pdf' as const,
        filename: selectedFileName,
        fetchedAt: new Date().toISOString()
      }
    } else {
      source = {
        type: 'manual' as const,
        fetchedAt: new Date().toISOString()
      }
    }

    const input: CreateStandardsInput = {
      courseId,
      name: formData.name.trim(),
      source,
      state: formData.state,
      subject: formData.subject,
      gradeLevel: formData.gradeLevel,
      framework: formData.framework,
      domains
    }

    const result = await createCollection(input)

    setIsSubmitting(false)

    if (result) {
      onSuccess?.()
      onClose()
    }
  }, [parsedDomains, formData, courseId, createCollection, onSuccess, onClose, activeTab, urlInput, selectedFileName])

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
          onChange={(_, v) => {
            // Only allow switching to AI tabs if AI is configured
            if ((v === 1 || v === 2) && !aiConfigured) return
            setActiveTab(v)
          }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Manual Entry" />
          <Tab
            label="From URL"
            disabled={checkingAi || !aiConfigured}
            sx={{
              '&.Mui-disabled': {
                cursor: 'not-allowed',
                pointerEvents: 'auto'
              }
            }}
          />
          <Tab
            label="From File"
            disabled={checkingAi || !aiConfigured}
            sx={{
              '&.Mui-disabled': {
                cursor: 'not-allowed',
                pointerEvents: 'auto'
              }
            }}
          />
        </Tabs>

        {/* AI not configured warning */}
        {!checkingAi && !aiConfigured && activeTab === 0 && (
          <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
            <Typography variant="body2">
              URL and File import require an AI provider.{' '}
              <Link href="#" onClick={(e) => { e.preventDefault(); /* TODO: navigate to settings */ }}>
                Configure in Settings
              </Link>
            </Typography>
          </Alert>
        )}

        {/* Error display */}
        {(parseError || storeError) && (
          <Alert severity="error">{parseError || storeError}</Alert>
        )}

        {/* Manual Entry Tab */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Collection name */}
            <TextField
              label="Collection Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., NGSS Earth Science, Kansas State Standards"
              helperText="A descriptive name for this standards collection"
              size="small"
              required
              fullWidth
            />

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

        {/* URL Import Tab */}
        {activeTab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Collection name */}
            <TextField
              label="Collection Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., NGSS Earth Science, Kansas State Standards"
              helperText="A descriptive name for this standards collection"
              size="small"
              required
              fullWidth
            />

            {/* Metadata row - same as manual entry */}
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

            {/* URL input */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Standards URL
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value)
                    setParseError(null)
                    setParsedDomains([])
                  }}
                  placeholder="https://example.com/standards"
                  fullWidth
                  size="small"
                  disabled={isFetchingUrl || isParsingWithAI}
                />
                <Button
                  variant="contained"
                  onClick={handleFetchUrl}
                  disabled={!urlInput.trim() || isFetchingUrl || isParsingWithAI}
                  startIcon={
                    isFetchingUrl || isParsingWithAI ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <CloudDownloadIcon />
                    )
                  }
                  sx={{ minWidth: 160, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {isFetchingUrl
                    ? 'Fetching...'
                    : isParsingWithAI
                      ? 'Parsing...'
                      : 'Fetch & Parse'}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Enter the URL of a page containing teaching standards. AI will extract and parse them.
              </Typography>
            </Box>

            {/* Preview - reuse the same component */}
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

        {/* File Import Tab */}
        {activeTab === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Collection name */}
            <TextField
              label="Collection Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., NGSS Earth Science, Kansas State Standards"
              helperText="A descriptive name for this standards collection"
              size="small"
              required
              fullWidth
            />

            {/* Metadata row - same as manual entry */}
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

            {/* File selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Standards File
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={handleSelectFile}
                  disabled={isReadingFile || isParsingWithAI}
                  startIcon={<UploadFileIcon />}
                >
                  Choose File
                </Button>
                {selectedFileName && (
                  <Chip
                    label={selectedFileName}
                    onDelete={() => {
                      setSelectedFile(null)
                      setSelectedFileName('')
                      setParsedDomains([])
                    }}
                    size="small"
                  />
                )}
                {selectedFile && (
                  <Button
                    variant="contained"
                    onClick={handleParseFile}
                    disabled={isReadingFile || isParsingWithAI}
                    startIcon={
                      isReadingFile || isParsingWithAI ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                    sx={{ ml: 'auto' }}
                  >
                    {isReadingFile
                      ? 'Reading...'
                      : isParsingWithAI
                        ? 'Parsing...'
                        : 'Parse with AI'}
                  </Button>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Select a text file (.txt) or PDF (.pdf) containing teaching standards.
              </Typography>
            </Box>

            {/* Preview - reuse the same component */}
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

        {/* State required warning */}
        {parsedDomains.length > 0 && !formData.state && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Please select a State before importing.
          </Alert>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedDomains.length === 0 || !formData.state || !formData.name.trim()}
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
