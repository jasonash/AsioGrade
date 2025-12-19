import { type ReactElement } from 'react'
import { Edit2, Trash2, Mail, Hash } from 'lucide-react'
import type { Student } from '../../../../shared/types'

interface StudentListProps {
  students: Student[]
  onEdit: (student: Student) => void
  onDelete: (student: Student) => void
}

export function StudentList({ students, onEdit, onDelete }: StudentListProps): ReactElement {
  // Filter to show only active students, sorted by last name
  const activeStudents = students
    .filter((s) => s.active)
    .sort((a, b) => a.lastName.localeCompare(b.lastName))

  if (activeStudents.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        No students in this section yet.
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-[var(--color-surface)]">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
              Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
              Student #
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
              Email
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {activeStudents.map((student, index) => (
            <tr
              key={student.id}
              className={`${index > 0 ? 'border-t border-[var(--color-border)]' : ''} hover:bg-[var(--color-surface-hover)]`}
            >
              <td className="px-4 py-3">
                <span className="text-[var(--color-text-primary)] font-medium">
                  {student.lastName}, {student.firstName}
                </span>
              </td>
              <td className="px-4 py-3">
                {student.studentNumber ? (
                  <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                    <Hash size={12} className="text-[var(--color-text-muted)]" />
                    {student.studentNumber}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                {student.email ? (
                  <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                    <Mail size={12} className="text-[var(--color-text-muted)]" />
                    {student.email}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(student)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                    title="Edit student"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(student)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                    title="Delete student"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
