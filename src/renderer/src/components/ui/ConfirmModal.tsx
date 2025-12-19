import { type ReactElement } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmModalProps): ReactElement {
  const variantClasses = {
    danger: 'bg-[var(--color-error)] hover:bg-[var(--color-error)]/90',
    warning: 'bg-amber-500 hover:bg-amber-600',
    info: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90'
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {variant === 'danger' && (
            <div className="p-2 rounded-full bg-[var(--color-error)]/10 shrink-0">
              <AlertTriangle className="w-5 h-5 text-[var(--color-error)]" />
            </div>
          )}
          {variant === 'warning' && (
            <div className="p-2 rounded-full bg-amber-500/10 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
          )}
          <p className="text-[var(--color-text-secondary)] text-sm">{message}</p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-surface-active)] transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${variantClasses[variant]}`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
