import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Code2, FileText, Search, Terminal } from 'lucide-react'

export type CommandPaletteCategoryFilter = 'all' | 'commands' | 'snippets' | 'prompts'

export interface CommandPaletteAction {
  id: string
  title: string
  description: string
  category: string
  paletteCategory?: Exclude<CommandPaletteCategoryFilter, 'all'>
  actionHint?: string
  keywords?: string[]
  shortcut?: string
  metaEnterActionId?: string
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
    commands: string
    snippets: string
    prompts: string
    noMatch: string
    enterSelects: string
    escapeCloses: string
  }
  initialCategory?: CommandPaletteCategoryFilter
  showCategoryFilters?: boolean
  onClose: () => void
  onRun: (action: CommandPaletteAction) => void
}

interface ScoredAction {
  action: CommandPaletteAction
  score: number
}

const CATEGORY_FILTERS: CommandPaletteCategoryFilter[] = ['all', 'commands', 'snippets', 'prompts']

function getActionPaletteCategory(action: CommandPaletteAction): Exclude<CommandPaletteCategoryFilter, 'all'> {
  return action.paletteCategory ?? 'commands'
}

function getCategoryLabel(labels: CommandPaletteProps['labels'], category: CommandPaletteCategoryFilter): string {
  if (category === 'all') return labels.all
  if (category === 'commands') return labels.commands
  if (category === 'snippets') return labels.snippets
  return labels.prompts
}

function getCategoryIcon(category: Exclude<CommandPaletteCategoryFilter, 'all'>): JSX.Element {
  if (category === 'snippets') return <Code2 size={14} aria-hidden />
  if (category === 'prompts') return <FileText size={14} aria-hidden />
  return <Terminal size={14} aria-hidden />
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

export function CommandPalette({ actions, recentActionIds, labels, initialCategory = 'all', showCategoryFilters = true, onClose, onRun }: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CommandPaletteCategoryFilter>(initialCategory)
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const rawQuery = query.trim()
  const prefixCategory = showCategoryFilters && rawQuery.startsWith('/')
    ? 'snippets'
    : showCategoryFilters && rawQuery.startsWith('@')
      ? 'prompts'
      : undefined
  const visibleCategory = showCategoryFilters ? (prefixCategory ?? activeCategory) : 'all'
  const normalizedQuery = prefixCategory ? rawQuery.slice(1).trim() : rawQuery

  const recentActions = useMemo(() => {
    const byId = new Map(actions.map((action) => [action.id, action]))
    return recentActionIds
      .map((id) => byId.get(id))
      .filter((action): action is CommandPaletteAction => Boolean(action))
      .slice(0, 5)
  }, [actions, recentActionIds])

  const visibleActions = useMemo(() => {
    const categoryActions = visibleCategory === 'all'
      ? actions
      : actions.filter((action) => getActionPaletteCategory(action) === visibleCategory)

    if (!normalizedQuery) {
      const categoryRecentActions = visibleCategory === 'all'
        ? recentActions
        : recentActions.filter((action) => getActionPaletteCategory(action) === visibleCategory)
      const recentIds = new Set(categoryRecentActions.map((action) => action.id))
      return [
        ...categoryRecentActions,
        ...categoryActions.filter((action) => !recentIds.has(action.id))
      ]
    }

    return categoryActions
      .map((action): ScoredAction => ({ action, score: fuzzyCommandScore(action, normalizedQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.action.title.localeCompare(b.action.title))
      .map((item) => item.action)
  }, [actions, normalizedQuery, recentActions, visibleCategory])

  const recentVisibleCount = !normalizedQuery
    ? recentActions.filter((action) => visibleCategory === 'all' || getActionPaletteCategory(action) === visibleCategory).length
    : 0

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    setActiveCategory(initialCategory)
    setActiveIndex(0)
  }, [initialCategory])

  useEffect(() => {
    const active = listRef.current?.querySelector('.command-palette-item.active')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const runActive = useCallback((action: CommandPaletteAction | undefined, metaEnter = false) => {
    if (!action || action.disabled) return
    if (metaEnter && action.metaEnterActionId) {
      const metaAction = actions.find((candidate) => candidate.id === action.metaEnterActionId)
      if (metaAction && !metaAction.disabled) {
        onRun(metaAction)
        return
      }
    }
    onRun(action)
  }, [actions, onRun])

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
      runActive(visibleActions[activeIndex], event.metaKey || event.ctrlKey)
    }
  }, [activeIndex, onClose, runActive, visibleActions])

  const recentVisible = recentVisibleCount > 0
  const recentBoundary = recentVisible ? recentVisibleCount : 0

  return (
    <div className="command-palette-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        className={`command-palette ${showCategoryFilters ? 'with-filters' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
      >
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
          <span>{labels.enterSelects}</span>
          <span>{labels.escapeCloses}</span>
        </div>
        {showCategoryFilters ? (
          <div className="command-palette-filters" role="tablist" aria-label={labels.all}>
            {CATEGORY_FILTERS.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                className={`command-palette-filter ${activeCategory === category ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(category)
                  setActiveIndex(0)
                }}
              >
                {getCategoryLabel(labels, category)}
              </button>
            ))}
          </div>
        ) : null}
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
                <span className={`command-palette-item-icon ${getActionPaletteCategory(action)}`}>
                  {getCategoryIcon(getActionPaletteCategory(action))}
                </span>
                <span className="command-palette-item-text">
                  <span className="command-palette-item-title">{action.title}</span>
                  <span className="command-palette-item-desc">{action.description}</span>
                </span>
                <span className="command-palette-item-meta">
                  {action.actionHint ? <span>{action.actionHint}</span> : null}
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
