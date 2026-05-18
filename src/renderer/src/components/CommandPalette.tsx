import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Search } from 'lucide-react'

export interface CommandPaletteAction {
  id: string
  title: string
  description: string
  category: string
  keywords?: string[]
  shortcut?: string
  disabled?: boolean
}

interface CommandPaletteProps {
  actions: CommandPaletteAction[]
  recentActionIds: string[]
  labels: {
    title: string
    search: string
    recent: string
    all: string
    noMatch: string
    enterRuns: string
    escapeCloses: string
  }
  onClose: () => void
  onRun: (action: CommandPaletteAction) => void
}

interface ScoredAction {
  action: CommandPaletteAction
  score: number
}

function fuzzyCommandScore(action: CommandPaletteAction, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return 1

  const haystack = [
    action.title,
    action.description,
    action.category,
    ...(action.keywords ?? [])
  ].join(' ').toLowerCase()

  let score = 0
  let cursor = 0
  let streak = 0

  for (const char of query) {
    const index = haystack.indexOf(char, cursor)
    if (index === -1) return 0
    streak = index === cursor ? streak + 1 : 1
    score += 4 + streak
    if (index === 0 || /[\s/:-]/.test(haystack[index - 1])) score += 6
    cursor = index + 1
  }

  if (haystack.includes(query)) score += 30
  if (action.title.toLowerCase().includes(query)) score += 20
  return score / Math.max(1, haystack.length / 80)
}

export function CommandPalette({ actions, recentActionIds, labels, onClose, onRun }: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const recentActions = useMemo(() => {
    const byId = new Map(actions.map((action) => [action.id, action]))
    return recentActionIds
      .map((id) => byId.get(id))
      .filter((action): action is CommandPaletteAction => Boolean(action))
      .slice(0, 5)
  }, [actions, recentActionIds])

  const visibleActions = useMemo(() => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      const recentIds = new Set(recentActions.map((action) => action.id))
      return [
        ...recentActions,
        ...actions.filter((action) => !recentIds.has(action.id))
      ]
    }

    return actions
      .map((action): ScoredAction => ({ action, score: fuzzyCommandScore(action, normalizedQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.action.title.localeCompare(b.action.title))
      .map((item) => item.action)
  }, [actions, query, recentActions])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const active = listRef.current?.querySelector('.command-palette-item.active')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const runActive = useCallback((action: CommandPaletteAction | undefined) => {
    if (!action || action.disabled) return
    onRun(action)
  }, [onRun])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(visibleActions.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      runActive(visibleActions[activeIndex])
    }
  }, [activeIndex, onClose, runActive, visibleActions])

  const recentVisible = !query.trim() && recentActions.length > 0
  const recentBoundary = recentVisible ? recentActions.length : 0

  return (
    <div className="command-palette-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label={labels.title}>
        <div className="command-palette-search">
          <Search size={16} aria-hidden />
          <input
            autoFocus
            value={query}
            placeholder={labels.search}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="command-palette-hint">
          <span>{labels.enterRuns}</span>
          <span>{labels.escapeCloses}</span>
        </div>
        <div className="command-palette-list" ref={listRef}>
          {visibleActions.length > 0 ? visibleActions.map((action, index) => (
            <div key={action.id} className="command-palette-row">
              {index === 0 || index === recentBoundary ? (
                <div className="command-palette-section">
                  {index === 0 && recentVisible ? labels.recent : labels.all}
                </div>
              ) : null}
              <button
                type="button"
                className={`command-palette-item ${index === activeIndex ? 'active' : ''}`}
                disabled={action.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => runActive(action)}
              >
                <span className="command-palette-item-text">
                  <span className="command-palette-item-title">{action.title}</span>
                  <span className="command-palette-item-desc">{action.description}</span>
                </span>
                <span className="command-palette-item-meta">
                  <span>{action.category}</span>
                  {action.shortcut ? <kbd>{action.shortcut}</kbd> : null}
                </span>
              </button>
            </div>
          )) : (
            <div className="command-palette-empty">{labels.noMatch}</div>
          )}
        </div>
      </section>
    </div>
  )
}
