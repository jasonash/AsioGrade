import { type ReactElement, useState, useCallback, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react'
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

  const downloadTemplate = useCallback(() => {
    const templateContent = `firstName,lastName,email,studentNumber
John,Smith,john.smith@school.edu,12345
Jane,Doe,jane.doe@school.edu,12346
`
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'student_roster_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
      <div className="space-y-4">
        {/* Instructions */}
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm text-[var(--color-text-muted)]">
            <p>Upload a CSV file with student information. Required columns:</p>
            <ul className="mt-1 ml-4 list-disc">
              <li>
                <code className="text-[var(--color-text-secondary)]">firstName</code> (required)
              </li>
              <li>
                <code className="text-[var(--color-text-secondary)]">lastName</code> (required)
              </li>
              <li>
                <code className="text-[var(--color-text-secondary)]">email</code> (optional)
              </li>
              <li>
                <code className="text-[var(--color-text-secondary)]">studentNumber</code> (optional)
              </li>
            </ul>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="shrink-0 px-3 py-1.5 rounded-lg text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors flex items-center gap-1.5"
          >
            <Download size={14} />
            Template
          </button>
        </div>

        {/* Error display */}
        {(parseError || storeError) && (
          <div className="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{parseError || storeError}</p>
          </div>
        )}

        {/* File upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-6 border-2 border-dashed border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] transition-colors flex flex-col items-center gap-2"
          >
            {file ? (
              <>
                <FileText className="w-8 h-8 text-[var(--color-accent)]" />
                <span className="text-[var(--color-text-primary)] font-medium">{file.name}</span>
                <span className="text-xs text-[var(--color-text-muted)]">Click to change file</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-[var(--color-text-muted)]" />
                <span className="text-[var(--color-text-secondary)]">Click to upload CSV file</span>
              </>
            )}
          </button>
        </div>

        {/* Preview */}
        {parsedStudents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Preview ({parsedStudents.length} rows)
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle size={12} /> {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-[var(--color-error)]">
                    <AlertCircle size={12} /> {invalidCount} invalid
                  </span>
                )}
              </div>
            </div>
            <div className="max-h-48 overflow-auto border border-[var(--color-border)] rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface)]">
                  <tr>
                    <th className="px-3 py-2 text-left text-[var(--color-text-secondary)] font-medium">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-[var(--color-text-secondary)] font-medium">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left text-[var(--color-text-secondary)] font-medium">
                      Email
                    </th>
                    <th className="px-3 py-2 text-left text-[var(--color-text-secondary)] font-medium">
                      Student #
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedStudents.slice(0, 10).map((student, index) => (
                    <tr key={index} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2">
                        {student.valid ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : (
                          <AlertCircle size={14} className="text-[var(--color-error)]" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-primary)]">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">
                        {student.email || '-'}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">
                        {student.studentNumber || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedStudents.length > 10 && (
                <div className="px-3 py-2 text-center text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
                  ... and {parsedStudents.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-surface-active)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || validCount === 0}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isImporting ? 'Importing...' : `Import ${validCount} Students`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
