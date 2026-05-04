import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, FileText, Search, X } from 'lucide-react'
import type { PromptTemplate } from '@shared/types'

interface PromptPickerProps {
  onSelect: (content: string) => void
}

export function PromptPicker({ onSelect }: PromptPickerProps): JSX.Element {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? prompts.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.content.toLowerCase().includes(query.toLowerCase())
      )
    : prompts

  useEffect(() => {
    if (!open) return
    void window.api.prompt.list().then(setPrompts).catch(() => setPrompts([]))
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const panel = document.querySelector('.prompt-picker-overlay')
      if (containerRef.current?.contains(target) || panel?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback(
    (prompt: PromptTemplate) => {
      onSelect(prompt.content)
      setOpen(false)
      setQuery('')
    },
    [onSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault()
        handleSelect(filtered[activeIndex])
      }
    },
    [activeIndex, filtered, handleSelect],
  )

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector('.prompt-picker-item.active')
    if (active) active.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div className="prompt-picker" ref={containerRef}>
      <button
        type="button"
        className="icon-button prompt-picker-trigger"
        title="Prompt library"
        aria-label="Open prompt library"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!open) {
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 0)
            return
          }
          setOpen(false)
        }}
      >
        <BookOpen size={14} aria-hidden />
      </button>

      {open ? createPortal(
        <div
          className="prompt-picker-overlay"
          role="dialog"
          aria-label="Prompt library"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="prompt-picker-panel">
            <div className="prompt-picker-header">
              <Search size={13} aria-hidden />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search prompts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-controls={listId}
              />
              <button type="button" className="icon-button" onClick={() => { setOpen(false); setQuery('') }}>
                <X size={13} aria-hidden />
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="prompt-picker-empty">
                {prompts.length === 0
                  ? 'No prompts yet. Add one in Settings.'
                  : 'No matching prompts.'}
              </div>
            ) : (
              <div
                id={listId}
                ref={listRef}
                className="prompt-picker-list"
                role="listbox"
              >
                {filtered.map((prompt, i) => (
                  <button
                    key={prompt.id}
                    type="button"
                    role="option"
                    className={`prompt-picker-item ${i === activeIndex ? 'active' : ''}`}
                    aria-selected={i === activeIndex}
                    onClick={() => handleSelect(prompt)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <FileText size={13} aria-hidden />
                    <span className="prompt-picker-item-name">{prompt.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.querySelector('.llm-panel') ?? document.body
      ) : null}
    </div>
  )
}
