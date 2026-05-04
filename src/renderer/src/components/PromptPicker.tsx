import { BookOpen } from 'lucide-react'

interface PromptPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect?: (content: string) => void
}

export function PromptPicker({ open, onOpenChange }: PromptPickerProps): JSX.Element {
  return (
    <div className="prompt-picker">
      <button
        type="button"
        className="icon-button prompt-picker-trigger"
        title="Prompt library"
        aria-label="Open prompt library"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!open)}
      >
        <BookOpen size={14} aria-hidden />
      </button>
    </div>
  )
}
