import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, Command, PanelRightClose, PanelRightOpen, Play, Plus, Search, Server, Settings2, ShieldAlert, Terminal, X } from 'lucide-react'
import type { CommandSnippet, RestorableAssistantThread, RestorableAssistantThreads, RestoredTerminalSession, SessionStateSnapshot, SSHProfileConfig, TerminalBlock, TerminalSessionInfo } from '@shared/types'
import { TerminalPane, type TerminalPaneHandle } from './components/TerminalPane'
import { LlmPanel } from './components/LlmPanel'
import { LanguageProvider } from './i18n/LanguageContext'
import { useT } from './i18n/language'
import { TRANSLATIONS, type Language, type Translations } from './i18n/translations'
import { themeMap, DEFAULT_THEME_ID } from './themes/definitions'
import { applyThemeToDom } from './themes/applyTheme'
import type { TerminalColors } from './themes/types'

interface SessionState extends TerminalSessionInfo {
  status: 'running' | 'exited' | 'disconnected'
}

const MAX_OUTPUT_CHARS = 2 * 1024 * 1024
const DEFAULT_SIDEBAR_WIDTH = 380
const MIN_SIDEBAR_WIDTH = 300
const MAX_SIDEBAR_WIDTH = 720
const MIN_WORKSPACE_WIDTH = 520
const DEFAULT_TEXT_SIZE = 13.5
const STORAGE_PREFIX = 'taviraq'
const LEGACY_STORAGE_PREFIX = 'ai-terminal'
const SIDEBAR_WIDTH_KEY = `${STORAGE_PREFIX}.sidebarWidth`
const SIDEBAR_VISIBLE_KEY = `${STORAGE_PREFIX}.sidebarVisible`
const TEXT_SIZE_KEY = `${STORAGE_PREFIX}.textSize`
const LANGUAGE_KEY = `${STORAGE_PREFIX}.language`
const THEME_KEY = `${STORAGE_PREFIX}.theme`
const RESTORE_SESSIONS_KEY = `${STORAGE_PREFIX}.restoreSessions`
const MAX_OUTPUT_CONTEXT_KEY = `${STORAGE_PREFIX}.maxOutputContext`
const DEFAULT_HIDE_SHORTCUT = 'CommandOrControl+Shift+Space'
const DEFAULT_MAX_OUTPUT_CONTEXT = 20000
type SettingsTab = 'appearance' | 'providers' | 'connections' | 'security' | 'prompts' | 'snippets' | 'data'
let storageMigrationComplete = false

interface BlockPromptRequest {
  id: string
  sessionId: string
  prompt: string
}

interface SnippetDraftRequest {
  id: string
  name?: string
  command?: string
}

interface PendingBlockPrompt {
  id: string
  sessionId: string
  prompt: string
  blockCount: number
}

interface PendingBlockRerun {
  sessionId: string
  command: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function storedNumber(key: string, fallback: number, min: number, max: number): number {
  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) ? clamp(value, min, max) : fallback
}

function storedPositiveNumber(key: string, fallback: number): number {
  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function migrateLocalStorageKeys(): void {
  if (storageMigrationComplete) return
  storageMigrationComplete = true

  const keys = [
    'sidebarWidth',
    'sidebarVisible',
    'textSize',
    'language',
    'theme',
    'restoreSessions',
    'maxOutputContext'
  ]

  for (const key of keys) {
    const nextKey = `${STORAGE_PREFIX}.${key}`
    const legacyKey = `${LEGACY_STORAGE_PREFIX}.${key}`
    if (window.localStorage.getItem(nextKey) !== null) continue

    const legacyValue = window.localStorage.getItem(legacyKey)
    if (legacyValue === null) continue

    window.localStorage.setItem(
      nextKey,
      legacyValue === 'ai-terminal-dark' ? DEFAULT_THEME_ID : legacyValue
    )
  }
}

function getTabLabel(session: TerminalSessionInfo): string {
  if (session.kind !== 'ssh') {
    return session.label
  }

  const remoteTarget = session.remoteTarget?.trim()
  if (!remoteTarget) {
    return session.label
  }

  return session.label && session.label !== remoteTarget
    ? `${session.label} · ${remoteTarget}`
    : remoteTarget
}

function lineCount(output: string): number {
  if (!output) return 0
  return output.split('\n').length - 1
}

function findCommandStart(output: string, command: string): number {
  const commandIndex = output.lastIndexOf(command)
  if (commandIndex === -1) return output.length

  const previousNewline = output.lastIndexOf('\n', commandIndex)
  return previousNewline === -1 ? 0 : previousNewline + 1
}

function findBlockVisualStartLine(output: string, command: string): number {
  const commandStart = findCommandStart(output, command)
  if (commandStart < output.length) {
    return lineCount(output.slice(0, commandStart))
  }

  const lines = output.split('\n')
  return Math.max(0, lines.length - 2)
}

function updateBlockBounds(block: TerminalBlock, output: string): TerminalBlock {
  const lineEnd = output.indexOf('\n', block.startOffset)
  const storedCommandLine = output.slice(block.startOffset, lineEnd === -1 ? output.length : lineEnd)
  const hasCommandAtStoredStart = storedCommandLine.includes(block.command)
  const commandStart = hasCommandAtStoredStart ? block.startOffset : findCommandStart(output, block.command)
  const hasCommandInBuffer = commandStart < output.length
  const startOffset = hasCommandInBuffer ? commandStart : block.startOffset
  const startLine = hasCommandInBuffer
    ? lineCount(output.slice(0, commandStart))
    : block.startLine

  return {
    ...block,
    startOffset,
    startLine,
    endOffset: output.length,
    endLine: Math.max(startLine, lineCount(output))
  }
}

function stripTerminalControls(value: string): string {
  const escape = String.fromCharCode(27)
  return value
    .replace(new RegExp(`${escape}\\][^\\u0007]*(?:\\u0007|${escape}\\\\)`, 'g'), '')
    .replace(new RegExp(`${escape}\\[[0-9;?]*[ -/]*[@-~]|${escape}[@-_]|\\r(?!\\n)|[\\u0080-\\u009f]`, 'g'), '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function isPromptOnlyLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === '~' || trimmed === '%' || trimmed === '>' || /^[➜$#❯>]\s*$/.test(trimmed)
}

export function App(): JSX.Element {
  migrateLocalStorageKeys()

  const [sessions, setSessions] = useState<SessionState[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>()
  const [selectedText, setSelectedText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [terminalClearVersion, setTerminalClearVersion] = useState(0)
  const [sidebarVisible, setSidebarVisible] = useState(() =>
    window.localStorage.getItem(SIDEBAR_VISIBLE_KEY) !== 'false'
  )
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    storedNumber(SIDEBAR_WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)
  )
  const [textSize, setTextSize] = useState(() =>
    storedPositiveNumber(TEXT_SIZE_KEY, DEFAULT_TEXT_SIZE)
  )
  const [language, setLanguage] = useState<Language>(() =>
    (window.localStorage.getItem(LANGUAGE_KEY) as Language) ?? 'en'
  )
  const [themeId, setThemeId] = useState<string>(() =>
    window.localStorage.getItem(THEME_KEY) || DEFAULT_THEME_ID
  )
  const currentTheme = themeMap[themeId] ?? themeMap[DEFAULT_THEME_ID]
  const terminalTheme: TerminalColors = currentTheme.terminal
  const [restoreSessions, setRestoreSessions] = useState(() =>
    window.localStorage.getItem(RESTORE_SESSIONS_KEY) !== 'false'
  )
  const [restoredAssistantThreads, setRestoredAssistantThreads] = useState<RestorableAssistantThreads>({})
  const [hideShortcut, setHideShortcut] = useState(DEFAULT_HIDE_SHORTCUT)
  const [maxOutputContext, setMaxOutputContext] = useState(() =>
    storedPositiveNumber(MAX_OUTPUT_CONTEXT_KEY, DEFAULT_MAX_OUTPUT_CONTEXT)
  )
  const [newTabDropdownOpen, setNewTabDropdownOpen] = useState(false)
  const [snippetPaletteOpen, setSnippetPaletteOpen] = useState(false)
  const [settingsTabRequest, setSettingsTabRequest] = useState<SettingsTab>('providers')
  const [settingsTabRequestVersion, setSettingsTabRequestVersion] = useState(0)
  const [addSnippetRequestVersion, setAddSnippetRequestVersion] = useState(0)
  const [promptLibraryRequestVersion, setPromptLibraryRequestVersion] = useState(0)
  const [sshProfiles, setSshProfiles] = useState<SSHProfileConfig[]>([])
  const maxOutputContextRef = useRef(maxOutputContext)
  const outputBuffers = useRef(new Map<string, string>())
  const terminalBlocksRef = useRef(new Map<string, TerminalBlock[]>())
  const activeBlockIdsRef = useRef(new Map<string, string>())
  const appShellRef = useRef<HTMLElement>(null)
  const terminalPaneRef = useRef<TerminalPaneHandle | null>(null)
  const restoreInitializedRef = useRef(false)
  const restoreSessionsOnLaunchRef = useRef(restoreSessions)
  const restoreSessionsRef = useRef(restoreSessions)
  const saveTimerRef = useRef<number>()
  const sessionsRef = useRef<SessionState[]>([])
  const activeSessionIdRef = useRef<string>()
  const assistantThreadsRef = useRef<RestorableAssistantThreads>({})
  const [terminalBlocksRevision, setTerminalBlocksRevision] = useState(0)
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [blockPromptRequest, setBlockPromptRequest] = useState<BlockPromptRequest | null>(null)
  const [snippetDraftRequest, setSnippetDraftRequest] = useState<SnippetDraftRequest | null>(null)
  const [pendingBlockPrompt, setPendingBlockPrompt] = useState<PendingBlockPrompt | null>(null)
  const [pendingBlockRerun, setPendingBlockRerun] = useState<PendingBlockRerun | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions]
  )
  const activeCwd = activeSession?.cwd ?? activeSession?.command ?? ''
  const activeTerminalBlocks = activeSessionId && terminalBlocksRevision >= 0
    ? terminalBlocksRef.current.get(activeSessionId) ?? []
    : []
  const appT = useCallback((key: keyof Translations, vars?: Record<string, string | number>): string => {
    let result = TRANSLATIONS[language][key]
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        result = result.replace(`{${k}}`, String(v))
      }
    }
    return result
  }, [language])

  const getOutputForSession = useCallback((sessionId: string): string => {
    const buf = outputBuffers.current.get(sessionId) ?? ''
    return buf.slice(-maxOutputContextRef.current)
  }, [])

  const getOutput = useCallback((): string => {
    if (!activeSessionId) return ''
    return getOutputForSession(activeSessionId)
  }, [activeSessionId, getOutputForSession])

  const touchTerminalBlocks = useCallback(() => {
    setTerminalBlocksRevision((version) => version + 1)
  }, [])

  const updateActiveBlockEnd = useCallback((sessionId: string, output: string): void => {
    const blockId = activeBlockIdsRef.current.get(sessionId)
    if (!blockId) return

    const blocks = terminalBlocksRef.current.get(sessionId) ?? []
    const block = blocks.find((candidate) => candidate.id === blockId)
    if (!block) return

    Object.assign(block, updateBlockBounds(block, output))
  }, [])

  const handleCommandBlockStart = useCallback((sessionId: string, command: string): void => {
    const output = outputBuffers.current.get(sessionId) ?? ''
    const activeBlockId = activeBlockIdsRef.current.get(sessionId)
    if (activeBlockId) {
      const currentBlocks = terminalBlocksRef.current.get(sessionId) ?? []
      terminalBlocksRef.current.set(sessionId, currentBlocks.map((block) =>
        block.id === activeBlockId
          ? { ...updateBlockBounds(block, output), complete: true }
          : block
      ))
    }

    const startOffset = findCommandStart(output, command)
    const startLine = findBlockVisualStartLine(output, command)
    const block: TerminalBlock = {
      id: crypto.randomUUID(),
      sessionId,
      command,
      startOffset,
      endOffset: output.length,
      startLine,
      endLine: Math.max(startLine, lineCount(output)),
      complete: false
    }

    activeBlockIdsRef.current.set(sessionId, block.id)
    terminalBlocksRef.current.set(sessionId, [...(terminalBlocksRef.current.get(sessionId) ?? []), block])
    touchTerminalBlocks()
  }, [touchTerminalBlocks])

  const handleCommandBlockComplete = useCallback((sessionId: string): void => {
    const blockId = activeBlockIdsRef.current.get(sessionId)
    if (!blockId) return

    const output = outputBuffers.current.get(sessionId) ?? ''
    const blocks = terminalBlocksRef.current.get(sessionId) ?? []
    terminalBlocksRef.current.set(sessionId, blocks.map((block) =>
      block.id === blockId
        ? { ...updateBlockBounds(block, output), complete: true }
        : block
    ))
    activeBlockIdsRef.current.delete(sessionId)
    touchTerminalBlocks()
  }, [touchTerminalBlocks])

  const toggleBlockSelection = useCallback((blockId: string, additive: boolean): void => {
    setSelectedBlockIds((current) => {
      if (!additive) return [blockId]
      return current.includes(blockId)
        ? current.filter((id) => id !== blockId)
        : [...current, blockId]
    })
  }, [])

  const clearBlockSelection = useCallback(() => {
    setSelectedBlockIds([])
  }, [])

  const askAboutBlocks = useCallback((blocks: TerminalBlock[]): void => {
    if (!activeSessionId || !blocks.length) return

    const selected = blocks
      .slice()
      .sort((a, b) => a.startOffset - b.startOffset)
      .map((block, index) => {
        const output = outputBuffers.current.get(block.sessionId) ?? ''
        const rawOutput = stripTerminalControls(output.slice(block.startOffset, block.endOffset))
          .split('\n')
          .filter((line) => !isPromptOnlyLine(line))
          .join('\n')
          .trim()
        const outputLines = rawOutput.split('\n')
        const cleanOutput = outputLines[0]?.includes(block.command)
          ? outputLines.slice(1).join('\n').trim()
          : rawOutput
        const text = [`$ ${block.command}`, cleanOutput].filter(Boolean).join('\n')
        return `${appT('terminal.blocks.label', { index: index + 1 })}\n\`\`\`text\n${text}\n\`\`\``
      })
      .join('\n\n')

    setPendingBlockPrompt({
      id: crypto.randomUUID(),
      sessionId: activeSessionId,
      blockCount: blocks.length,
      prompt: `${appT('terminal.blocks.askPrompt')}\n\n${selected}`
    })
  }, [activeSessionId, appT])

  const confirmBlockPromptSend = useCallback((): void => {
    if (!pendingBlockPrompt) return

    setBlockPromptRequest({
      id: crypto.randomUUID(),
      sessionId: pendingBlockPrompt.sessionId,
      prompt: pendingBlockPrompt.prompt
    })
    setSidebarVisible(true)
    setPendingBlockPrompt(null)
  }, [pendingBlockPrompt])

  const requestBlockRerun = useCallback((block: TerminalBlock): void => {
    setPendingBlockRerun({
      sessionId: block.sessionId,
      command: block.command
    })
  }, [])

  const confirmBlockRerun = useCallback((): void => {
    if (!pendingBlockRerun) return

    void window.api.command.runConfirmed(pendingBlockRerun.sessionId, pendingBlockRerun.command)
    setPendingBlockRerun(null)
  }, [pendingBlockRerun])

  const scheduleSessionStateSave = useCallback(() => {
    if (!restoreInitializedRef.current || !restoreSessionsRef.current) return
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = undefined
      const liveSessions = sessionsRef.current
      const liveSessionIds = new Set(liveSessions.map((session) => session.id))
      const assistantThreads = Object.fromEntries(
        Object.entries(assistantThreadsRef.current).filter(([sessionId]) => liveSessionIds.has(sessionId))
      )
      const snapshot: SessionStateSnapshot = {
        version: 1,
        savedAt: new Date().toISOString(),
        activeSessionId: activeSessionIdRef.current,
        sessions: liveSessions.map((session): RestoredTerminalSession => ({
          id: session.id,
          kind: session.kind,
          label: session.label,
          localLabel: session.localLabel,
          cwd: session.cwd,
          shell: session.shell,
          remoteHost: session.remoteHost,
          remoteTarget: session.remoteTarget,
          reconnectCommand: session.reconnectCommand,
          command: session.command,
          createdAt: session.createdAt,
          status: session.kind === 'ssh' ? 'disconnected' : session.status,
          output: outputBuffers.current.get(session.id) ?? ''
        })),
        assistantThreads
      }
      void window.api.sessionState.save(snapshot).catch((error: unknown) => {
        console.error('Failed to save session state', error)
      })
    }, 400)
  }, [])

  const handleOutput = useCallback((sessionId: string, data: string) => {
    const prev = outputBuffers.current.get(sessionId) ?? ''
    const next = prev + data
    if (next.length > MAX_OUTPUT_CHARS) {
      outputBuffers.current.set(sessionId, next.slice(-MAX_OUTPUT_CHARS))
      terminalBlocksRef.current.delete(sessionId)
      activeBlockIdsRef.current.delete(sessionId)
      setSelectedBlockIds([])
      touchTerminalBlocks()
    } else {
      outputBuffers.current.set(sessionId, next)
      updateActiveBlockEnd(sessionId, next)
    }
    scheduleSessionStateSave()
  }, [scheduleSessionStateSave, touchTerminalBlocks, updateActiveBlockEnd])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(sidebarVisible))
  }, [sidebarVisible])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    window.localStorage.setItem(TEXT_SIZE_KEY, String(textSize))
  }, [textSize])

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_KEY, language)
  }, [language])

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, themeId)
    applyThemeToDom(currentTheme)
  }, [themeId, currentTheme])

  useEffect(() => {
    maxOutputContextRef.current = maxOutputContext
    window.localStorage.setItem(MAX_OUTPUT_CONTEXT_KEY, String(maxOutputContext))
  }, [maxOutputContext])

  useEffect(() => {
    restoreSessionsRef.current = restoreSessions
    window.localStorage.setItem(RESTORE_SESSIONS_KEY, String(restoreSessions))
    if (!restoreSessions) {
      void window.api.sessionState.clear()
    } else {
      scheduleSessionStateSave()
    }
  }, [restoreSessions, scheduleSessionStateSave])

  useEffect(() => {
    sessionsRef.current = sessions
    scheduleSessionStateSave()
  }, [sessions, scheduleSessionStateSave])

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
    setSelectedBlockIds([])
    scheduleSessionStateSave()
  }, [activeSessionId, scheduleSessionStateSave])

  useEffect(() => () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    void window.api.config.load().then((config) => {
      if (config.hideShortcut) setHideShortcut(config.hideShortcut)
    })
  }, [])

  useEffect(() => {
    void window.api.ssh.listProfiles().then(setSshProfiles)
  }, [settingsOpen])

  useEffect(() => {
    if (!newTabDropdownOpen) return
    const onClick = () => setNewTabDropdownOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNewTabDropdownOpen(false) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [newTabDropdownOpen])

  const startSidebarResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)

    const applyWidth = (clientX: number): void => {
      const max = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, window.innerWidth - MIN_WORKSPACE_WIDTH))
      setSidebarWidth(clamp(window.innerWidth - clientX, MIN_SIDEBAR_WIDTH, max))
    }

    const onPointerMove = (moveEvent: PointerEvent): void => {
      applyWidth(moveEvent.clientX)
    }

    const onPointerUp = (): void => {
      window.removeEventListener('pointermove', onPointerMove)
      try {
        handle.releasePointerCapture(event.pointerId)
      } catch {
        // Pointer capture can already be released if the window loses focus.
      }
    }

    applyWidth(event.clientX)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
  }, [])

  const updateTextSize = useCallback((value: number) => {
    if (Number.isFinite(value) && value > 0) {
      setTextSize(value)
    }
  }, [])

  const updateSidebarWidth = useCallback((value: number) => {
    if (!Number.isFinite(value)) return
    const max = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, window.innerWidth - MIN_WORKSPACE_WIDTH))
    setSidebarWidth(clamp(value, MIN_SIDEBAR_WIDTH, max))
  }, [])

  const toggleSidebar = useCallback(() => setSidebarVisible((v) => !v), [])

  const handleHideShortcutChange = useCallback((shortcut: string) => {
    setHideShortcut(shortcut)
    void window.api.shortcuts.setHide(shortcut)
  }, [])

  const shellStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
    '--app-text-size': `${textSize}px`
  } as CSSProperties

  const createLocalSession = useCallback(async (request?: { cwd?: string; fallbackNotice?: string }) => {
    const session = await window.api.terminal.create(request?.cwd ? { cwd: request.cwd } : undefined)
    setSessions((current) => [...current, { ...session, status: 'running' }])
    setActiveSessionId(session.id)
    if (request?.fallbackNotice) {
      outputBuffers.current.set(session.id, request.fallbackNotice)
    }
    return session
  }, [])

  const connectSshProfile = useCallback(async (profile: SSHProfileConfig) => {
    setNewTabDropdownOpen(false)
    const session = await window.api.ssh.connectProfile(profile)
    setSessions((current) => [...current, { ...session, status: 'running' }])
    setActiveSessionId(session.id)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initializeSessions(): Promise<void> {
      if (!restoreSessionsOnLaunchRef.current) {
        restoreInitializedRef.current = true
        await createLocalSession()
        return
      }

      const snapshot = await window.api.sessionState.load()
      if (cancelled) return

      if (!snapshot?.sessions.length) {
        restoreInitializedRef.current = true
        await createLocalSession()
        return
      }

      const restoredSessions: SessionState[] = []
      const idMap = new Map<string, string>()
      const restoredOutputs = new Map<string, string>()

      for (const saved of snapshot.sessions) {
        if (saved.kind === 'local') {
          const session = await window.api.terminal.create(saved.cwd ? { cwd: saved.cwd } : undefined)
          if (cancelled) return
          const fallbackNotice = saved.cwd && session.cwd !== saved.cwd
            ? `\r\n[Taviraq restored this tab in ${session.cwd ?? 'your home directory'} because ${saved.cwd} was unavailable.]\r\n`
            : ''
          restoredSessions.push({ ...session, status: 'running' })
          idMap.set(saved.id, session.id)
          restoredOutputs.set(session.id, `${saved.output ?? ''}${fallbackNotice}`)
        } else {
          const id = `restored-${crypto.randomUUID()}`
          restoredSessions.push({
            id,
            kind: 'ssh',
            label: saved.label,
            localLabel: saved.localLabel,
            cwd: saved.cwd,
            shell: saved.shell,
            remoteHost: saved.remoteHost,
            remoteTarget: saved.remoteTarget,
            reconnectCommand: saved.reconnectCommand || reconnectCommandFromTarget(saved.remoteTarget),
            command: saved.command,
            createdAt: saved.createdAt,
            status: 'disconnected'
          })
          idMap.set(saved.id, id)
          restoredOutputs.set(id, saved.output ?? '')
        }
      }

      outputBuffers.current = restoredOutputs
      setSessions(restoredSessions)
      const restoredActiveId = snapshot.activeSessionId ? idMap.get(snapshot.activeSessionId) : undefined
      setActiveSessionId(restoredActiveId ?? restoredSessions[0]?.id)

      const remappedThreads: RestorableAssistantThreads = {}
      for (const [oldId, thread] of Object.entries(snapshot.assistantThreads ?? {})) {
        const nextId = idMap.get(oldId)
        if (nextId) {
          remappedThreads[nextId] = {
            ...thread,
            session: thread.session ? { ...thread.session, id: nextId } : undefined
          }
        }
      }
      assistantThreadsRef.current = remappedThreads
      setRestoredAssistantThreads(remappedThreads)
      restoreInitializedRef.current = true
      scheduleSessionStateSave()
    }

    void initializeSessions().catch((error: unknown) => {
      console.error('Failed to restore sessions', error)
      restoreInitializedRef.current = true
      void createLocalSession()
    })

    return () => {
      cancelled = true
    }
  }, [createLocalSession, scheduleSessionStateSave])

  useEffect(() => {
    const offExit = window.api.terminal.onExit(({ sessionId }) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, status: 'exited' } : session
        )
      )
    })

    const offCwd = window.api.terminal.onCwd(({ sessionId, cwd }) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, cwd } : session
        )
      )
    })

    const offSession = window.api.terminal.onSession((updatedSession) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === updatedSession.id ? { ...updatedSession, status: session.status } : session
        )
      )
    })

    return () => {
      offExit()
      offCwd()
      offSession()
    }
  }, [])

  useEffect(() => {
    const offCommand = window.api.terminal.onCommand(({ sessionId, command }) => {
      handleCommandBlockStart(sessionId, command)
    })
    const offPrompt = window.api.terminal.onPrompt(({ sessionId }) => {
      handleCommandBlockComplete(sessionId)
    })

    return () => {
      offCommand()
      offPrompt()
    }
  }, [handleCommandBlockComplete, handleCommandBlockStart])

  const closeSession = useCallback(async (sessionId: string) => {
    const closing = sessions.find((session) => session.id === sessionId)
    if (closing?.status !== 'disconnected') {
      await window.api.terminal.kill(sessionId)
    }
    outputBuffers.current.delete(sessionId)
    terminalBlocksRef.current.delete(sessionId)
    activeBlockIdsRef.current.delete(sessionId)
    setSelectedBlockIds([])
    touchTerminalBlocks()
    const remaining = sessions.filter((session) => session.id !== sessionId)
    setSessions(remaining)
    setActiveSessionId((current) => {
      if (current !== sessionId) return current
      return remaining.find((session) => session.id !== sessionId)?.id
    })
    if (remaining.length === 0) {
      void createLocalSession()
    }
  }, [sessions, createLocalSession, touchTerminalBlocks])

  const reconnectSession = useCallback(async (sessionId: string) => {
    const session = sessions.find((candidate) => candidate.id === sessionId)
    if (!session?.reconnectCommand) return

    const restoredOutput = outputBuffers.current.get(sessionId) ?? ''
    const next = await window.api.terminal.create(session.cwd ? { cwd: session.cwd } : undefined)
    const fallbackNotice = session.cwd && next.cwd !== session.cwd
      ? `\r\n[Taviraq reconnected from ${next.cwd ?? 'your home directory'} because ${session.cwd} was unavailable.]\r\n`
      : ''
    outputBuffers.current.delete(sessionId)
    outputBuffers.current.set(next.id, `${restoredOutput}${fallbackNotice}`)
    terminalBlocksRef.current.delete(sessionId)
    activeBlockIdsRef.current.delete(sessionId)
    setSelectedBlockIds([])
    touchTerminalBlocks()
    assistantThreadsRef.current = remapAssistantThreadId(assistantThreadsRef.current, sessionId, next.id)
    setRestoredAssistantThreads(assistantThreadsRef.current)
    setSessions((current) =>
      current.map((candidate) =>
        candidate.id === sessionId
          ? {
              ...next,
              kind: 'ssh',
              label: session.label,
              localLabel: next.label,
              remoteHost: session.remoteHost,
              remoteTarget: session.remoteTarget,
              reconnectCommand: session.reconnectCommand,
              command: session.command,
              createdAt: session.createdAt,
              status: 'running'
            }
          : candidate
      )
    )
    setActiveSessionId(next.id)
    void window.api.command.runConfirmed(next.id, session.reconnectCommand)
  }, [sessions, touchTerminalBlocks])

  const handleAssistantThreadsChange = useCallback((threads: RestorableAssistantThreads) => {
    assistantThreadsRef.current = threads
    scheduleSessionStateSave()
  }, [scheduleSessionStateSave])

  const handleReopenChat = useCallback(async (chatId: string) => {
    if (!activeSessionId) return
    const chat = await window.api.chatHistory.get(chatId)
    if (!chat) return
    const thread: RestorableAssistantThread = {
      messages: chat.messages,
      draft: '',
      session: chat.sessionSnapshot ? { id: activeSessionId, ...chat.sessionSnapshot } : undefined
    }
    const next = { ...assistantThreadsRef.current, [activeSessionId]: thread }
    assistantThreadsRef.current = next
    setRestoredAssistantThreads(next)
    scheduleSessionStateSave()
  }, [activeSessionId, scheduleSessionStateSave])

  const clearSavedSessionState = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = undefined
    }
    await window.api.sessionState.clear()
  }, [])

  const clearActiveTerminal = useCallback(() => {
    if (!activeSessionId) return

    outputBuffers.current.set(activeSessionId, '')
    terminalBlocksRef.current.delete(activeSessionId)
    activeBlockIdsRef.current.delete(activeSessionId)
    setSelectedBlockIds([])
    touchTerminalBlocks()
    setTerminalClearVersion((version) => version + 1)
  }, [activeSessionId, touchTerminalBlocks])

  const insertCommandSnippet = useCallback((command: string, run: boolean) => {
    if (!activeSessionId || activeSession?.status !== 'running') return
    void window.api.terminal.write(activeSessionId, run ? `${command}\r` : command)
    setSnippetPaletteOpen(false)
    requestAnimationFrame(() => {
      terminalPaneRef.current?.focus()
    })
  }, [activeSession?.status, activeSessionId])

  const openAddCommandSnippet = useCallback(() => {
    setSnippetPaletteOpen(false)
    setSettingsTabRequest('snippets')
    setSettingsTabRequestVersion((version) => version + 1)
    setAddSnippetRequestVersion((version) => version + 1)
    setSettingsOpen(true)
  }, [])

  const openSnippetForm = useCallback((command?: string) => {
    const normalizedCommand = command?.trim() ?? ''
    setSnippetPaletteOpen(false)
    setSettingsTabRequest('snippets')
    setSettingsTabRequestVersion((version) => version + 1)
    setAddSnippetRequestVersion(0)
    setSnippetDraftRequest({
      id: crypto.randomUUID(),
      name: normalizedCommand.split('\n')[0]?.trim().slice(0, 48) || undefined,
      command: normalizedCommand || undefined
    })
    setSettingsOpen(true)
  }, [])

  const closeActiveSession = useCallback(() => {
    if (!activeSessionId) return

    void closeSession(activeSessionId)
  }, [activeSessionId, closeSession])

  const activateNextSession = useCallback(() => {
    if (sessions.length === 0) return
    const activeIndex = sessions.findIndex((session) => session.id === activeSessionId)
    const nextIndex = activeIndex < 0 || activeIndex === sessions.length - 1 ? 0 : activeIndex + 1
    setActiveSessionId(sessions[nextIndex]?.id)
  }, [activeSessionId, sessions])

  const activateSessionByIndex = useCallback((index: number) => {
    const session = sessions[index]
    if (session) {
      setActiveSessionId(session.id)
    }
  }, [sessions])

  const handleTabbarDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.session-tab')) return

    void createLocalSession()
  }, [createLocalSession])

  useEffect(() => {
    return window.api.shortcuts.onShortcut((shortcut) => {
      if (shortcut === 'clear-terminal') {
        clearActiveTerminal()
      } else if (shortcut === 'open-prompt-library') {
        setPromptLibraryRequestVersion((version) => version + 1)
      } else if (shortcut === 'open-command-snippets') {
        setSnippetPaletteOpen(true)
      } else if (shortcut === 'open-settings') {
        setSettingsOpen(true)
      } else if (shortcut === 'new-tab') {
        void createLocalSession()
      } else if (shortcut === 'close-tab') {
        closeActiveSession()
      } else if (shortcut === 'next-tab') {
        activateNextSession()
      } else if (shortcut.startsWith('switch-tab-')) {
        activateSessionByIndex(Number(shortcut.replace('switch-tab-', '')) - 1)
      } else if (shortcut === 'toggle-sidebar') {
        toggleSidebar()
      }
    })
  }, [activateNextSession, activateSessionByIndex, clearActiveTerminal, closeActiveSession, createLocalSession, toggleSidebar])

  useEffect(() => {
    return window.api.shortcuts.onWindowShow(() => {
      const el = appShellRef.current
      if (!el) return
      el.classList.remove('window-entering')
      void el.offsetWidth
      el.classList.add('window-entering')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.api.shortcuts.notifyWindowReady()
        })
      })
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSnippetPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPromptLibraryRequestVersion((version) => version + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <LanguageProvider language={language}>
    <main ref={appShellRef} className={`app-shell${sidebarVisible ? '' : ' sidebar-hidden'}`} style={shellStyle}>
      <section className="workspace">
        <header className="topbar">
          <div className="topbar-window-spacer" aria-hidden />
          <div className="topbar-title">Taviraq</div>
          <div className="topbar-actions">
            <div className="tabbar-new-dropdown-wrapper">
              <button className="icon-button" type="button" onClick={(e) => { e.stopPropagation(); void window.api.ssh.listProfiles().then(setSshProfiles); setNewTabDropdownOpen((v) => !v) }} title={appT('app.newTerminal')}>
                <Plus size={16} aria-hidden />
              </button>
              {newTabDropdownOpen ? (
                <div className="tabbar-new-dropdown" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="tabbar-new-dropdown-item"
                    onClick={() => { setNewTabDropdownOpen(false); void createLocalSession() }}
                  >
                    <Terminal size={14} aria-hidden />
                    New Local Terminal
                  </button>
                  {sshProfiles.length > 0 ? (
                    <>
                      <div className="tabbar-new-dropdown-sep" />
                      <div className="tabbar-new-dropdown-label">SSH</div>
                      {sshProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          className="tabbar-new-dropdown-item"
                          onClick={() => { void connectSshProfile(profile) }}
                        >
                          <Server size={14} aria-hidden />
                          {profile.name || profile.host || 'Unnamed'}
                        </button>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSnippetPaletteOpen(true)}
              disabled={!activeSessionId || activeSession?.status !== 'running'}
              title={`${appT('snippetPalette.title')} (⌘⇧K)`}
              aria-label={`${appT('snippetPalette.title')} (⌘⇧K)`}
            >
              <Command size={16} aria-hidden />
            </button>
            <button className="icon-button" type="button" onClick={toggleSidebar} title={sidebarVisible ? appT('app.hideSidebar') : appT('app.showSidebar')} aria-label={sidebarVisible ? appT('app.hideSidebar') : appT('app.showSidebar')}>
              {sidebarVisible ? <PanelRightClose size={16} aria-hidden /> : <PanelRightOpen size={16} aria-hidden />}
            </button>
            <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} title={appT('app.settings')} aria-label={appT('app.settings')}>
              <Settings2 size={16} aria-hidden />
            </button>
          </div>
        </header>

        <div className="tabbar" role="tablist" aria-label="Terminal sessions" onDoubleClick={handleTabbarDoubleClick}>
          <div className="tab-list">
            {sessions.map((session) => {
              const tabLabel = getTabLabel(session)
              const tabClassName = [
                'session-tab',
                session.kind === 'ssh' ? 'ssh-session' : '',
                session.id === activeSessionId ? 'active' : ''
              ].filter(Boolean).join(' ')

              return (
                <button
                  className={tabClassName}
                  key={session.id}
                  type="button"
                  role="tab"
                  aria-selected={session.id === activeSessionId}
                  title={tabLabel}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  <span className={`status-dot ${session.status}`} />
                  <span className="tab-label">{tabLabel}</span>
                  {session.kind !== 'ssh' ? <span className="tab-kind">{session.kind}</span> : null}
                  <span
                    className="tab-close"
                    role="button"
                    tabIndex={0}
                    title={appT('app.closeSession')}
                    onClick={(event) => {
                      event.stopPropagation()
                      void closeSession(session.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.stopPropagation()
                        void closeSession(session.id)
                      }
                    }}
                  >
                    <X size={9} aria-hidden />
                  </span>
                </button>
              )
            })}
          </div>
          {activeCwd ? <div className="tabbar-cwd" title={activeCwd}>{activeCwd}</div> : null}
        </div>

        <TerminalPane
          ref={terminalPaneRef}
          activeSession={activeSession}
          sessionIds={sessions.map((session) => session.id)}
          layoutKey={`${sidebarWidth}-${textSize}-${sidebarVisible}`}
          textSize={textSize}
          clearSignal={terminalClearVersion}
          onSelectionChange={setSelectedText}
          outputBuffers={outputBuffers}
          onOutput={handleOutput}
          onReconnect={(sessionId) => { void reconnectSession(sessionId) }}
          terminalBlocks={activeTerminalBlocks}
          selectedBlockIds={selectedBlockIds}
          onToggleBlockSelection={toggleBlockSelection}
          onClearBlockSelection={clearBlockSelection}
          onAskBlocks={askAboutBlocks}
          onRerunBlock={requestBlockRerun}
          onSaveSnippet={openSnippetForm}
          terminalTheme={terminalTheme}
        />
        {!sidebarVisible && (
          <button
            type="button"
            className="sidebar-open-handle"
            onClick={toggleSidebar}
            title={appT('sidebar.openHandle')}
            aria-label={appT('sidebar.openHandle')}
          >
            <ChevronLeft size={14} aria-hidden />
          </button>
        )}
      </section>

      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Resize assistant sidebar"
        aria-orientation="vertical"
        aria-hidden={!sidebarVisible}
        onPointerDown={sidebarVisible ? startSidebarResize : undefined}
      />

      <LlmPanel
        activeSession={activeSession}
        sessionIds={sessions.map((session) => session.id)}
        selectedText={selectedText}
        getOutput={getOutput}
        getOutputForSession={getOutputForSession}
        settingsOpen={settingsOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onCloseSettings={() => setSettingsOpen(false)}
        settingsTabRequest={settingsTabRequest}
        settingsTabRequestVersion={settingsTabRequestVersion}
        addSnippetRequestVersion={addSnippetRequestVersion}
        promptLibraryRequestVersion={promptLibraryRequestVersion}
        textSize={textSize}
        onTextSizeChange={updateTextSize}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={updateSidebarWidth}
        language={language}
        onLanguageChange={setLanguage}
        themeId={themeId}
        onThemeChange={setThemeId}
        hideShortcut={hideShortcut}
        onHideShortcutChange={handleHideShortcutChange}
        maxOutputContext={maxOutputContext}
        onMaxOutputContextChange={setMaxOutputContext}
        restoreSessions={restoreSessions}
        onRestoreSessionsChange={setRestoreSessions}
        restoredThreads={restoredAssistantThreads}
        onThreadsChange={handleAssistantThreadsChange}
        onClearSavedSessionState={clearSavedSessionState}
        onReopenChat={(chatId) => { void handleReopenChat(chatId) }}
        onConnectSsh={(profile) => { void connectSshProfile(profile) }}
        blockPromptRequest={blockPromptRequest}
        snippetDraftRequest={snippetDraftRequest}
      />

      {pendingBlockPrompt ? (
        <div
          className="modal-overlay terminal-block-send-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminal-block-send-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPendingBlockPrompt(null)
          }}
        >
          <div
            className="modal-panel terminal-block-send-panel"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setPendingBlockPrompt(null)
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                event.stopPropagation()
                confirmBlockPromptSend()
              }
            }}
          >
            <div className="modal-header">
              <ShieldAlert size={15} aria-hidden />
              <span id="terminal-block-send-title">{appT('terminal.blocks.sendTitle')}</span>
            </div>
            <p className="terminal-block-send-copy">{appT('terminal.blocks.sendBody')}</p>
            <div className="terminal-block-send-meta">
              {appT('terminal.blocks.selectedCount', { count: pendingBlockPrompt.blockCount })}
            </div>
            <div className="modal-actions">
              <button type="button" className="quiet-button" onClick={() => setPendingBlockPrompt(null)} autoFocus>
                {appT('confirm.cancel')}
              </button>
              <button type="button" className="save-prompt-confirm" onClick={confirmBlockPromptSend}>
                {appT('terminal.blocks.send')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingBlockRerun ? (
        <div
          className="modal-overlay terminal-block-rerun-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminal-block-rerun-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPendingBlockRerun(null)
          }}
        >
          <div
            className="modal-panel terminal-block-send-panel"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setPendingBlockRerun(null)
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                event.stopPropagation()
                confirmBlockRerun()
              }
            }}
          >
            <div className="modal-header">
              <ShieldAlert size={15} aria-hidden />
              <span id="terminal-block-rerun-title">{appT('terminal.blocks.rerunTitle')}</span>
            </div>
            <p className="terminal-block-send-copy">{appT('terminal.blocks.rerunBody')}</p>
            <div className="command-confirmation-command">
              <code>{pendingBlockRerun.command}</code>
            </div>
            <div className="modal-actions">
              <button type="button" className="quiet-button" onClick={() => setPendingBlockRerun(null)} autoFocus>
                {appT('confirm.cancel')}
              </button>
              <button type="button" className="save-prompt-confirm" onClick={confirmBlockRerun}>
                {appT('terminal.blocks.rerunConfirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {snippetPaletteOpen ? (
        <CommandSnippetPalette
          activeSession={activeSession}
          onClose={() => setSnippetPaletteOpen(false)}
          onUse={insertCommandSnippet}
          onAddSnippet={openAddCommandSnippet}
        />
      ) : null}
    </main>
    </LanguageProvider>
  )
}

interface CommandSnippetPaletteProps {
  activeSession?: TerminalSessionInfo & { status: 'running' | 'exited' | 'disconnected' }
  onClose: () => void
  onUse: (command: string, run: boolean) => void
  onAddSnippet: () => void
}

function CommandSnippetPalette({ activeSession, onClose, onUse, onAddSnippet }: CommandSnippetPaletteProps): JSX.Element {
  const { t } = useT()
  const [snippets, setSnippets] = useState<CommandSnippet[]>([])
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.api.commandSnippet.list().then(setSnippets).catch(() => setSnippets([]))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return snippets
    return snippets.filter((snippet) =>
      snippet.name.toLowerCase().includes(q) ||
      snippet.command.toLowerCase().includes(q)
    )
  }, [query, snippets])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const active = listRef.current?.querySelector('.command-snippet-palette-item.active')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const canUse = activeSession?.status === 'running'

  const handleKeyDown = useCallback((event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const snippet = filtered[activeIndex]
      if (snippet && canUse) {
        onUse(snippet.command, event.metaKey || event.ctrlKey)
      }
    }
  }, [activeIndex, canUse, filtered, onClose, onUse])

  return (
    <div className="command-snippet-palette-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="command-snippet-palette" role="dialog" aria-modal="true" aria-label={t('snippetPalette.title')}>
        <div className="command-snippet-palette-search">
          <Search size={15} aria-hidden />
          <input
            autoFocus
            value={query}
            placeholder={t('snippetPalette.search')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="command-snippet-palette-hint">
          <div className="command-snippet-palette-shortcuts">
            <span>{t('snippetPalette.enterInserts')}</span>
            <span>{t('snippetPalette.metaEnterRuns')}</span>
          </div>
          <button type="button" className="command-snippet-palette-add" onClick={onAddSnippet}>
            <Plus size={12} aria-hidden />
            {t('snippetPalette.addSnippet')}
          </button>
        </div>
        <div className="command-snippet-palette-list" ref={listRef}>
          {filtered.length > 0 ? filtered.map((snippet, index) => (
            <button
              key={snippet.id}
              type="button"
              className={`command-snippet-palette-item ${index === activeIndex ? 'active' : ''}`}
              disabled={!canUse}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onUse(snippet.command, false)}
            >
              <div className="command-snippet-palette-item-text">
                <span className="command-snippet-palette-item-name">{snippet.name}</span>
                <code>{snippet.command}</code>
              </div>
              <span
                className="command-snippet-run-action"
                role="button"
                tabIndex={-1}
                title={t('snippetPalette.runNow')}
                onClick={(event) => {
                  event.stopPropagation()
                  onUse(snippet.command, true)
                }}
              >
                <Play size={13} aria-hidden />
                <kbd>⌘↵</kbd>
              </span>
            </button>
          )) : (
            <p className="command-snippet-palette-empty">
              {snippets.length === 0 ? t('snippetPalette.empty') : t('snippetPalette.noMatch')}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function reconnectCommandFromTarget(remoteTarget: string | undefined): string | undefined {
  return remoteTarget ? `ssh ${shellQuote(remoteTarget)}` : undefined
}

function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:@%+=,-]+$/.test(value)
    ? value
    : `'${value.replace(/'/g, `'\\''`)}'`
}

function remapAssistantThreadId(
  threads: RestorableAssistantThreads,
  oldSessionId: string,
  nextSessionId: string
): RestorableAssistantThreads {
  const thread = threads[oldSessionId]
  if (!thread) return threads
  const next = { ...threads }
  delete next[oldSessionId]
  next[nextSessionId] = {
    ...thread,
    session: thread.session ? { ...thread.session, id: nextSessionId } : undefined
  }
  return next
}
