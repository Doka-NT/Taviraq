import { useEffect, useRef, type MutableRefObject } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { FolderOpen } from 'lucide-react'
import type { TerminalSessionInfo } from '@shared/types'

interface TerminalPaneProps {
  activeSession?: TerminalSessionInfo & { status: 'running' | 'exited' }
  sessionIds: string[]
  layoutKey: string
  textSize: number
  onSelectionChange: (selection: string) => void
  outputBuffers: MutableRefObject<Map<string, string>>
  onOutput: (sessionId: string, data: string) => void
}

// C1 control characters (U+0080–U+009F) that appear as ?<0080> artifacts
const C1_REGEX = /[-]/g

export function TerminalPane({
  activeSession,
  sessionIds,
  layoutKey,
  textSize,
  onSelectionChange,
  outputBuffers,
  onOutput
}: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const activeSessionIdRef = useRef<string>()
  const resizeFrameRef = useRef<number>()
  const initialResizeTimerRef = useRef<number>()
  const textSizeRef = useRef(textSize)
  const activeSessionId = activeSession?.id

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace',
      fontSize: textSizeRef.current,
      lineHeight: 1.25,
      macOptionIsMeta: true,
      minimumContrastRatio: 4.5,
      scrollback: 5000,
      theme: {
        background: '#070c11',
        foreground: '#d8e4f0',
        cursor: '#f5ca5e',
        cursorAccent: '#070c11',
        selectionBackground: '#2a4060',
        selectionForeground: '#e8f0fa',
        black: '#070c11',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#f5ca5e',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#40d4d4',
        white: '#e2e8f0',
        brightBlack: '#8a99ad',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc'
      }
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    ;(terminal as XtermInternals)._aiTerminalFit = fit
    terminalRef.current = terminal
    fitRef.current = fit

    if (containerRef.current) {
      terminal.open(containerRef.current)
      initialResizeTimerRef.current = window.setTimeout(() => {
        if (containerRef.current) {
          scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
        }
      }, 150)
    }

    const dataDisposable = terminal.onData((data) => {
      const sessionId = activeSessionIdRef.current
      if (sessionId) {
        void window.api.terminal.write(sessionId, data)
      }
    })

    const selectionDisposable = terminal.onSelectionChange(() => {
      onSelectionChange(terminal.getSelection())
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
    }
  }, [onSelectionChange, onOutput])

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
    activeSessionIdRef.current = activeSessionId
    const terminal = terminalRef.current
    if (!terminal) return

    terminal.reset()
    const output = activeSessionId ? outputBuffers.current.get(activeSessionId) ?? '' : ''
    if (activeSessionId && output) {
      terminal.write(output)
    } else if (!activeSessionId) {
      terminal.write('\r\nNo active terminal session.\r\n')
    }

    queueMicrotask(() => {
      if (containerRef.current) {
        scheduleResize(terminal, containerRef.current, activeSessionId, resizeFrameRef)
      }
      if (activeSessionId && terminal.cols > 1 && terminal.rows > 1) {
        void window.api.terminal.resize(activeSessionId, terminal.cols, terminal.rows)
      }
    })
  }, [activeSessionId, outputBuffers])

  useEffect(() => {
    const liveSessionIds = new Set(sessionIds)
    for (const sessionId of outputBuffers.current.keys()) {
      if (!liveSessionIds.has(sessionId)) {
        outputBuffers.current.delete(sessionId)
      }
    }
  }, [sessionIds, outputBuffers])

  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal && containerRef.current) {
      scheduleResize(terminal, containerRef.current, activeSessionIdRef.current, resizeFrameRef)
    }
  }, [layoutKey])

  const cwd = activeSession?.cwd ?? activeSession?.command ?? 'Terminal'
  const status = activeSession?.status

  return (
    <div className="terminal-frame">
      <div className="terminal-meta">
        <div className="terminal-meta-cwd">
          <FolderOpen size={13} aria-hidden />
          <span title={cwd}>{cwd}</span>
        </div>
        {status ? (
          <span className={`terminal-status-pill ${status}`}>
            {status}
          </span>
        ) : null}
      </div>
      <div className="terminal-container" ref={containerRef} />
    </div>
  )
}

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
