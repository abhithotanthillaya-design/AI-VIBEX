import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'danger'
  isConfirming: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  isConfirming,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      subtitle={description}
      titleId="confirm-dialog-title"
      descriptionId="confirm-dialog-description"
      maxWidthClass="max-w-md"
      disableClose={isConfirming}
      onClose={onCancel}
    >
      <div className="flex items-start gap-3 rounded-xl border border-[#E7D4AF] bg-[#FBF4E4]/70 p-3 text-xs leading-relaxed text-[#7D5214]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Please confirm you want to proceed with this action.</span>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          size="md"
          disabled={isConfirming}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant={confirmVariant}
          size="md"
          loading={isConfirming}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
