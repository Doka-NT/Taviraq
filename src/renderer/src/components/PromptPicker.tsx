import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { BookOpen, FileText, Search } from 'lucide-react'
import type { PromptTemplate } from '@shared/types'

interface PromptPickerProps {
  onSelect: (content: string) => void
}

const POPOVER_WIDTH = 280
const POPOVER_MAX_HEIGHT = 320
const POPOVER_MARGIN = 8
const POPOVER_GAP = 8

export function PromptPicker({ onSelect }: PromptPickerProps): JSX.Element {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [pos, setPos] = useState<{
    left: number
    bottom: number
    width: number
    maxHeight: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
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

  // Compute popover position relative to the viewport (avoids clipping by overflow:hidden ancestors)
  const computePos = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const panel = trigger.closest('.llm-panel')
    const panelRect = panel?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
      width: window.innerWidth,
    }

    const width = Math.max(0, Math.min(POPOVER_WIDTH, panelRect.width - POPOVER_MARGIN * 2))
    const minLeft = panelRect.left + POPOVER_MARGIN
    const maxLeft = Math.max(minLeft, panelRect.right - POPOVER_MARGIN - width)
    const preferredLeft = rect.right - width
    const left = Math.min(Math.max(preferredLeft, minLeft), maxLeft)

    const preferredBottomY = rect.top - POPOVER_GAP
    const minBottomY = panelRect.top + POPOVER_MARGIN
    const maxBottomY = panelRect.bottom - POPOVER_MARGIN
    const bottomY = Math.min(Math.max(preferredBottomY, minBottomY), maxBottomY)
    const bottom = window.innerHeight - bottomY
    const availableHeight = Math.max(0, bottomY - panelRect.top - POPOVER_MARGIN)
    const maxHeight = Math.min(POPOVER_MAX_HEIGHT, availableHeight)

    setPos({
      left: Math.round(left),
      bottom: Math.round(bottom),
      width: Math.round(width),
      maxHeight: Math.round(maxHeight),
    })
  }, [])

  // Recompute position when opening and on resize/scroll
  useEffect(() => {
    if (!open) return
    computePos()
    const onResize = () => computePos()
    const onScroll = () => computePos()
    const panel = triggerRef.current?.closest('.llm-panel') ?? null
    const resizeObserver =
      panel && 'ResizeObserver' in window ? new ResizeObserver(() => computePos()) : null
    if (panel && resizeObserver) resizeObserver.observe(panel)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [open, computePos])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
        ref={triggerRef}
        title="Prompt library"
        aria-label="Open prompt library"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!open) {
            computePos()
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 0)
            return
          }
          setOpen(false)
        }}
      >
        <BookOpen size={14} aria-hidden />
      </button>

      {open && pos ? (
        <div
          className="prompt-picker-popover"
          role="dialog"
          aria-label="Prompt library"
          style={{
            position: 'fixed',
            left: `${pos.left}px`,
            bottom: `${pos.bottom}px`,
            width: `${pos.width}px`,
            maxHeight: `${pos.maxHeight}px`,
          }}
        >
          <div className="prompt-picker-search">
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
      ) : null}
    </div>
  )
}
