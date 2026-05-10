import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent, type MutableRefObject, type PointerEvent
} from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { BookmarkPlus, ChevronDown, ChevronUp, Copy, FileText, MousePointerClick, Play, Search, Sparkles, SquareCheckBig, SquareTerminal, X } from 'lucide-react'
import type { TerminalBlock, TerminalSessionInfo } from '@shared/types'
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
  terminalBlocks: TerminalBlock[]
  selectedBlockIds: string[]
  onToggleBlockSelection: (blockId: string, additive: boolean) => void
  onClearBlockSelection: () => void
  onAskBlocks: (blocks: TerminalBlock[]) => void
  onRerunBlock: (block: TerminalBlock) => void
  onSaveSnippet: (command: string) => void
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
const ANSI_ESCAPE = String.fromCharCode(27)
const OSC_RE = new RegExp(`${ANSI_ESCAPE}\\][^\\u0007]*(?:\\u0007|${ANSI_ESCAPE}\\\\)`, 'g')
const ANSI_RE = new RegExp(
  `${ANSI_ESCAPE}\\[[0-9;?]*[ -/]*[@-~]|${ANSI_ESCAPE}[@-_]|\\r(?!\\n)|[\\u0080-\\u009f]`,
  'g'
)

function isPromptOnlyLine(text: string): boolean {
  const trimmed = text.trim()
  return trimmed === '~' || trimmed === '%' || trimmed === '>' || /^[➜$#❯>]\s*$/.test(trimmed)
}

function stripTerminalControls(value: string): string {
  return value.replace(OSC_RE, '').replace(ANSI_RE, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function normalizeBlockOutput(block: TerminalBlock, output: string): string {
  const raw = output.slice(block.startOffset, block.endOffset)
  const clean = stripTerminalControls(raw)
    .split('\n')
    .filter((line) => !isPromptOnlyLine(line))
    .join('\n')
    .trim()
  const lines = clean.split('\n')
  const withoutEcho = lines[0]?.includes(block.command) ? lines.slice(1).join('\n').trim() : clean
  return withoutEcho
}

function blockText(block: TerminalBlock, output: string): string {
  const cleanOutput = normalizeBlockOutput(block, output)
  return [`$ ${block.command}`, cleanOutput].filter(Boolean).join('\n')
}

interface TerminalMetrics {
  top: number
  left: number
  width: number
  cellHeight: number
  cellWidth: number
  viewportY: number
  rows: number
}

interface Disposable {
  dispose: () => void
}

function sameTerminalMetrics(a: TerminalMetrics | null, b: TerminalMetrics): boolean {
  if (!a) return false

  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.cellHeight === b.cellHeight &&
    a.cellWidth === b.cellWidth &&
    a.viewportY === b.viewportY &&
    a.rows === b.rows
  )
}

function lineTextAt(terminal: Terminal, line: number): string {
  return terminal.buffer.active.getLine(line)?.translateToString(true) ?? ''
}

function parseCssRgb(value: string | undefined): [number, number, number] | undefined {
  const color = value?.trim()
  if (!color) return undefined

  const shortHex = /^#([0-9a-f]{3})$/i.exec(color)
  if (shortHex) {
    return shortHex[1].split('').map((part) => parseInt(`${part}${part}`, 16)) as [number, number, number]
  }

  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    return [
      parseInt(hex[1].slice(0, 2), 16),
      parseInt(hex[1].slice(2, 4), 16),
      parseInt(hex[1].slice(4, 6), 16)
    ]
  }

  const rgb = /^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/i.exec(color)
  if (rgb) {
    return [
      Math.round(Number(rgb[1])),
      Math.round(Number(rgb[2])),
      Math.round(Number(rgb[3]))
    ]
  }

  return undefined
}

function toHexChannel(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function blendHex(background: [number, number, number], foreground: [number, number, number], alpha: number): string {
  const channels = background.map((channel, index) => channel + (foreground[index] - channel) * alpha)
  return `#${channels.map(toHexChannel).join('')}`
}

function terminalBlockDecorationColor(container: HTMLElement, alpha = 0.16): string {
  const styles = getComputedStyle(container)
  const rootStyles = getComputedStyle(document.documentElement)
  const background = parseCssRgb(styles.backgroundColor) ??
    parseCssRgb(styles.getPropertyValue('--bg-terminal')) ??
    [12, 12, 14]
  const accent = parseCssRgb(rootStyles.getPropertyValue('--accent-brand')) ?? [232, 57, 154]

  return blendHex(background, accent, alpha)
}

function commandLinesForBlocks(terminal: Terminal, blocks: TerminalBlock[]): Map<string, number> {
  const result = new Map<string, number>()
  let searchFrom = 0

  for (const block of blocks.slice().sort((a, b) => a.startOffset - b.startOffset)) {
    const command = block.command.trim()
    if (!command) continue

    const nearbyStart = Math.max(searchFrom, block.startLine - 2)
    const nearbyEnd = Math.min(terminal.buffer.active.length - 1, block.startLine + 4)
    for (let line = nearbyStart; line <= nearbyEnd; line += 1) {
      if (lineTextAt(terminal, line).includes(command)) {
        result.set(block.id, line)
        searchFrom = line + 1
        break
      }
    }

    if (result.has(block.id)) continue

    for (let line = searchFrom; line < terminal.buffer.active.length; line += 1) {
      if (lineTextAt(terminal, line).includes(command)) {
        result.set(block.id, line)
        searchFrom = line + 1
        break
      }
    }
  }

  return result
}

function blockVisualRanges(terminal: Terminal, blocks: TerminalBlock[]): Map<string, { start: number; end: number }> {
  const commandLines = commandLinesForBlocks(terminal, blocks)
  const sorted = blocks.slice().sort((a, b) => a.startOffset - b.startOffset)
  const ranges = new Map<string, { start: number; end: number }>()

  for (let index = 0; index < sorted.length; index += 1) {
    const block = sorted[index]
    const start = commandLines.get(block.id)
    if (start === undefined) continue

    const nextStart = sorted
      .slice(index + 1)
      .map((candidate) => commandLines.get(candidate.id))
      .find((line): line is number => line !== undefined && line > start)

    let nextPromptLine: number | undefined
    const promptSearchEnd = nextStart === undefined ? terminal.buffer.active.length - 1 : nextStart
    for (let line = start + 1; line <= promptSearchEnd; line += 1) {
      if (isPromptOnlyLine(lineTextAt(terminal, line))) {
        nextPromptLine = line
        break
      }
    }

    const storedEndBoundary = block.complete
      ? Math.min(
        terminal.buffer.active.length,
        start + Math.max(0, block.endLine - block.startLine) + 1
      )
      : terminal.buffer.active.length
    const endBoundary = Math.min(
      nextStart === undefined ? storedEndBoundary : nextStart,
      nextPromptLine === undefined ? storedEndBoundary : nextPromptLine,
      storedEndBoundary
    )
    let end = Math.max(start, endBoundary - 1)
    while (end > start) {
      const text = lineTextAt(terminal, end)
      if (text.trim() !== '' && !isPromptOnlyLine(text)) break
      end -= 1
    }
    ranges.set(block.id, { start, end })
  }

  return ranges
}

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
  terminalBlocks,
  selectedBlockIds,
  onToggleBlockSelection,
  onClearBlockSelection,
  onAskBlocks,
  onRerunBlock,
  onSaveSnippet,
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
  const metricsFrameRef = useRef<number>()
  const initialResizeTimerRef = useRef<number>()
  const textSizeRef = useRef(textSize)
  const activeSessionStatusRef = useRef(activeSession?.status)
  const renderedSessionKeyRef = useRef<string>()
  const restoringRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const terminalBlocksRef = useRef<TerminalBlock[]>([])
  const selectedBlockIdsRef = useRef<string[]>([])
  const blockHighlightFrameRef = useRef<number>()
  const blockHighlightDecorationsRef = useRef<Disposable[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<{ index: number, count: number } | null>(null)
  const [terminalMetrics, setTerminalMetrics] = useState<TerminalMetrics | null>(null)
  const [hoveredBlockId, setHoveredBlockId] = useState<string>()
  const activeSessionId = activeSession?.id
  const selectedBlocks = useMemo(
    () => terminalBlocks.filter((block) => selectedBlockIds.includes(block.id)),
    [selectedBlockIds, terminalBlocks]
  )

  const syncBlockHighlightDecorations = useCallback((): void => {
    const terminal = terminalRef.current
    const container = containerRef.current
    if (!terminal || !container) return

    for (const decoration of blockHighlightDecorationsRef.current) {
      decoration.dispose()
    }
    blockHighlightDecorationsRef.current = []

    const ranges = blockVisualRanges(terminal, terminalBlocksRef.current)
    const viewportY = terminal.buffer.active.viewportY
    const viewportEnd = viewportY + terminal.rows - 1
    const cursorLine = terminal.buffer.active.baseY + terminal.buffer.active.cursorY

    const registerRangeDecorations = (
      blockIds: Iterable<string>,
      target: MutableRefObject<Disposable[]>,
      backgroundColor: string,
      opacity: string
    ): void => {
      for (const blockId of blockIds) {
        const range = ranges.get(blockId)
        if (!range || range.end < viewportY || range.start > viewportEnd) continue

        const visibleStart = Math.max(range.start, viewportY)
        const visibleEnd = Math.min(range.end, viewportEnd)
        for (let line = visibleStart; line <= visibleEnd; line += 1) {
          let marker: ReturnType<Terminal['registerMarker']> | undefined
          try {
            marker = terminal.registerMarker(line - cursorLine)
            if (!marker) {
              console.warn('[terminal block highlight decoration unavailable]', { line })
              continue
            }

            const decoration = terminal.registerDecoration({
              marker,
              x: 0,
              width: terminal.cols,
              height: 1,
              backgroundColor,
              layer: 'bottom'
            })
            if (!decoration) {
              marker.dispose()
              marker = undefined
              console.warn('[terminal block highlight decoration unavailable]', { line })
              continue
            }
            const renderDisposable = decoration.onRender((element) => {
              element.style.backgroundColor = backgroundColor
              element.style.opacity = opacity
              element.style.pointerEvents = 'none'
              element.style.transition = 'opacity 140ms ease, background-color 140ms ease'
              element.style.animation = 'terminalBlockDecorationIn 160ms ease-out both'
            })
            const activeMarker = marker
            target.current.push({
              dispose: () => {
                renderDisposable.dispose()
                decoration.dispose()
                activeMarker.dispose()
              }
            })
            marker = undefined
          } catch (error) {
            marker?.dispose()
            console.error('[terminal block highlight decoration failed]', error)
          }
        }
      }
    }

    const selectedIds = new Set(selectedBlockIdsRef.current)
    const selectedColor = terminalBlockDecorationColor(container, 0.12)
    registerRangeDecorations(selectedIds, blockHighlightDecorationsRef, selectedColor, '0.30')
  }, [])

  const scheduleBlockHighlightSync = useCallback((): void => {
    if (blockHighlightFrameRef.current) {
      cancelAnimationFrame(blockHighlightFrameRef.current)
    }
    blockHighlightFrameRef.current = requestAnimationFrame(() => {
      blockHighlightFrameRef.current = undefined
      syncBlockHighlightDecorations()
    })
  }, [syncBlockHighlightDecorations])

  const updateTerminalMetrics = useCallback((): void => {
    const terminal = terminalRef.current
    const container = containerRef.current
    if (!terminal || !container) {
      setTerminalMetrics(null)
      return
    }

    const screen = container.querySelector('.xterm-screen')
    if (!(screen instanceof HTMLElement) || terminal.rows <= 0) {
      setTerminalMetrics(null)
      return
    }

    const frameRect = container.getBoundingClientRect()
    const screenRect = screen.getBoundingClientRect()
    const cellHeight = screenRect.height / terminal.rows
    if (!Number.isFinite(cellHeight) || cellHeight <= 0) {
      setTerminalMetrics(null)
      return
    }

    const nextMetrics = {
      top: screenRect.top - frameRect.top,
      left: screenRect.left - frameRect.left,
      width: screenRect.width,
      cellHeight,
      cellWidth: screenRect.width / Math.max(terminal.cols, 1),
      viewportY: terminal.buffer.active.viewportY,
      rows: terminal.rows
    }
    setTerminalMetrics((current) => sameTerminalMetrics(current, nextMetrics) ? current : nextMetrics)
    scheduleBlockHighlightSync()
  }, [scheduleBlockHighlightSync])

  const scheduleTerminalMetricsUpdate = useCallback((): void => {
    if (metricsFrameRef.current) return
    metricsFrameRef.current = requestAnimationFrame(() => {
      metricsFrameRef.current = undefined
      updateTerminalMetrics()
    })
  }, [updateTerminalMetrics])

  useImperativeHandle(ref, () => ({
    focus: () => {
      terminalRef.current?.focus()
    }
  }), [])

  useEffect(() => {
    terminalBlocksRef.current = terminalBlocks
    selectedBlockIdsRef.current = selectedBlockIds
    scheduleBlockHighlightSync()
  }, [scheduleBlockHighlightSync, selectedBlockIds, terminalBlocks])

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
      allowProposedApi: true,
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
    const viewport = containerRef.current?.querySelector('.xterm-viewport')
    const handleViewportScroll = (): void => {
      setHoveredBlockId(undefined)
      scheduleTerminalMetricsUpdate()
    }
    viewport?.addEventListener('scroll', handleViewportScroll, { passive: true })

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

    const scrollDisposable = terminal.onScroll(() => {
      setHoveredBlockId(undefined)
      scheduleTerminalMetricsUpdate()
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
        scheduleTerminalMetricsUpdate()
      }
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      dataDisposable.dispose()
      selectionDisposable.dispose()
      resultsDisposable.dispose()
      scrollDisposable.dispose()
      viewport?.removeEventListener('scroll', handleViewportScroll)
      offTerminalData()
      resizeObserver.disconnect()
      if (initialResizeTimerRef.current) {
        window.clearTimeout(initialResizeTimerRef.current)
        initialResizeTimerRef.current = undefined
      }
      if (blockHighlightFrameRef.current) {
        cancelAnimationFrame(blockHighlightFrameRef.current)
        blockHighlightFrameRef.current = undefined
      }
      if (metricsFrameRef.current) {
        cancelAnimationFrame(metricsFrameRef.current)
        metricsFrameRef.current = undefined
      }
      for (const decoration of blockHighlightDecorationsRef.current) {
        decoration.dispose()
      }
      blockHighlightDecorationsRef.current = []
      cancelScheduledResize(resizeFrameRef)
      delete (terminal as XtermInternals)._aiTerminalFit
      terminal.dispose()
      fitRef.current = null
      searchRef.current = null
    }
  }, [onClearBlockSelection, onSelectionChange, onOutput, scheduleTerminalMetricsUpdate])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        event.stopPropagation()
        setIsSearchOpen(true)
        window.setTimeout(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }, 0)
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'g' && isSearchOpen) {
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) {
          findPrevious()
        } else {
          findNext()
        }
      } else if (event.key === 'Escape' && isSearchOpen) {
        event.preventDefault()
        event.stopPropagation()
        closeSearch()
      } else if (event.key === 'Escape' && selectedBlockIds.length) {
        event.preventDefault()
        event.stopPropagation()
        onClearBlockSelection()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true) }
  }, [closeSearch, findNext, findPrevious, isSearchOpen, onClearBlockSelection, selectedBlockIds.length])

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
      scheduleTerminalMetricsUpdate()
    }
  }, [scheduleTerminalMetricsUpdate, terminalTheme])

  useEffect(() => {
    const terminal = terminalRef.current
    textSizeRef.current = textSize
    if (!terminal) return

    terminal.options.fontSize = textSize
    if (containerRef.current) {
      scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
      scheduleTerminalMetricsUpdate()
    }
  }, [scheduleTerminalMetricsUpdate, textSize])

  useEffect(() => {
    activeSessionIdRef.current = activeSession?.status === 'running' ? activeSessionId : undefined
    activeSessionStatusRef.current = activeSession?.status
    const terminal = terminalRef.current
    if (!terminal) return

    const sessionKey = `${activeSessionId ?? ''}:${activeSession?.status ?? ''}`
    if (renderedSessionKeyRef.current === sessionKey) {
      return
    }
    renderedSessionKeyRef.current = sessionKey

    terminal.reset()
    searchRef.current?.clearDecorations()
    setSearchResults(null)
    const output = activeSessionId ? outputBuffers.current.get(activeSessionId) ?? '' : ''
    if (activeSessionId && output) {
      restoringRef.current = true
      terminal.write(outputWithVisibleCursor(output), () => {
        setTimeout(() => { restoringRef.current = false }, 50)
        scheduleTerminalMetricsUpdate()
      })
    } else if (!activeSessionId) {
      terminal.write(`\r\n${t('terminal.noActiveSession')}\r\n`)
    }

    queueMicrotask(() => {
      if (containerRef.current) {
        scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
        scheduleTerminalMetricsUpdate()
      }
      if (activeSessionIdRef.current && terminal.cols > 1 && terminal.rows > 1) {
        void window.api.terminal.resize(activeSessionIdRef.current, terminal.cols, terminal.rows)
      }
    })
  }, [activeSessionId, activeSession?.status, outputBuffers, scheduleTerminalMetricsUpdate, t])

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
    onClearBlockSelection()
  }, [clearSignal, onClearBlockSelection, onSelectionChange])

  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal && containerRef.current) {
      scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
      scheduleTerminalMetricsUpdate()
    }
  }, [layoutKey, scheduleTerminalMetricsUpdate])

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

  const blockAtClientY = useCallback((clientY: number): TerminalBlock | undefined => {
    if (terminalBlocks.length === 0) return undefined

    const terminal = terminalRef.current
    const container = containerRef.current
    if (!terminal || !container) return undefined

    const screen = container.querySelector('.xterm-screen')
    if (!(screen instanceof HTMLElement) || terminal.rows <= 0) return undefined

    const rect = screen.getBoundingClientRect()
    if (clientY < rect.top || clientY > rect.bottom) return undefined

    const cellHeight = rect.height / terminal.rows
    const line = terminal.buffer.active.viewportY + Math.floor((clientY - rect.top) / cellHeight)
    const ranges = blockVisualRanges(terminal, terminalBlocks)
    return terminalBlocks.find((block) => {
      const range = ranges.get(block.id)
      return range ? line >= range.start && line <= range.end : false
    })
  }, [terminalBlocks])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
  }

  const handleFrameMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.buttons !== 0) return
    if ((event.target as Element | null)?.closest('.terminal-block-toolbar')) return

    const block = blockAtClientY(event.clientY)
    setHoveredBlockId((current) => current === block?.id ? current : block?.id)
  }

  const handleFrameMouseLeave = (): void => {
    setHoveredBlockId(undefined)
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    if ((event.target as Element | null)?.closest('.terminal-block-toolbar')) return
    if ((event.target as Element | null)?.closest('.terminal-block-select-handle')) return

    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return

    const additive = event.metaKey || event.ctrlKey
    const block = blockAtClientY(event.clientY)
    if (block && additive) {
      event.preventDefault()
      onToggleBlockSelection(block.id, true)
    } else if (!additive && !block) {
      onClearBlockSelection()
    }
  }

  const selectBlockFromHandle = (event: MouseEvent<HTMLButtonElement>, blockId: string): void => {
    event.preventDefault()
    event.stopPropagation()
    onToggleBlockSelection(blockId, true)
  }

  const selectedBlockText = useCallback((block: TerminalBlock): string => {
    const output = outputBuffers.current.get(block.sessionId) ?? ''
    return blockText(block, output)
  }, [outputBuffers])

  const copyText = useCallback((text: string): void => {
    void navigator.clipboard.writeText(text)
  }, [])

  const copySelectedBlocks = useCallback((): void => {
    copyText(selectedBlocks.map(selectedBlockText).join('\n\n'))
  }, [copyText, selectedBlockText, selectedBlocks])

  const copySelectedCommands = useCallback((): void => {
    copyText(selectedBlocks.map((block) => block.command).join('\n'))
  }, [copyText, selectedBlocks])

  const copySelectedOutputs = useCallback((): void => {
    copyText(selectedBlocks.map((block) => {
      const output = outputBuffers.current.get(block.sessionId) ?? ''
      return normalizeBlockOutput(block, output)
    }).join('\n\n'))
  }, [copyText, outputBuffers, selectedBlocks])

  const rerunSelectedBlock = useCallback((): void => {
    const block = selectedBlocks[0]
    if (!block || selectedBlocks.length !== 1 || activeSession?.status !== 'running') return
    onRerunBlock(block)
  }, [activeSession?.status, onRerunBlock, selectedBlocks])

  const saveSelectedSnippet = useCallback((): void => {
    const block = selectedBlocks[0]
    if (!block || selectedBlocks.length !== 1) return
    onSaveSnippet(block.command.trim())
  }, [onSaveSnippet, selectedBlocks])

  const visibleSelectedBlocks = terminalMetrics
    ? selectedBlocks
      .map((block) => {
        const terminal = terminalRef.current
        const range = terminal ? blockVisualRanges(terminal, terminalBlocks).get(block.id) : undefined
        if (!range) return null

        const viewportY = terminalRef.current?.buffer.active.viewportY ?? terminalMetrics.viewportY
        const viewportEnd = viewportY + terminalMetrics.rows - 1
        if (range.end < viewportY || range.start > viewportEnd) {
          return null
        }

        const visibleStart = Math.max(range.start, viewportY)
        const visibleEnd = Math.min(range.end, viewportEnd)
        return {
          block,
          top: terminalMetrics.top + (visibleStart - viewportY) * terminalMetrics.cellHeight,
          height: Math.max(terminalMetrics.cellHeight, (visibleEnd - visibleStart + 1) * terminalMetrics.cellHeight)
        }
      })
      .filter((entry): entry is { block: TerminalBlock; top: number; height: number } => Boolean(entry))
    : []
  const toolbarTop = terminalMetrics && visibleSelectedBlocks.length
    ? Math.min(
      terminalMetrics.top + terminalMetrics.rows * terminalMetrics.cellHeight - 38,
      Math.max(8, Math.max(...visibleSelectedBlocks.map((entry) => entry.top + entry.height)) + 6)
    )
    : 10
  const hoveredBlockHandle = terminalMetrics && hoveredBlockId
    ? (() => {
      const terminal = terminalRef.current
      const hoveredBlock = terminalBlocks.find((block) => block.id === hoveredBlockId)
      const range = terminal && hoveredBlock ? blockVisualRanges(terminal, terminalBlocks).get(hoveredBlock.id) : undefined
      if (!hoveredBlock || !range) return null

      const viewportY = terminalRef.current?.buffer.active.viewportY ?? terminalMetrics.viewportY
      const viewportEnd = viewportY + terminalMetrics.rows - 1
      if (range.end < viewportY || range.start > viewportEnd) return null

      const visibleEnd = Math.min(range.end, viewportEnd)
      return {
        block: hoveredBlock,
        top: terminalMetrics.top + (visibleEnd - viewportY + 1) * terminalMetrics.cellHeight - 3,
        selected: selectedBlockIds.includes(hoveredBlock.id)
      }
    })()
    : null

  return (
    <div
      className="terminal-frame"
      onMouseMove={handleFrameMouseMove}
      onMouseLeave={handleFrameMouseLeave}
    >
      <div
        className="terminal-container"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      />
      {hoveredBlockHandle ? (
        <button
          type="button"
          className={`terminal-block-select-handle${hoveredBlockHandle.selected ? ' selected' : ''}`}
          style={{ top: hoveredBlockHandle.top, right: 14 }}
          title={hoveredBlockHandle.selected ? t('terminal.blocks.deselect') : t('terminal.blocks.select')}
          aria-label={hoveredBlockHandle.selected ? t('terminal.blocks.deselect') : t('terminal.blocks.select')}
          onClick={(event) => selectBlockFromHandle(event, hoveredBlockHandle.block.id)}
        >
          {hoveredBlockHandle.selected
            ? <SquareCheckBig size={13} aria-hidden="true" />
            : <MousePointerClick size={13} aria-hidden="true" />}
          <span>{hoveredBlockHandle.selected ? t('terminal.blocks.deselect') : t('terminal.blocks.select')}</span>
        </button>
      ) : null}
      {selectedBlocks.length && visibleSelectedBlocks.length ? (
        <div className="terminal-block-toolbar" style={{ top: toolbarTop }}>
          <span className="terminal-block-count">{selectedBlocks.length}</span>
          <button type="button" onClick={() => onAskBlocks(selectedBlocks)} title={t('terminal.blocks.askAi')} aria-label={t('terminal.blocks.askAi')}>
            <Sparkles size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={copySelectedBlocks} title={t('terminal.blocks.copyBlock')} aria-label={t('terminal.blocks.copyBlock')}>
            <Copy size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={copySelectedCommands} title={t('terminal.blocks.copyCommand')} aria-label={t('terminal.blocks.copyCommand')}>
            <SquareTerminal size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={copySelectedOutputs} title={t('terminal.blocks.copyOutput')} aria-label={t('terminal.blocks.copyOutput')}>
            <FileText size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={rerunSelectedBlock}
            disabled={selectedBlocks.length !== 1 || activeSession?.status !== 'running'}
            title={t('terminal.blocks.rerunCommand')}
            aria-label={t('terminal.blocks.rerunCommand')}
          >
            <Play size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={saveSelectedSnippet}
            disabled={selectedBlocks.length !== 1}
            title={t('terminal.blocks.saveSnippet')}
            aria-label={t('terminal.blocks.saveSnippet')}
          >
            <BookmarkPlus size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={onClearBlockSelection} title={t('terminal.blocks.clearSelection')} aria-label={t('terminal.blocks.clearSelection')}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
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
