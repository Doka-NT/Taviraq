import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import type { TerminalSessionInfo } from '@shared/types'
import { useT } from '@renderer/i18n/language'
import type { TerminalColors } from '@renderer/themes/types'
import { outputWithVisibleCursor } from '@renderer/utils/terminalOutput'

interface TerminalPaneProps {
  activeSession?: TerminalSessionInfo & { status: 'running' | 'exited' | 'disconnected' }
  sessionIds: string[]
  layoutKey: string
  textSize: number
  clearSignal: number
  onSelectionChange: (selection: string) => void
  outputBuffers: MutableRefObject<Map<string, string>>
  onOutput: (sessionId: string, data: string) => void
  onReconnect: (sessionId: string) => void
  terminalTheme?: TerminalColors
}

export interface TerminalPaneHandle {
  focus: () => void
}

const DEFAULT_TERMINAL_THEME: TerminalColors = {
  background: '#0C0C0E',
  foreground: 'rgba(255,255,255,0.78)',
  cursor: '#E8399A',
  cursorAccent: '#0C0C0E',
  selectionBackground: 'rgba(41,196,232,0.22)',
  selectionForeground: '#ffffff',
  black: '#0C0C0E',
  red: '#F09595',
  green: '#34C759',
  yellow: '#EF9F27',
  blue: '#5BB8EC',
  magenta: '#E8399A',
  cyan: '#29C4E8',
  white: 'rgba(255,255,255,0.78)',
  brightBlack: 'rgba(255,255,255,0.32)',
  brightRed: '#F09595',
  brightGreen: '#34C759',
  brightYellow: '#EF9F27',
  brightBlue: '#5BB8EC',
  brightMagenta: '#E8399A',
  brightCyan: '#29C4E8',
  brightWhite: 'rgba(255,255,255,0.9)'
}

// C1 control characters (U+0080–U+009F) that appear as ?<0080> artifacts
const C1_REGEX = /[-]/g

export const TerminalPane = forwardRef<TerminalPaneHandle, TerminalPaneProps>(function TerminalPane({
  activeSession,
  sessionIds,
  layoutKey,
  textSize,
  clearSignal,
  onSelectionChange,
  outputBuffers,
  onOutput,
  onReconnect,
  terminalTheme
}: TerminalPaneProps, ref): JSX.Element {
  const { t } = useT()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const activeSessionIdRef = useRef<string>()
  const resizeFrameRef = useRef<number>()
  const initialResizeTimerRef = useRef<number>()
  const textSizeRef = useRef(textSize)
  const activeSessionStatusRef = useRef(activeSession?.status)
  const restoringRef = useRef(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<{ index: number, count: number } | null>(null)
  const activeSessionId = activeSession?.id

  useImperativeHandle(ref, () => ({
    focus: () => {
      terminalRef.current?.focus()
    }
  }), [])

  const closeSearch = useCallback((): void => {
    setIsSearchOpen(false)
    setSearchTerm('')
    setSearchResults(null)
    searchRef.current?.clearDecorations()
    terminalRef.current?.focus()
  }, [])

  const findNext = useCallback((): void => {
    if (!searchTerm.trim()) return
    searchRef.current?.findNext(searchTerm)
  }, [searchTerm])

  const findPrevious = useCallback((): void => {
    if (!searchTerm.trim()) return
    searchRef.current?.findPrevious(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace',
      fontSize: textSizeRef.current,
      lineHeight: 1.25,
      macOptionIsMeta: true,
      minimumContrastRatio: 4.5,
      scrollback: 5000,
      overviewRulerWidth: 0,
      theme: DEFAULT_TERMINAL_THEME
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    const webLinks = new WebLinksAddon((_event, uri) => {
      void window.api.app.openExternalUrl(uri).catch((error: unknown) => {
        console.error('[terminal link open failed]', error)
      })
    })
    terminal.loadAddon(fit)
    terminal.loadAddon(search)
    terminal.loadAddon(webLinks)
    ;(terminal as XtermInternals)._aiTerminalFit = fit
    terminalRef.current = terminal
    fitRef.current = fit
    searchRef.current = search

    if (containerRef.current) {
      terminal.open(containerRef.current)
      if (!navigator.webdriver) {
        try {
          terminal.loadAddon(new WebglAddon())
        } catch {
          // WebGL not available, falls back to canvas
        }
      }
      initialResizeTimerRef.current = window.setTimeout(() => {
        if (containerRef.current) {
          scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
        }
      }, 150)
    }

    const dataDisposable = terminal.onData((data) => {
      if (restoringRef.current) return
      const sessionId = activeSessionIdRef.current
      if (sessionId && activeSessionStatusRef.current === 'running') {
        void window.api.terminal.write(sessionId, data)
      }
    })

    const selectionDisposable = terminal.onSelectionChange(() => {
      onSelectionChange(terminal.getSelection())
    })

    const resultsDisposable = search.onDidChangeResults(({ resultIndex, resultCount }) => {
      setSearchResults({ index: resultIndex, count: resultCount })
    })

    const offTerminalData = window.api.terminal.onData(({ sessionId, data }) => {
      const clean = data.replace(C1_REGEX, '')
      onOutput(sessionId, clean)

      if (sessionId === activeSessionIdRef.current) {
        terminal.write(clean)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
      }
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      dataDisposable.dispose()
      selectionDisposable.dispose()
      resultsDisposable.dispose()
      offTerminalData()
      resizeObserver.disconnect()
      if (initialResizeTimerRef.current) {
        window.clearTimeout(initialResizeTimerRef.current)
        initialResizeTimerRef.current = undefined
      }
      cancelScheduledResize(resizeFrameRef)
      delete (terminal as XtermInternals)._aiTerminalFit
      terminal.dispose()
      fitRef.current = null
      searchRef.current = null
    }
  }, [onSelectionChange, onOutput])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setIsSearchOpen(true)
        window.setTimeout(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }, 0)
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'g' && isSearchOpen) {
        event.preventDefault()
        if (event.shiftKey) {
          findPrevious()
        } else {
          findNext()
        }
      } else if (event.key === 'Escape' && isSearchOpen) {
        event.preventDefault()
        closeSearch()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [closeSearch, findNext, findPrevious, isSearchOpen])

  useEffect(() => {
    const search = searchRef.current
    if (!search || !isSearchOpen) return

    if (searchTerm.trim()) {
      search.findNext(searchTerm, { incremental: true })
    } else {
      search.clearDecorations()
      setSearchResults(null)
    }
  }, [isSearchOpen, searchTerm])

  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal && terminalTheme) {
      terminal.options.theme = terminalTheme
    }
  }, [terminalTheme])

  useEffect(() => {
    const terminal = terminalRef.current
    textSizeRef.current = textSize
    if (!terminal) return

    terminal.options.fontSize = textSize
    if (containerRef.current) {
      scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
    }
  }, [textSize])

  useEffect(() => {
    activeSessionIdRef.current = activeSession?.status === 'running' ? activeSessionId : undefined
    activeSessionStatusRef.current = activeSession?.status
    const terminal = terminalRef.current
    if (!terminal) return

    terminal.reset()
    searchRef.current?.clearDecorations()
    setSearchResults(null)
    const output = activeSessionId ? outputBuffers.current.get(activeSessionId) ?? '' : ''
    if (activeSessionId && output) {
      restoringRef.current = true
      terminal.write(outputWithVisibleCursor(output), () => {
        setTimeout(() => { restoringRef.current = false }, 50)
      })
    } else if (!activeSessionId) {
      terminal.write('\r\nNo active terminal session.\r\n')
    }

    queueMicrotask(() => {
      if (containerRef.current) {
        scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
      }
      if (activeSessionIdRef.current && terminal.cols > 1 && terminal.rows > 1) {
        void window.api.terminal.resize(activeSessionIdRef.current, terminal.cols, terminal.rows)
      }
    })
  }, [activeSessionId, activeSession?.status, outputBuffers])

  useEffect(() => {
    const liveSessionIds = new Set(sessionIds)
    for (const sessionId of outputBuffers.current.keys()) {
      if (!liveSessionIds.has(sessionId)) {
        outputBuffers.current.delete(sessionId)
      }
    }
  }, [sessionIds, outputBuffers])

  useEffect(() => {
    if (clearSignal === 0) return

    terminalRef.current?.clear()
    onSelectionChange('')
  }, [clearSignal, onSelectionChange])

  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal && containerRef.current) {
      scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
    }
  }, [layoutKey])

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        findPrevious()
      } else {
        findNext()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
    }
  }

  return (
    <div className="terminal-frame">
      <div className="terminal-container" ref={containerRef} />
      {isSearchOpen ? (
        <div className="terminal-search-panel">
          <Search size={14} aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(event) => { setSearchTerm(event.target.value) }}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('terminal.searchPlaceholder')}
            aria-label={t('terminal.searchPlaceholder')}
          />
          <span className="terminal-search-count">
            {searchTerm.trim() && searchResults
              ? searchResults.count > 0 && searchResults.index >= 0
                ? `${searchResults.index + 1}/${searchResults.count}`
                : t('terminal.searchNoResults')
              : ''}
          </span>
          <button
            type="button"
            className="terminal-search-button"
            onClick={findPrevious}
            disabled={!searchTerm.trim()}
            aria-label={t('terminal.searchPrevious')}
            title={t('terminal.searchPrevious')}
          >
            <ChevronUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="terminal-search-button"
            onClick={findNext}
            disabled={!searchTerm.trim()}
            aria-label={t('terminal.searchNext')}
            title={t('terminal.searchNext')}
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="terminal-search-button"
            onClick={closeSearch}
            aria-label={t('terminal.searchClose')}
            title={t('terminal.searchClose')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {activeSession?.status === 'disconnected' ? (
        <div className="terminal-reconnect-banner">
          <span>{t('terminal.sshDisconnected')}</span>
          <button
            type="button"
            className="quiet-button"
            onClick={() => onReconnect(activeSession.id)}
            disabled={!activeSession.reconnectCommand}
          >
            {t('terminal.reconnect')}
          </button>
        </div>
      ) : null}
    </div>
  )
})

function cancelScheduledResize(frameRef: MutableRefObject<number | undefined>): void {
  if (frameRef.current) {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = undefined
  }
}

function scheduleResize(
  terminal: Terminal,
  container: HTMLElement,
  sessionId: string | undefined,
  frameRef: MutableRefObject<number | undefined>,
  attempt = 0
): void {
  cancelScheduledResize(frameRef)

  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = undefined

    if (!hasXtermRenderer(terminal)) {
      if (attempt < 30) {
        scheduleResize(terminal, container, sessionId, frameRef, attempt + 1)
      }
      return
    }

    const rect = container.getBoundingClientRect()
    if (rect.width < 120 || rect.height < 80) return

    const before = { cols: terminal.cols, rows: terminal.rows }
    try {
      fitRefFor(terminal)?.fit()
    } catch {
      if (attempt < 30) {
        scheduleResize(terminal, container, sessionId, frameRef, attempt + 1)
      }
      return
    }

    if (sessionId && (before.cols !== terminal.cols || before.rows !== terminal.rows)) {
      void window.api.terminal.resize(sessionId, terminal.cols, terminal.rows)
    }
  })
}

interface XtermInternals {
  _core?: { _renderService?: { _renderer?: { value?: unknown } } }
  _aiTerminalFit?: FitAddon
}

function hasXtermRenderer(terminal: Terminal): boolean {
  return Boolean((terminal as XtermInternals)._core?._renderService?._renderer?.value)
}

function fitRefFor(terminal: Terminal): FitAddon | undefined {
  return (terminal as XtermInternals)._aiTerminalFit
}
