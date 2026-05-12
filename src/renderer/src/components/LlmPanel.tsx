import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
  type FocusEvent, type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, BookmarkPlus, Bot, Brain, Check, ChevronDown, Command, FileText, GitFork, History, KeyRound, Pencil,
  MessageSquarePlus, Plus, RefreshCw, Search, Send, Server, Settings2, Square, Trash2, User, X, Zap
} from 'lucide-react'
import type {
  AssistMode, ChatMessage, ChatStreamEvent, CommandSnippet, LLMModel, LLMProviderConfig, LLMProviderType, PromptTemplate,
  RestorableAssistantThread, RestorableAssistantThreads, SSHProfileConfig, SavedChat, SavedChatSummary,
  TerminalContext, TerminalSessionInfo
} from '@shared/types'
import { MessageContent } from './MessageContent'
import { PromptPicker } from './PromptPicker'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { buildSuggestionChips, formatModelLabel, statusToInlineStatus } from '@renderer/utils/redesign'
import type { InlineStatus } from '@renderer/utils/redesign'
import { useT } from '@renderer/i18n/language'
import type { Language } from '@renderer/i18n/translations'
import { acceleratorToDisplay } from '@shared/accelerator'
import { themes } from '@renderer/themes/definitions'

// ...existing code...

const ANSI_ESCAPE = String.fromCharCode(27)
const OSC_RE = new RegExp(`${ANSI_ESCAPE}\\][^\\u0007]*(?:\\u0007|${ANSI_ESCAPE}\\\\)`, 'g')
const ANSI_RE = new RegExp(
  `${ANSI_ESCAPE}\\[[0-9;?]*[ -/]*[@-~]|${ANSI_ESCAPE}[@-_]|\\r(?!\\n)|[\\u0080-\\u009f]`,
  'g'
)
const stripAnsi = (s: string): string => s.replace(OSC_RE, '').replace(ANSI_RE, '')

function getTerminalDelta(before: string, after: string): string {
  if (after.startsWith(before)) return after.slice(before.length)

  let prefixLength = 0
  const maxPrefixLength = Math.min(before.length, after.length)
  while (prefixLength < maxPrefixLength && before[prefixLength] === after[prefixLength]) {
    prefixLength += 1
  }

  return after.slice(prefixLength)
}

function normalizeTerminalOutput(output: string): string {
  return stripAnsi(output)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function cleanCommandOutput(command: string, output: string): string {
  const normalizedCommand = command.trim()
  const normalizedOutput = normalizeTerminalOutput(output)
  const endedWithNewline = /[\r\n]$/.test(normalizedOutput)
  const lines = normalizedOutput.split('\n')
  const shouldDropTrailingPrompt = !endedWithNewline && lines.length > 1

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift()
  }

  if (lines[0]?.trim() === normalizedCommand) {
    lines.shift()
  }

  if (shouldDropTrailingPrompt) {
    lines.pop()
  }

  while (lines.length > 0 && lines.at(-1)?.trim() === '') {
    lines.pop()
  }

  return lines.join('\n').trim()
}

function extractFirstCommand(content: string): string | undefined {
  const runnableBlock = /```aiterm[^\r\n]*\r?\n([\s\S]*?)```/i.exec(content)
  if (runnableBlock?.[1]?.trim()) return runnableBlock[1].trim()

  const shellBlockRe = /```(?:bash|sh|shell|zsh|cmd|fish|ksh)[^\r\n]*\r?\n([\s\S]*?)```/gi
  for (const match of content.matchAll(shellBlockRe)) {
    const before = content.slice(0, match.index).trimEnd()
    const previousLine = before.split(/\r?\n/).at(-1)?.trim() ?? ''
    if (isAutoRunMarker(previousLine)) {
      return match[1]?.trim() || undefined
    }
  }

  return undefined
}

function isAutoRunMarker(line: string): boolean {
  return /^(?:выполню|запускаю|следующая команда|команда для запуска|i will run|running|run this|next command)\s*:$/i.test(line)
}

const defaultProvider: LLMProviderConfig = {
  name: 'OpenAI Compatible',
  providerType: 'openai',
  baseUrl: 'https://api.openai.com',
  apiKeyRef: 'openai-compatible-default',
  selectedModel: '',
  commandRiskModel: ''
}
const providerTypeDefaults: Record<LLMProviderType, Pick<LLMProviderConfig, 'name' | 'baseUrl'>> = {
  openai: { name: 'OpenAI Compatible', baseUrl: 'https://api.openai.com' },
  ollama: { name: 'Ollama', baseUrl: 'http://localhost:11434' },
  lmstudio: { name: 'LM Studio', baseUrl: 'http://localhost:1234' }
}
const providerTypeOptions: LLMProviderType[] = ['openai', 'ollama', 'lmstudio']
const DEFAULT_ASSIST_MODE: AssistMode = 'agent'
const MAX_VISIBLE_MODELS = 80
const MIN_TEXT_SIZE = 8
const MAX_TEXT_SIZE = 32
const MIN_SSH_PORT = 1
const MAX_SSH_PORT = 65535
const MIN_OUTPUT_CONTEXT = 1000

type ThreadMessage = ChatMessage & {
  display?: 'command-output' | 'system-status'
  command?: string
  output?: string
  reasoningContent?: string
}
type SettingsTab = 'appearance' | 'providers' | 'connections' | 'prompts' | 'snippets' | 'data'

interface CommandConfirmation {
  sessionId: string
  title: string
  reason: string
  command: string
  tone: 'danger' | 'warning'
  confirmLabel: string
}
type CommandConfirmationResult = string | false
type CommandConfirmationRequest = Omit<CommandConfirmation, 'sessionId'>

interface DeleteConfirmation {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<void> | void
}

function withObjectName(title: string, name?: string): string {
  const cleaned = name?.trim()
  if (!cleaned) return title
  return title.replace(/\?$/, '') + ` "${cleaned}"?`
}

function isValidProviderBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isValidTextSize(value: string): boolean {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= MIN_TEXT_SIZE && parsed <= MAX_TEXT_SIZE
}

function clampTextSize(value: string, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, parsed))
}

function isValidSshPort(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value >= MIN_SSH_PORT && value <= MAX_SSH_PORT)
}

function clampSshPort(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.min(MAX_SSH_PORT, Math.max(MIN_SSH_PORT, Math.round(value)))
}

function isValidOutputContext(value: string): boolean {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= MIN_OUTPUT_CONTEXT
}

function clampOutputContext(value: string, fallback: number): number {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(MIN_OUTPUT_CONTEXT, parsed)
}

function normalizeLibraryName(value: string): string {
  return value.trim().toLowerCase()
}

function matchesSearchQuery(query: string, terms: Array<string | undefined>): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return false
  return terms.some((term) => term?.toLowerCase().includes(normalizedQuery))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightSearchText({ text, query }: { text: string; query: string }): JSX.Element {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return <>{text}</>

  const queryPattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig')
  const normalizedLowerQuery = normalizedQuery.toLowerCase()
  const words = text.split(/(\s+)/)

  return (
    <>
      {words.map((word, wordIndex) => {
        if (!word || /^\s+$/.test(word)) return word

        const parts = word.split(queryPattern)
        const hasMatch = parts.some((part) => part.toLowerCase() === normalizedLowerQuery)
        if (!hasMatch) return word

        return (
          <span key={`${word}-${wordIndex}`} className="settings-search-word">
            {parts.map((part, partIndex) => (
              part.toLowerCase() === normalizedLowerQuery
                ? <mark key={`${part}-${partIndex}`} className="settings-search-highlight">{part}</mark>
                : part
            ))}
          </span>
        )
      })}
    </>
  )
}

interface ThinkingBlockProps {
  content: string
  isStreaming: boolean
  title: string
}

function ThinkingBlock({ content, isStreaming, title }: ThinkingBlockProps): JSX.Element {
  const contentRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [content])

  return (
    <details className="thinking-block">
      <summary>
        <span className="thinking-title">
          <Brain size={12} aria-hidden />
          {title}
        </span>
        {isStreaming ? <span className="thinking-live-dot" aria-hidden /> : null}
      </summary>
      <pre ref={contentRef}>{content.trim()}</pre>
    </details>
  )
}

interface AssistantThread {
  messages: ThreadMessage[]
  draft: string
  status: InlineStatus | null
  streaming: boolean
  activeRequestId?: string
  streamingContent: string
  agenticPending: string | null
  agenticRunning: boolean
  agenticCommandRunning: boolean
  agenticStep: number
  agenticCommand: string
  commandConfirmation: CommandConfirmation | null
  session?: Pick<TerminalSessionInfo, 'id' | 'kind' | 'label' | 'cwd' | 'shell'>
  savedChatId?: string
}

type AssistantThreads = Record<string, AssistantThread>

function createThread(): AssistantThread {
  return {
    messages: [],
    draft: '',
    status: null,
    streaming: false,
    streamingContent: '',
    agenticPending: null,
    agenticRunning: false,
    agenticCommandRunning: false,
    agenticStep: 0,
    agenticCommand: '',
    commandConfirmation: null
  }
}

function toRestorableThread(thread: AssistantThread): RestorableAssistantThread {
  return {
    messages: thread.messages.map((message) => ({
      role: message.role,
      content: message.content,
      display: message.display,
      command: message.command,
      output: message.output,
      reasoningContent: message.reasoningContent
    })),
    draft: thread.draft,
    session: thread.session
  }
}

function toRestorableThreads(threads: AssistantThreads): RestorableAssistantThreads {
  return Object.fromEntries(
    Object.entries(threads).map(([sessionId, thread]) => [sessionId, toRestorableThread(thread)])
  )
}

function fromRestorableThread(thread: RestorableAssistantThread): AssistantThread {
  return {
    ...createThread(),
    messages: thread.messages ?? [],
    draft: thread.draft ?? '',
    session: thread.session
  }
}

function fromRestorableThreads(threads: RestorableAssistantThreads): AssistantThreads {
  return Object.fromEntries(
    Object.entries(threads).map(([sessionId, thread]) => [sessionId, fromRestorableThread(thread)])
  )
}

function toChatMessage(message: ThreadMessage): ChatMessage {
  return {
    role: message.role,
    content: message.content
  }
}

function upsertProviderInOrder(providers: LLMProviderConfig[], provider: LLMProviderConfig): LLMProviderConfig[] {
  const existingIndex = providers.findIndex((candidate) => candidate.apiKeyRef === provider.apiKeyRef)
  if (existingIndex === -1) return [...providers, provider]
  return providers.map((candidate, index) => index === existingIndex ? provider : candidate)
}

function getProviderType(provider: LLMProviderConfig): LLMProviderType {
  return provider.providerType ?? 'openai'
}

function applyProviderTypeDefaults(provider: LLMProviderConfig, providerType: LLMProviderType): LLMProviderConfig {
  const previousDefaults = providerTypeDefaults[getProviderType(provider)]
  const nextDefaults = providerTypeDefaults[providerType]
  const shouldReplaceName = !provider.name.trim() || provider.name === previousDefaults.name
  const shouldReplaceBaseUrl = !provider.baseUrl.trim() || provider.baseUrl === previousDefaults.baseUrl

  return {
    ...provider,
    providerType,
    name: shouldReplaceName ? nextDefaults.name : provider.name,
    baseUrl: shouldReplaceBaseUrl ? nextDefaults.baseUrl : provider.baseUrl
  }
}

function progressPercent(progress: number): number {
  return Math.round(Math.min(Math.max(progress, 0), 1) * 100)
}

function formatModelDisplay(modelId: string | undefined): string {
  if (!modelId) return ''
  const label = formatModelLabel(modelId)
  return label.version ? `${label.name} — ${label.version}` : label.name
}

function electronToDisplay(shortcut: string): string {
  return acceleratorToDisplay(shortcut)
}

interface LlmPanelProps {
  activeSession?: TerminalSessionInfo & { status: 'running' | 'exited' | 'disconnected' }
  sessionIds: string[]
  selectedText: string
  getOutput: () => string
  getOutputForSession: (sessionId: string) => string
  settingsOpen: boolean
  onOpenSettings: () => void
  onCloseSettings: () => void
  settingsTabRequest: SettingsTab
  settingsTabRequestVersion: number
  addSnippetRequestVersion: number
  promptLibraryRequestVersion: number
  textSize: number
  onTextSizeChange: (textSize: number) => void
  sidebarWidth: number
  onSidebarWidthChange: (sidebarWidth: number) => void
  language: Language
  onLanguageChange: (language: Language) => void
  hideShortcut: string
  onHideShortcutChange: (shortcut: string) => void
  maxOutputContext: number
  onMaxOutputContextChange: (value: number) => void
  restoreSessions: boolean
  onRestoreSessionsChange: (enabled: boolean) => void
  restoredThreads: RestorableAssistantThreads
  onThreadsChange: (threads: RestorableAssistantThreads) => void
  onClearSavedSessionState: () => Promise<void>
  onReopenChat: (chatId: string) => void
  themeId: string
  onThemeChange: (themeId: string) => void
  onConnectSsh: (profile: SSHProfileConfig) => void
  blockPromptRequest?: { id: string; sessionId: string; prompt: string } | null
  snippetDraftRequest?: { id: string; name?: string; command?: string } | null
}

export function LlmPanel({
  activeSession,
  sessionIds,
  selectedText,
  getOutput,
  getOutputForSession,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  settingsTabRequest,
  settingsTabRequestVersion,
  addSnippetRequestVersion,
  promptLibraryRequestVersion,
  textSize,
  onTextSizeChange,
  sidebarWidth,
  onSidebarWidthChange,
  language,
  onLanguageChange,
  hideShortcut,
  onHideShortcutChange,
  maxOutputContext,
  onMaxOutputContextChange,
  restoreSessions,
  onRestoreSessionsChange,
  restoredThreads,
  onThreadsChange,
  onClearSavedSessionState,
  onReopenChat,
  themeId,
  onThemeChange,
  onConnectSsh,
  blockPromptRequest,
  snippetDraftRequest,
}: LlmPanelProps): JSX.Element {
  const { t } = useT()
  const [provider, setProvider] = useState<LLMProviderConfig>(defaultProvider)
  const [allProviders, setAllProviders] = useState<LLMProviderConfig[]>([defaultProvider])
  const [activeProviderRef, setActiveProviderRef] = useState(defaultProvider.apiKeyRef)
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<LLMModel[]>([])
  const [threadsBySessionId, setThreadsBySessionId] = useState<AssistantThreads>({})
  const [assistMode, setAssistMode] = useState<AssistMode>(DEFAULT_ASSIST_MODE)
  const [textSizeDraft, setTextSizeDraft] = useState(String(textSize))
  const [maxOutputContextDraft, setMaxOutputContextDraft] = useState(String(maxOutputContext))
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('providers')
  const [settingsSearch, setSettingsSearch] = useState('')
  const lastAutoOpenedSettingsQueryRef = useRef('')
  const settingsSearchRef = useRef<HTMLInputElement | null>(null)
  const [editingApiKey, setEditingApiKey] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [providerStatus, setProviderStatus] = useState('')
  const [dataStatus, setDataStatus] = useState('')
  const [recordingShortcut, setRecordingShortcut] = useState(false)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [savePromptDialog, setSavePromptDialog] = useState<{ content: string; name?: string } | null>(null)
  const [savePromptName, setSavePromptName] = useState('')
  const [savePromptStatus, setSavePromptStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savePromptDuplicateName, setSavePromptDuplicateName] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [promptPickerOpen, setPromptPickerOpen] = useState(false)
  const [promptPickerPrompts, setPromptPickerPrompts] = useState<PromptTemplate[]>([])
  const [promptPickerQuery, setPromptPickerQuery] = useState('')
  const [promptPickerActiveIndex, setPromptPickerActiveIndex] = useState(0)
  const promptPickerListRef = useRef<HTMLDivElement>(null)
  const promptPickerSearchRef = useRef<HTMLInputElement | null>(null)
  const [historyChats, setHistoryChats] = useState<SavedChatSummary[]>([])
  const [historySearch, setHistorySearch] = useState('')
  const [sshProfiles, setSshProfiles] = useState<SSHProfileConfig[]>([])
  const [sshProfile, setSshProfile] = useState<SSHProfileConfig | null>(null)

  // Refs for use inside stable closures
  const chatLogRef = useRef<HTMLElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const threadsRef = useRef<AssistantThreads>({})
  const liveSessionIdsRef = useRef(new Set<string>())
  const requestSessionRef = useRef(new Map<string, string>())
  const assistModeRef = useRef<AssistMode>(DEFAULT_ASSIST_MODE)
  const activeSessionRef = useRef(activeSession)
  const getOutputForSessionRef = useRef(getOutputForSession)
  const providerRef = useRef(provider)
  const selectedTextRef = useRef(selectedText)
  const promptResolversRef = useRef(new Map<string, () => void>())
  const commandConfirmationResolversRef = useRef(new Map<string, (result: CommandConfirmationResult) => void>())
  const handledBlockPromptRequestRef = useRef<string>()
  const runningCommandsRef = useRef(new Set<string>())
  const savePromptGenerationRequestIdRef = useRef<string | null>(null)
  const languageRef = useRef<Language>(language)
  const maxOutputContextRef = useRef(maxOutputContext)
  const chatHistorySaveTimerRef = useRef<number>()
  const loadingModelsRef = useRef(false)
  const activeSessionId = activeSession?.id
  const sessionIdKey = sessionIds.join('\0')
  const activeThread = activeSessionId ? threadsBySessionId[activeSessionId] ?? createThread() : createThread()
  const { messages, draft, status, streaming, agenticRunning, agenticCommandRunning, agenticStep, agenticCommand, commandConfirmation } = activeThread

  const liveStatus: 'idle' | 'running' | 'waiting' =
    commandConfirmation ? 'waiting' :
    (streaming || agenticRunning || agenticCommandRunning) ? 'running' :
    'idle'

  // Keep refs in sync
  useEffect(() => { languageRef.current = language }, [language])
  useEffect(() => { maxOutputContextRef.current = maxOutputContext }, [maxOutputContext])
  useEffect(() => { threadsRef.current = threadsBySessionId }, [threadsBySessionId])
  useEffect(() => { onThreadsChange(toRestorableThreads(threadsBySessionId)) }, [threadsBySessionId, onThreadsChange])
  useEffect(() => {
    setThreadsBySessionId(fromRestorableThreads(restoredThreads))
    threadsRef.current = fromRestorableThreads(restoredThreads)
  }, [restoredThreads])
  useEffect(() => { assistModeRef.current = assistMode }, [assistMode])
  useEffect(() => { activeSessionRef.current = activeSession }, [activeSession])
  useEffect(() => { getOutputForSessionRef.current = getOutputForSession }, [getOutputForSession])
  useEffect(() => { providerRef.current = provider }, [provider])
  useEffect(() => { selectedTextRef.current = selectedText }, [selectedText])
  useEffect(() => { setTextSizeDraft(String(textSize)) }, [textSize])
  useEffect(() => { setMaxOutputContextDraft(String(maxOutputContext)) }, [maxOutputContext])
  useEffect(() => () => {
    if (chatHistorySaveTimerRef.current) {
      window.clearTimeout(chatHistorySaveTimerRef.current)
      chatHistorySaveTimerRef.current = undefined
    }
  }, [])

  // Shortcut recording via main process IPC
  useEffect(() => {
    if (!recordingShortcut) return
    const unsubscribe = window.api.shortcuts.onRecorded((accelerator) => {
      void (async () => {
        if (accelerator === 'Escape') {
          setRecordingShortcut(false)
          setShortcutError(null)
          return
        }
        setRecordingShortcut(false)
        setShortcutError(null)
        const success = await window.api.shortcuts.setHide(accelerator)
        if (success) {
          onHideShortcutChange(accelerator)
        } else {
          setShortcutError(accelerator)
        }
      })()
    })
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setRecordingShortcut(false)
      setShortcutError(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    void window.api.shortcuts.startRecording()
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      unsubscribe()
      void window.api.shortcuts.stopRecording()
    }
  }, [recordingShortcut, onHideShortcutChange])

  const summarizeSession = useCallback((session: TerminalSessionInfo): Pick<TerminalSessionInfo, 'id' | 'kind' | 'label' | 'cwd' | 'shell'> => ({
    id: session.id,
    kind: session.kind,
    label: session.label,
    cwd: session.cwd,
    shell: session.shell
  }), [])

  const getThread = useCallback((sessionId: string): AssistantThread => {
    return threadsRef.current[sessionId] ?? createThread()
  }, [])

  const updateThread = useCallback((sessionId: string, updater: (thread: AssistantThread) => AssistantThread) => {
    if (liveSessionIdsRef.current.size > 0 && !liveSessionIdsRef.current.has(sessionId)) return
    const current = threadsRef.current
    const nextThread = updater(current[sessionId] ?? createThread())
    const next = { ...current, [sessionId]: nextThread }
    threadsRef.current = next
    setThreadsBySessionId(next)
  }, [])

  const saveThreadSnapshotToHistory = useCallback((thread: AssistantThread): string | undefined => {
    if (thread.messages.length === 0) return undefined
    const chatId = thread.savedChatId ?? crypto.randomUUID()
    const firstUserMsg = thread.messages.find((m) => m.role === 'user')
    const title = firstUserMsg?.content.slice(0, 60).replace(/\n/g, ' ') || 'Untitled chat'
    const savedChat: SavedChat = {
      id: chatId,
      title,
      messages: thread.messages.map((m) => ({
        role: m.role,
        content: m.content,
        display: m.display,
        command: m.command,
        output: m.output
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      providerRef: providerRef.current.apiKeyRef,
      modelId: providerRef.current.selectedModel,
      sessionSnapshot: thread.session
        ? { kind: thread.session.kind, label: thread.session.label, cwd: thread.session.cwd, shell: thread.session.shell }
        : undefined
    }
    void window.api.chatHistory.save(savedChat).catch((err: unknown) => {
      console.error('Failed to save chat to history', err)
    })
    return chatId
  }, [])

  const autoSaveThreadToHistory = useCallback((sessionId: string) => {
    const thread = threadsRef.current[sessionId]
    if (!thread || thread.messages.length === 0) return
    if (chatHistorySaveTimerRef.current) window.clearTimeout(chatHistorySaveTimerRef.current)
    chatHistorySaveTimerRef.current = window.setTimeout(() => {
      chatHistorySaveTimerRef.current = undefined
      const chatId = thread.savedChatId ?? crypto.randomUUID()
      if (!thread.savedChatId) {
        const current = threadsRef.current[sessionId]
        if (current && !current.savedChatId) {
          const updated = { ...current, savedChatId: chatId }
          threadsRef.current = { ...threadsRef.current, [sessionId]: updated }
          setThreadsBySessionId(threadsRef.current)
        }
      }
      saveThreadSnapshotToHistory({ ...thread, savedChatId: chatId })
    }, 500)
  }, [saveThreadSnapshotToHistory])

  useEffect(() => {
    const liveSessionIds = new Set(sessionIdKey ? sessionIdKey.split('\0') : [])
    liveSessionIdsRef.current = liveSessionIds
    const next: AssistantThreads = {}
    let changed = false

    for (const [sessionId, thread] of Object.entries(threadsRef.current)) {
      if (liveSessionIds.has(sessionId)) {
        next[sessionId] = thread
      } else {
        changed = true
        promptResolversRef.current.get(sessionId)?.()
        promptResolversRef.current.delete(sessionId)
        runningCommandsRef.current.delete(sessionId)
        commandConfirmationResolversRef.current.get(sessionId)?.(false)
        commandConfirmationResolversRef.current.delete(sessionId)
        if (thread.activeRequestId) requestSessionRef.current.delete(thread.activeRequestId)
      }
    }

    if (changed) {
      threadsRef.current = next
      setThreadsBySessionId(next)
    }
  }, [sessionIdKey])

  useEffect(() => {
    if (!activeSession) return
    updateThread(activeSession.id, (thread) => ({ ...thread, session: summarizeSession(activeSession) }))
  }, [activeSession, summarizeSession, updateThread])

  const loadConfig = useCallback(async () => {
    const config = await window.api.config.load()
    const providers = config.providers.length > 0 ? config.providers : [defaultProvider]
    const loadedActiveProviderRef = config.activeProviderRef ?? providers[0]?.apiKeyRef ?? defaultProvider.apiKeyRef
    const loaded =
      providers.find((p) => p.apiKeyRef === loadedActiveProviderRef) ??
      providers[0] ??
      defaultProvider
    setProvider(loaded)
    setAllProviders(providers)
    setActiveProviderRef(loadedActiveProviderRef)
    setHasApiKey(Boolean(loaded.apiKeyRef && loadedActiveProviderRef))
  }, [])

  // Load config on mount
  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  // Prompt listener for agentic mode
  useEffect(() => {
    return window.api.terminal.onPrompt(({ sessionId }) => {
      promptResolversRef.current.get(sessionId)?.()
      promptResolversRef.current.delete(sessionId)
    })
  }, [])

  const resolveCommandConfirmation = useCallback((sessionId: string, confirmed: boolean, commandOverride?: string) => {
    const resolve = commandConfirmationResolversRef.current.get(sessionId)
    const confirmedCommand = (commandOverride ?? threadsRef.current[sessionId]?.commandConfirmation?.command ?? '').trim()
    commandConfirmationResolversRef.current.delete(sessionId)
    updateThread(sessionId, (thread) => ({ ...thread, commandConfirmation: null }))
    resolve?.(confirmed && confirmedCommand ? confirmedCommand : false)
  }, [updateThread])

  const requestCommandConfirmation = useCallback((sessionId: string, confirmation: CommandConfirmationRequest): Promise<CommandConfirmationResult> => {
    commandConfirmationResolversRef.current.get(sessionId)?.(false)

    return new Promise((resolve) => {
      commandConfirmationResolversRef.current.set(sessionId, resolve)
      updateThread(sessionId, (thread) => ({ ...thread, commandConfirmation: { ...confirmation, sessionId } }))
    })
  }, [updateThread])

  const updateCommandConfirmationCommand = useCallback((sessionId: string, command: string) => {
    updateThread(sessionId, (thread) => {
      if (!thread.commandConfirmation) return thread
      return {
        ...thread,
        commandConfirmation: { ...thread.commandConfirmation, command }
      }
    })
  }, [updateThread])

  useEffect(() => {
    if (!commandConfirmation) return undefined

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        resolveCommandConfirmation(commandConfirmation.sessionId, false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commandConfirmation, resolveCommandConfirmation])

  const appendCommandEditNotice = useCallback((sessionId: string, originalCommand: string, finalCommand: string) => {
    if (originalCommand.trim() === finalCommand.trim()) return
    updateThread(sessionId, (thread) => ({
      ...thread,
      messages: [
        ...thread.messages,
        {
          role: 'assistant',
          content: `Command edited before run.\nOriginal:\n${originalCommand.trim()}\nRun:\n${finalCommand.trim()}`,
          display: 'system-status',
          command: finalCommand.trim(),
          output: originalCommand.trim()
        }
      ]
    }))
  }, [updateThread])

  // Core chat stream: starts a new exchange given user message content
  const startStream = useCallback((
    sessionId: string,
    userContent: string,
    currentMessages: ThreadMessage[],
    userMeta?: Pick<ThreadMessage, 'display' | 'command' | 'output'>
  ) => {
    const requestId = crypto.randomUUID()
    const thread = getThread(sessionId)
    const session = thread.session ?? (activeSessionRef.current?.id === sessionId ? summarizeSession(activeSessionRef.current) : undefined)
    const nextMessages: ThreadMessage[] = [
      ...currentMessages,
      { role: 'user', content: userContent, ...userMeta },
      { role: 'assistant', content: '' }
    ]
    requestSessionRef.current.set(requestId, sessionId)
    updateThread(sessionId, (thread) => ({
      ...thread,
      messages: nextMessages,
      streaming: true,
      activeRequestId: requestId,
      streamingContent: '',
      status: null,
      session
    }))

    const mode = assistModeRef.current
    const terminalOutput = mode !== 'off' ? getOutputForSessionRef.current(sessionId) : undefined

    window.api.llm.chatStream({
      requestId,
      provider: providerRef.current,
      messages: nextMessages.slice(0, -1).map(toChatMessage),
      context: {
        selectedText: selectedTextRef.current,
        assistMode: mode,
        terminalOutput: terminalOutput || undefined,
        language: languageRef.current,
        session
      }
    })
    autoSaveThreadToHistory(sessionId)
  }, [autoSaveThreadToHistory, getThread, summarizeSession, updateThread])

  useEffect(() => {
    if (!blockPromptRequest || handledBlockPromptRequestRef.current === blockPromptRequest.id) return
    handledBlockPromptRequestRef.current = blockPromptRequest.id

    const thread = getThread(blockPromptRequest.sessionId)
    if (thread.streaming || thread.agenticCommandRunning || thread.commandConfirmation) {
      updateThread(blockPromptRequest.sessionId, (thread) => ({
        ...thread,
        draft: blockPromptRequest.prompt,
        status: { tone: 'warning', label: t('status.blockPromptQueued') }
      }))
      return
    }

    startStream(blockPromptRequest.sessionId, blockPromptRequest.prompt, thread.messages)
  }, [blockPromptRequest, getThread, startStream, t, updateThread])

  const startAssistantStream = useCallback((sessionId: string, currentMessages: ThreadMessage[]) => {
    const requestId = crypto.randomUUID()
    const thread = getThread(sessionId)
    const session = thread.session ?? (activeSessionRef.current?.id === sessionId ? summarizeSession(activeSessionRef.current) : undefined)
    const nextMessages: ThreadMessage[] = [
      ...currentMessages,
      { role: 'assistant', content: '' }
    ]
    requestSessionRef.current.set(requestId, sessionId)
    updateThread(sessionId, (thread) => ({
      ...thread,
      messages: nextMessages,
      streaming: true,
      activeRequestId: requestId,
      streamingContent: '',
      status: null,
      agenticPending: null,
      session
    }))

    const mode = assistModeRef.current
    const terminalOutput = mode !== 'off' ? getOutputForSessionRef.current(sessionId) : undefined

    window.api.llm.chatStream({
      requestId,
      provider: providerRef.current,
      messages: currentMessages.map(toChatMessage),
      context: {
        selectedText: selectedTextRef.current,
        assistMode: mode,
        terminalOutput: terminalOutput || undefined,
        language: languageRef.current,
        session
      }
    })
    autoSaveThreadToHistory(sessionId)
  }, [autoSaveThreadToHistory, getThread, summarizeSession, updateThread])

  // Stream event handler
  const runAgenticStepRef = useRef<(sessionId: string, content: string) => Promise<void>>(async () => {})

  useEffect(() => {
    return window.api.llm.onChatStreamEvent((event: ChatStreamEvent) => {
      const sessionId = requestSessionRef.current.get(event.requestId)
      if (!sessionId) return

      if (event.type === 'chunk') {
        updateThread(sessionId, (thread) => {
          if (thread.activeRequestId !== event.requestId) return thread
          const next = [...thread.messages]
          const last = next.at(-1)
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + event.content }
          }
          return {
            ...thread,
            messages: next,
            streamingContent: thread.streamingContent + event.content,
            status: null
          }
        })
      }

      if (event.type === 'reasoning') {
        updateThread(sessionId, (thread) => {
          if (thread.activeRequestId !== event.requestId) return thread
          const next = [...thread.messages]
          const last = next.at(-1)
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              reasoningContent: `${last.reasoningContent ?? ''}${event.content}`
            }
          }
          return {
            ...thread,
            messages: next,
            status: null
          }
        })
      }

      if (event.type === 'progress') {
        const percent = progressPercent(event.progress)
        updateThread(sessionId, (thread) => {
          if (thread.activeRequestId !== event.requestId) return thread
          return {
            ...thread,
            status: {
              tone: 'info',
              label: event.stage === 'model_load'
                ? t('status.modelLoading', { percent })
                : t('status.promptProcessing', { percent })
            }
          }
        })
      }

      if (event.type === 'error') {
        requestSessionRef.current.delete(event.requestId)
        promptResolversRef.current.delete(sessionId)
        updateThread(sessionId, (thread) => ({
          ...thread,
          status: { tone: 'danger', label: event.message },
          streaming: false,
          activeRequestId: undefined,
          streamingContent: '',
          agenticPending: null,
          agenticRunning: false,
          agenticCommandRunning: false,
          agenticStep: 0,
          agenticCommand: ''
        }))
      }

      if (event.type === 'done') {
        const doneThread = getThread(sessionId)
        const agenticContent =
          doneThread.activeRequestId === event.requestId && doneThread.agenticRunning
            ? doneThread.streamingContent
            : null
        requestSessionRef.current.delete(event.requestId)
        updateThread(sessionId, (thread) => {
          if (thread.activeRequestId !== event.requestId) return thread
          return {
            ...thread,
            streaming: false,
            status: null,
            activeRequestId: undefined,
            agenticPending: agenticContent,
            streamingContent: ''
          }
        })
        if (agenticContent) {
          void runAgenticStepRef.current(sessionId, agenticContent)
        }
        autoSaveThreadToHistory(sessionId)
      }
    })
  }, [autoSaveThreadToHistory, getThread, t, updateThread])

  // Auto-scroll
  useEffect(() => {
    const log = chatLogRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [agenticCommandRunning, agenticStep, commandConfirmation, messages, status, streaming])

  // Stop agentic
  const stopAgentic = useCallback((sessionId: string) => {
    commandConfirmationResolversRef.current.get(sessionId)?.(false)
    commandConfirmationResolversRef.current.delete(sessionId)
    promptResolversRef.current.get(sessionId)?.()
    promptResolversRef.current.delete(sessionId)
    runningCommandsRef.current.delete(sessionId)
    const thread = getThread(sessionId)
    const activeRequestId = thread.activeRequestId
    if (activeRequestId) requestSessionRef.current.delete(activeRequestId)
    updateThread(sessionId, (thread) => ({
      ...thread,
      commandConfirmation: null,
      streaming: false,
      activeRequestId: undefined,
      streamingContent: '',
      agenticPending: null,
      agenticRunning: false,
      agenticCommandRunning: false,
      agenticStep: 0,
      agenticCommand: ''
    }))
    if (activeRequestId) {
      const cancelChatStream = window.api.llm.cancelChatStream
      void cancelChatStream?.(activeRequestId).catch((error: unknown) => {
        console.error('Failed to cancel chat stream', error)
      })
    }
  }, [getThread, updateThread])

  const clearHistory = useCallback(() => {
    if (!activeSessionId) return
    stopAgentic(activeSessionId)
    updateThread(activeSessionId, (thread) => ({
      ...createThread(),
      draft: thread.draft,
      session: thread.session
    }))
  }, [activeSessionId, stopAgentic, updateThread])

  const loadHistoryChats = useCallback(async () => {
    const chats = await window.api.chatHistory.list()
    setHistoryChats(chats)
  }, [])

  const toggleHistory = useCallback(() => {
    if (historyOpen) {
      setHistoryOpen(false)
      setHistorySearch('')
    } else {
      setPromptPickerOpen(false)
      void loadHistoryChats().then(() => setHistoryOpen(true))
    }
  }, [historyOpen, loadHistoryChats])

  useEffect(() => {
    if (!promptPickerOpen) return
    void window.api.prompt.list().then(setPromptPickerPrompts).catch(() => setPromptPickerPrompts([]))
    requestAnimationFrame(() => promptPickerSearchRef.current?.focus())
  }, [promptPickerOpen])

  useEffect(() => {
    setPromptPickerActiveIndex(0)
  }, [promptPickerQuery])

  useEffect(() => {
    if (!promptPickerListRef.current) return
    const active = promptPickerListRef.current.querySelector('.prompt-picker-item.active')
    if (active) active.scrollIntoView({ block: 'nearest' })
  }, [promptPickerActiveIndex])

  const promptPickerFiltered = useMemo(() => {
    const q = promptPickerQuery.trim().toLowerCase()
    if (!q) return promptPickerPrompts
    return promptPickerPrompts.filter((p) =>
      p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    )
  }, [promptPickerPrompts, promptPickerQuery])

  const togglePromptPicker = useCallback(() => {
    if (promptPickerOpen) {
      setPromptPickerOpen(false)
      setPromptPickerQuery('')
    } else {
      setHistoryOpen(false)
      setPromptPickerOpen(true)
    }
  }, [promptPickerOpen])

  const closePromptPicker = useCallback(() => {
    setPromptPickerOpen(false)
    setPromptPickerQuery('')
  }, [])

  const openAddPrompt = useCallback(() => {
    closePromptPicker()
    setSettingsTab('prompts')
    onOpenSettings()
  }, [closePromptPicker, onOpenSettings])

  useEffect(() => {
    if (promptLibraryRequestVersion === 0) return
    setHistoryOpen(false)
    setPromptPickerOpen(true)
  }, [promptLibraryRequestVersion])

  const handleDeleteHistoryChat = useCallback((chatId: string) => {
    const chat = historyChats.find((candidate) => candidate.id === chatId)
    setDeleteConfirmation({
      title: withObjectName(t('chat.historyDeleteConfirmTitle'), chat?.title),
      message: t('chat.historyDeleteConfirmMessage'),
      confirmLabel: t('chat.historyDeleteConfirmBtn'),
      onConfirm: async () => {
        await window.api.chatHistory.delete(chatId)
        setHistoryChats((prev) => prev.filter((c) => c.id !== chatId))
      }
    })
  }, [historyChats, t])

  const handleReopenChat = useCallback((chatId: string) => {
    setHistoryOpen(false)
    setHistorySearch('')
    onReopenChat(chatId)
  }, [onReopenChat])

  const filteredHistoryChats = useMemo(() => {
    if (!historySearch.trim()) return historyChats
    const query = historySearch.toLowerCase()
    return historyChats.filter((chat) => chat.title.toLowerCase().includes(query))
  }, [historyChats, historySearch])

  const openSavePromptDialog = async (): Promise<void> => {
    const requestId = crypto.randomUUID()
    savePromptGenerationRequestIdRef.current = requestId
    setSavePromptDialog({ content: '' })
    setSavePromptName('')
    setSavePromptStatus('idle')
    setSavePromptDuplicateName(false)
    try {
      const prompt = await window.api.llm.summarizeConversation({
        requestId,
        provider: providerRef.current,
        messages: messages.map(toChatMessage),
        language: languageRef.current
      })
      if (savePromptGenerationRequestIdRef.current !== requestId) return
      savePromptGenerationRequestIdRef.current = null
      setSavePromptName(prompt.name)
      setSavePromptDialog(prompt)
    } catch (err) {
      if (savePromptGenerationRequestIdRef.current !== requestId) return
      savePromptGenerationRequestIdRef.current = null
      setSavePromptDialog(null)
      if (activeSessionId) {
        updateThread(activeSessionId, (thread) => ({
          ...thread,
          status: statusToInlineStatus(err instanceof Error ? err.message : String(err))
        }))
      }
    }
  }

  const closeSavePromptDialog = useCallback((): void => {
    const requestId = savePromptGenerationRequestIdRef.current
    savePromptGenerationRequestIdRef.current = null
    if (requestId) void window.api.llm.cancelSummarizeConversation(requestId)
    setSavePromptDialog(null)
    setSavePromptDuplicateName(false)
  }, [])

  const handleSavePromptFromChat = async (): Promise<void> => {
    if (!savePromptName.trim() || savePromptDuplicateName) return
    setSavePromptStatus('saving')
    try {
      await window.api.prompt.save({ id: '', name: savePromptName.trim(), content: savePromptDialog!.content, createdAt: '' })
      setSavePromptStatus('saved')
      setTimeout(() => setSavePromptDialog(null), 800)
    } catch {
      setSavePromptStatus('error')
    }
  }

  useEffect(() => {
    if (!savePromptDialog || savePromptDialog.content === '') {
      setSavePromptDuplicateName(false)
      return
    }

    const name = normalizeLibraryName(savePromptName)
    if (!name) {
      setSavePromptDuplicateName(false)
      return
    }

    let cancelled = false
    void window.api.prompt.list().then((prompts) => {
      if (cancelled) return
      setSavePromptDuplicateName(prompts.some((prompt) => normalizeLibraryName(prompt.name) === name))
    }).catch(() => {
      if (!cancelled) setSavePromptDuplicateName(false)
    })

    return () => { cancelled = true }
  }, [savePromptDialog, savePromptName])

  const buildTerminalContext = useCallback((sessionId: string): TerminalContext => {
    const thread = getThread(sessionId)
    const session = thread.session ?? (activeSessionRef.current?.id === sessionId ? summarizeSession(activeSessionRef.current) : undefined)
    const terminalOutput = stripAnsi(getOutputForSessionRef.current(sessionId)).slice(-maxOutputContextRef.current)

    return {
      selectedText: selectedTextRef.current,
      assistMode: 'agent',
      terminalOutput: terminalOutput || undefined,
      language: languageRef.current,
      session
    }
  }, [getThread, summarizeSession])

  const confirmAgenticCommand = useCallback(async (sessionId: string, command: string): Promise<CommandConfirmationResult> => {
    updateThread(sessionId, (thread) => ({ ...thread, status: { tone: 'info', label: t('status.checkingSafety') } }))

    try {
      const assessment = await window.api.llm.assessCommandRisk({
        provider: providerRef.current,
        command,
        context: buildTerminalContext(sessionId)
      })

      if (!assessment.dangerous) {
        updateThread(sessionId, (thread) => ({ ...thread, status: null }))
        return command
      }

      updateThread(sessionId, (thread) => ({ ...thread, status: null }))
      const confirmed = await requestCommandConfirmation(sessionId, {
        title: t('confirm.reviewRisky'),
        reason: assessment.reason,
        command,
        tone: 'danger',
        confirmLabel: t('confirm.runCommand')
      })

      if (!confirmed) {
        updateThread(sessionId, (thread) => ({ ...thread, status: { tone: 'warning', label: t('status.agentStopped.riskyCommand') } }))
        stopAgentic(sessionId)
        return false
      }

      updateThread(sessionId, (thread) => ({ ...thread, status: { tone: 'warning', label: t('status.riskyCommandConfirmed') } }))
      return confirmed
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      updateThread(sessionId, (thread) => ({ ...thread, status: null }))
      const confirmed = await requestCommandConfirmation(sessionId, {
        title: t('confirm.safetyUnavailable'),
        reason: message,
        command,
        tone: 'warning',
        confirmLabel: t('confirm.runAnyway')
      })

      if (!confirmed) {
        updateThread(sessionId, (thread) => ({ ...thread, status: { tone: 'warning', label: t('status.agentStopped.safetyUnchecked') } }))
        stopAgentic(sessionId)
        return false
      }

      updateThread(sessionId, (thread) => ({ ...thread, status: { tone: 'warning', label: t('status.safetyFailedConfirmed') } }))
      return confirmed
    }
  }, [buildTerminalContext, requestCommandConfirmation, stopAgentic, t, updateThread])

  // Agentic step runner (ref-based to avoid stale closures)
  const runAgenticStep = useCallback(async (sessionId: string, content: string) => {
    if (!getThread(sessionId).agenticRunning) return

    const proposedCommand = extractFirstCommand(content)
    if (!proposedCommand) {
      stopAgentic(sessionId)
      return
    }

    const session = getThread(sessionId).session
    if (!session) {
      stopAgentic(sessionId)
      return
    }

    if (runningCommandsRef.current.has(sessionId) || getThread(sessionId).agenticCommandRunning) {
      updateThread(sessionId, (thread) => ({
        ...thread,
        status: { tone: 'info', label: t('status.commandAlreadyRunning') }
      }))
      return
    }

    const nextStep = getThread(sessionId).agenticStep + 1
    if (nextStep > 10) {
      updateThread(sessionId, (thread) => ({ ...thread, status: { tone: 'info', label: t('status.agentStopped.tenSteps') } }))
      stopAgentic(sessionId)
      return
    }

    updateThread(sessionId, (thread) => ({
      ...thread,
      agenticPending: null,
      agenticCommandRunning: true,
      agenticStep: nextStep,
      agenticCommand: proposedCommand
    }))

    const command = await confirmAgenticCommand(sessionId, proposedCommand)
    if (!command || !getThread(sessionId).agenticRunning) return
    appendCommandEditNotice(sessionId, proposedCommand, command)
    updateThread(sessionId, (thread) => ({ ...thread, agenticCommand: command }))

    const beforeOutput = getOutputForSessionRef.current(sessionId)

    // Wait for the shell prompt that is emitted after the command finishes.
    let finishPromptWait = (): void => {}
    const promptPromise = new Promise<void>((resolve) => {
      const finish = (): void => {
        promptResolversRef.current.delete(sessionId)
        resolve()
      }
      finishPromptWait = finish
      promptResolversRef.current.set(sessionId, finish)
    })

    runningCommandsRef.current.add(sessionId)
    void window.api.command.runConfirmed(session.id, command).catch((error: unknown) => {
      updateThread(sessionId, (thread) => ({ ...thread, status: { tone: 'danger', label: `Command failed: ${error instanceof Error ? error.message : String(error)}` } }))
      stopAgentic(sessionId)
      finishPromptWait()
    })

    await promptPromise

    if (!getThread(sessionId).agenticRunning) return

    runningCommandsRef.current.delete(sessionId)
    const afterOutput = getOutputForSessionRef.current(sessionId)
    const output = cleanCommandOutput(command, getTerminalDelta(beforeOutput, afterOutput)).slice(-maxOutputContextRef.current)
    updateThread(sessionId, (thread) => ({ ...thread, agenticCommandRunning: false }))
    const continuation =
      `Command \`${command}\` finished.\nOutput:\n\`\`\`\n${output}\n\`\`\`\nContinue.`

    startStream(sessionId, continuation, getThread(sessionId).messages, {
      display: 'command-output',
      command,
      output
    })
  }, [appendCommandEditNotice, confirmAgenticCommand, getThread, stopAgentic, startStream, t, updateThread])

  // Keep ref updated
  useEffect(() => { runAgenticStepRef.current = runAgenticStep }, [runAgenticStep])

  // Send user message
  const sendMessage = useCallback(() => {
    const session = activeSessionRef.current
    if (!session) return
    const sessionId = session.id
    const thread = getThread(sessionId)
    const content = draft.trim()
    if (!content || streaming || commandConfirmation) return
    if (thread.agenticCommandRunning || runningCommandsRef.current.has(sessionId)) {
      updateThread(sessionId, (thread) => ({
        ...thread,
        status: { tone: 'info', label: t('status.commandAlreadyRunning') }
      }))
      return
    }

    const canExecute = session.status === 'running'
    if (assistModeRef.current === 'agent' && canExecute) {
      promptResolversRef.current.delete(sessionId)
      updateThread(sessionId, (thread) => ({
        ...thread,
        agenticRunning: true,
        agenticCommandRunning: false,
        agenticStep: 0,
        agenticCommand: '',
        agenticPending: null,
        status: null,
        session: summarizeSession(session)
      }))
    }

    updateThread(sessionId, (thread) => ({
      ...thread,
      draft: '',
      session: summarizeSession(session),
      status: assistModeRef.current === 'agent' && !canExecute
        ? { tone: 'info', label: t('status.disconnected.run') }
        : thread.status
    }))
    startStream(sessionId, content, thread.messages)
  }, [commandConfirmation, draft, getThread, streaming, startStream, summarizeSession, t, updateThread])

  const regenerateMessage = useCallback((messageIndex: number) => {
    const session = activeSessionRef.current
    if (!session || streaming || commandConfirmation) return
    const sessionId = session.id
    const thread = getThread(sessionId)
    if (thread.agenticCommandRunning || runningCommandsRef.current.has(sessionId)) return
    const message = thread.messages[messageIndex]
    if (!message || message.role !== 'assistant') return

    const baseMessages = thread.messages.slice(0, messageIndex)
    if (baseMessages.length === 0) return

    updateThread(sessionId, (thread) => ({
      ...thread,
      messages: baseMessages,
      agenticRunning: false,
      agenticCommandRunning: false,
      agenticStep: 0,
      agenticCommand: '',
      agenticPending: null,
      status: null,
      savedChatId: undefined,
      session: summarizeSession(session)
    }))
    startAssistantStream(sessionId, baseMessages)
  }, [commandConfirmation, getThread, startAssistantStream, streaming, summarizeSession, updateThread])

  const forkChatFromMessage = useCallback((messageIndex: number) => {
    const session = activeSessionRef.current
    if (!session || streaming || commandConfirmation) return
    const sessionId = session.id
    const thread = getThread(sessionId)
    if (thread.agenticCommandRunning || runningCommandsRef.current.has(sessionId)) return
    if (!thread.messages[messageIndex]) return

    saveThreadSnapshotToHistory(thread)
    const forkedMessages = thread.messages.slice(0, messageIndex + 1)
    updateThread(sessionId, (thread) => ({
      ...thread,
      messages: forkedMessages,
      activeRequestId: undefined,
      streaming: false,
      streamingContent: '',
      agenticPending: null,
      agenticRunning: false,
      agenticCommandRunning: false,
      agenticStep: 0,
      agenticCommand: '',
      commandConfirmation: null,
      savedChatId: undefined,
      status: { tone: 'info', label: t('chat.forked') },
      session: summarizeSession(session)
    }))
  }, [commandConfirmation, getThread, saveThreadSnapshotToHistory, streaming, summarizeSession, t, updateThread])

  // Run command inline from MessageContent
  const runCommand = useCallback(async (command: string) => {
    const session = activeSessionRef.current
    if (!session || session.status !== 'running') {
      if (activeSessionId) {
        updateThread(activeSessionId, (thread) => ({
          ...thread,
          status: { tone: 'info', label: session ? t('status.disconnected.run') : t('status.noSession.run') }
        }))
      }
      return
    }

    if (runningCommandsRef.current.has(session.id) || getThread(session.id).agenticCommandRunning) {
      updateThread(session.id, (thread) => ({
        ...thread,
        status: { tone: 'info', label: t('status.commandAlreadyRunning') }
      }))
      return
    }

    const confirmedCommand = await confirmAgenticCommand(session.id, command)
    if (!confirmedCommand) return
    appendCommandEditNotice(session.id, command, confirmedCommand)

    runningCommandsRef.current.add(session.id)
    updateThread(session.id, (thread) => ({
      ...thread,
      agenticCommandRunning: true,
      agenticCommand: confirmedCommand,
      status: null
    }))

    let finishPromptWait = (): void => {}
    const promptPromise = new Promise<void>((resolve) => {
      const finish = (): void => {
        promptResolversRef.current.delete(session.id)
        resolve()
      }
      finishPromptWait = finish
      promptResolversRef.current.set(session.id, finish)
    })

    void window.api.command.runConfirmed(session.id, confirmedCommand).catch((error: unknown) => {
      updateThread(session.id, (thread) => ({
        ...thread,
        status: { tone: 'danger', label: `Command failed: ${error instanceof Error ? error.message : String(error)}` }
      }))
      finishPromptWait()
    })

    await promptPromise
    runningCommandsRef.current.delete(session.id)
    updateThread(session.id, (thread) => ({
      ...thread,
      agenticCommandRunning: false,
      agenticCommand: ''
    }))
  }, [activeSessionId, appendCommandEditNotice, confirmAgenticCommand, getThread, t, updateThread])

  // Save provider
  const saveProvider = useCallback(async () => {
    if (!isValidProviderBaseUrl(provider.baseUrl)) {
      setProviderStatus('Enter a valid http:// or https:// Base URL')
      return
    }
    setProviderStatus('Saving...')
    try {
      const result = await window.api.llm.saveProvider({ provider, apiKey })
      setAllProviders(result.providers)
      setActiveProviderRef(result.activeProviderRef ?? provider.apiKeyRef)
      setApiKey('')
      setEditingApiKey(false)
      if (apiKey) setHasApiKey(true)
      setProviderStatus(t('status.saved'))
    } catch (error) {
      setProviderStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [apiKey, provider, t])

  const switchProvider = useCallback((target: LLMProviderConfig) => {
    setProvider(target)
    setModels([])
    setEditingApiKey(false)
    setHasApiKey(Boolean(target.apiKeyRef))
    setProviderStatus('')
    setActiveProviderRef(target.apiKeyRef)
    void window.api.llm.saveProvider({ provider: target }).then((result) => {
      setAllProviders(result.providers)
      setActiveProviderRef(result.activeProviderRef ?? target.apiKeyRef)
    }).catch((err: unknown) => {
      setProviderStatus(`Switch failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  }, [])

  const addProvider = useCallback(() => {
    setProvider({
      name: providerTypeDefaults.openai.name,
      providerType: 'openai',
      baseUrl: providerTypeDefaults.openai.baseUrl,
      apiKeyRef: `provider-${crypto.randomUUID()}`,
      selectedModel: '',
      commandRiskModel: ''
    })
    setModels([])
    setApiKey('')
    setEditingApiKey(false)
    setHasApiKey(false)
  }, [])

  const handleDeleteProvider = useCallback((apiKeyRef: string) => {
    const target = allProviders.find((candidate) => candidate.apiKeyRef === apiKeyRef)
    setDeleteConfirmation({
      title: withObjectName(t('providers.deleteConfirmTitle'), target?.name),
      message: t('providers.deleteConfirmMessage'),
      confirmLabel: t('providers.deleteConfirmBtn'),
      onConfirm: async () => {
        try {
          const result = await window.api.llm.deleteProvider(apiKeyRef)
          setAllProviders(result.providers)
          setActiveProviderRef(result.activeProviderRef ?? result.providers[0]?.apiKeyRef ?? defaultProvider.apiKeyRef)
          if (provider.apiKeyRef === apiKeyRef) {
            const next = result.providers[0] ?? defaultProvider
            setProvider(next)
            setModels([])
          }
        } catch (error) {
          setProviderStatus(`Delete failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    })
  }, [allProviders, provider.apiKeyRef, t])

  const loadSshProfiles = useCallback(async () => {
    const profiles = await window.api.ssh.listProfiles()
    setSshProfiles(profiles)
    if (profiles.length > 0 && !sshProfile) {
      setSshProfile(profiles[0])
    }
  }, [sshProfile])

  useEffect(() => {
    void loadSshProfiles()
  }, [loadSshProfiles])

  const addSshProfile = useCallback(() => {
    const newProfile: SSHProfileConfig = {
      id: `ssh-${crypto.randomUUID()}`,
      name: '',
      host: ''
    }
    setSshProfile(newProfile)
  }, [])

  const saveSshProfile = useCallback(async () => {
    if (!sshProfile) return
    if (!isValidSshPort(sshProfile.port)) return
    const result = await window.api.ssh.saveProfile(sshProfile)
    setSshProfiles(result.sshProfiles ?? [])
  }, [sshProfile])

  const commitSshPort = useCallback(() => {
    setSshProfile((profile) => profile ? { ...profile, port: clampSshPort(profile.port) } : profile)
  }, [])

  const chooseSshIdentityFile = useCallback(async () => {
    const filePath = await window.api.ssh.chooseIdentityFile()
    if (!filePath) return
    setSshProfile((profile) => profile ? { ...profile, identityFile: filePath } : profile)
  }, [])

  const deleteSshProfile = useCallback((id: string) => {
    const target = sshProfiles.find((candidate) => candidate.id === id)
    setDeleteConfirmation({
      title: withObjectName(t('connections.deleteConfirmTitle'), target?.name || target?.host),
      message: t('connections.deleteConfirmMessage'),
      confirmLabel: t('connections.deleteConfirmBtn'),
      onConfirm: async () => {
        await window.api.ssh.deleteProfile(id)
        setSshProfiles((prev) => prev.filter((p) => p.id !== id))
        if (sshProfile?.id === id) {
          setSshProfile(null)
        }
      }
    })
  }, [sshProfile, sshProfiles, t])

  const connectSshProfile = useCallback((profile: SSHProfileConfig) => {
    onConnectSsh(profile)
    onCloseSettings()
  }, [onConnectSsh, onCloseSettings])

  // Load models
  const loadModels = useCallback(async () => {
    if (loadingModelsRef.current) return
    loadingModelsRef.current = true
    setProviderStatus('Loading models...')
    try {
      const loaded = await window.api.llm.listModels({ provider, apiKey })
      setModels(loaded)
      setApiKey('')
      setProviderStatus(`${loaded.length} models loaded`)
    } catch (error) {
      setProviderStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      loadingModelsRef.current = false
    }
  }, [apiKey, provider])

  const updateProvider = useCallback((updated: LLMProviderConfig) => {
    setProvider(updated)
    setAllProviders((providers) => upsertProviderInOrder(providers, updated))
    void window.api.llm.saveProvider({ provider: updated }).then((result) => {
      setAllProviders(result.providers)
      setActiveProviderRef(result.activeProviderRef ?? updated.apiKeyRef)
    }).catch((err: unknown) => {
      setProviderStatus(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  }, [])

  const handleTextSizeChange = useCallback((value: string) => {
    setTextSizeDraft(value)

    const parsed = Number(value)
    if (isValidTextSize(value)) {
      onTextSizeChange(parsed)
    }
  }, [onTextSizeChange])

  const commitTextSizeDraft = useCallback(() => {
    const nextTextSize = clampTextSize(textSizeDraft, textSize)
    setTextSizeDraft(String(nextTextSize))
    onTextSizeChange(nextTextSize)
  }, [onTextSizeChange, textSize, textSizeDraft])

  const handleMaxOutputContextChange = useCallback((value: string) => {
    setMaxOutputContextDraft(value)

    const parsed = parseInt(value, 10)
    if (isValidOutputContext(value)) {
      onMaxOutputContextChange(parsed)
    }
  }, [onMaxOutputContextChange])

  const commitMaxOutputContextDraft = useCallback(() => {
    const nextMaxOutputContext = clampOutputContext(maxOutputContextDraft, maxOutputContext)
    setMaxOutputContextDraft(String(nextMaxOutputContext))
    onMaxOutputContextChange(nextMaxOutputContext)
  }, [maxOutputContext, maxOutputContextDraft, onMaxOutputContextChange])

  const handleExport = useCallback(async () => {
    setDataStatus('Exporting...')
    try {
      await window.api.data.export({ textSize, sidebarWidth, language, themeId })
      setDataStatus('Export complete')
      setTimeout(() => setDataStatus(''), 3000)
    } catch (error) {
      setDataStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [sidebarWidth, textSize, language, themeId])

  const handleImport = useCallback(async () => {
    setDataStatus('Importing...')
    try {
      const result = await window.api.data.import()
      if (!result) {
        setDataStatus('')
        return
      }

      if (result.preferences?.textSize) onTextSizeChange(result.preferences.textSize)
      if (result.preferences?.sidebarWidth) onSidebarWidthChange(result.preferences.sidebarWidth)
      if (result.preferences?.language) onLanguageChange(result.preferences.language as Language)
      if (result.preferences?.themeId) onThemeChange(result.preferences.themeId)

      await loadConfig()

      const parts: string[] = []
      if (result.providersAdded) parts.push(`${result.providersAdded} provider(s)`)
      if (result.promptsAdded) parts.push(`${result.promptsAdded} prompt(s)`)
      if (result.commandSnippetsAdded) parts.push(`${result.commandSnippetsAdded} command snippet(s)`)
      setDataStatus(parts.length ? `Added: ${parts.join(', ')}` : 'Nothing new to import')
      setTimeout(() => setDataStatus(''), 4000)
    } catch (error) {
      setDataStatus(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [loadConfig, onSidebarWidthChange, onTextSizeChange, onLanguageChange, onThemeChange])

  const handleClearSavedSessionState = useCallback(() => {
    setDeleteConfirmation({
      title: t('data.clearSessionsConfirmTitle'),
      message: t('data.clearSessionsConfirmMessage'),
      confirmLabel: t('data.clearSessionsConfirmBtn'),
      onConfirm: async () => {
        setDataStatus('Clearing saved session...')
        try {
          await onClearSavedSessionState()
          setDataStatus('Saved session cleared')
          setTimeout(() => setDataStatus(''), 3000)
        } catch (error) {
          setDataStatus(`Clear failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    })
  }, [onClearSavedSessionState, t])

  const handleClearChatHistory = useCallback(() => {
    setDeleteConfirmation({
      title: t('data.clearChatHistoryConfirmTitle'),
      message: t('data.clearChatHistoryConfirmMessage'),
      confirmLabel: t('data.clearChatHistoryConfirmBtn'),
      onConfirm: async () => {
        await window.api.chatHistory.clear()
        setHistoryChats([])
        setDataStatus(t('data.clearChatHistory.done'))
        setTimeout(() => setDataStatus(''), 2000)
      }
    })
  }, [t])

  const confirmDeleteAction = useCallback(async () => {
    const confirmation = deleteConfirmation
    if (!confirmation) return
    setDeleteConfirmation(null)
    await confirmation.onConfirm()
  }, [deleteConfirmation])

  const setPromptDraft = useCallback((prompt: string) => {
    if (activeSessionId) {
      updateThread(activeSessionId, (thread) => ({ ...thread, draft: prompt }))
    }
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [activeSessionId, updateThread])

  const handlePromptPickerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePromptPicker()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPromptPickerActiveIndex((prev) => Math.min(prev + 1, Math.max(promptPickerFiltered.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPromptPickerActiveIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (e.key === 'Enter' && promptPickerFiltered[promptPickerActiveIndex]) {
      e.preventDefault()
      setPromptDraft(promptPickerFiltered[promptPickerActiveIndex].content)
      closePromptPicker()
    }
  }, [closePromptPicker, promptPickerFiltered, promptPickerActiveIndex, setPromptDraft])

  const toggleAgentMode = useCallback(() => {
    setAssistMode((prev) => {
      const next: AssistMode = prev === 'agent' ? 'read' : 'agent'
      if (next !== 'agent') {
        for (const [sessionId, thread] of Object.entries(threadsRef.current)) {
          if (thread.agenticRunning) stopAgentic(sessionId)
        }
      }
      return next
    })
  }, [stopAgentic])

  const modelLabel = useMemo(() => formatModelLabel(provider.selectedModel), [provider.selectedModel])
  const strippedTerminalOutput = stripAnsi(getOutput()).slice(-2000)
  const suggestionChips = useMemo(() => buildSuggestionChips({
    terminalOutput: strippedTerminalOutput,
    cwd: activeSession?.cwd,
    selectedText,
    assistMode
  }).map((chip) => ({
    ...chip,
    label: t(`chip.${chip.id}` as Parameters<typeof t>[0]),
    prompt: t(`chip.${chip.id}Prompt` as Parameters<typeof t>[0])
  })), [activeSession?.cwd, assistMode, selectedText, strippedTerminalOutput, t])
  const inputDisabled = Boolean(commandConfirmation)
  const settingsNavItems = useMemo<Array<{ id: SettingsTab; label: string; terms: string[] }>>(() => [
    {
      id: 'appearance',
      label: t('settings.tab.appearance'),
      terms: [
        t('appearance.title'), t('appearance.theme.label'), t('appearance.theme.desc'),
        t('appearance.fontSize.label'), t('appearance.fontSize.desc'),
        t('appearance.language.label'), t('appearance.language.desc'),
        t('appearance.hideShortcut.label'), t('appearance.hideShortcut.desc'),
        'font size theme language shortcut hotkey appearance terminal'
      ]
    },
    {
      id: 'providers',
      label: t('settings.tab.providers'),
      terms: [
        t('providers.title'), t('providers.type'), t('providers.name'), t('providers.baseUrl'),
        t('providers.apiKey'), t('providers.allowInsecureTls'), t('providers.apiKey.saved'),
        t('providers.chatModel'), t('providers.safetyModel'), t('providers.fetchModels'),
        'openai ollama lm studio model api key base url tls provider safety'
      ]
    },
    {
      id: 'connections',
      label: t('settings.tab.connections'),
      terms: [
        t('connections.title'), t('connections.name'), t('connections.host'), t('connections.user'),
        t('connections.port'), t('connections.identityFile'), t('connections.browseIdentityFile'),
        t('connections.extraArgs'), t('connections.connect'),
        'ssh connection host user port identity file key pem rsa args'
      ]
    },
    {
      id: 'prompts',
      label: t('settings.tab.prompts'),
      terms: [
        t('prompts.title'), t('prompts.importFromFile'), t('prompts.addPrompt'),
        t('prompts.savePrompt'), t('prompts.namePlaceholder'), t('prompts.contentPlaceholder'),
        'prompt prompts template markdown import library'
      ]
    },
    {
      id: 'snippets',
      label: t('settings.tab.snippets'),
      terms: [
        t('snippets.title'), t('snippets.quickHint'), t('snippets.addSnippet'),
        t('snippets.saveSnippet'), t('snippets.namePlaceholder'), t('snippets.commandPlaceholder'),
        'snippet command terminal shell quick open run insert'
      ]
    },
    {
      id: 'data',
      label: t('settings.tab.data'),
      terms: [
        t('data.title'), t('appearance.outputContext.label'), t('appearance.outputContext.desc'),
        t('data.restoreSessions.label'), t('data.restoreSessions.desc'),
        t('data.exportImport.label'), t('data.exportImport.desc'),
        t('data.clearSessions.label'), t('data.clearSessions.desc'),
        t('data.clearChatHistory.label'), t('data.clearChatHistory.desc'),
        'data export import backup restore session state output context chars chat history clear'
      ]
    }
  ], [t])
  const filteredSettingsNavItems = useMemo(() => {
    if (!settingsSearch.trim()) return settingsNavItems
    return settingsNavItems.filter((item) =>
      matchesSearchQuery(settingsSearch, [item.label, ...item.terms])
    )
  }, [settingsNavItems, settingsSearch])
  const settingsMatchClass = useCallback((terms: Array<string | undefined>) => (
    matchesSearchQuery(settingsSearch, terms) ? 'settings-search-match' : ''
  ), [settingsSearch])
  const handleSettingsNavKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index
    if (event.key === 'ArrowDown') nextIndex = Math.min(index + 1, filteredSettingsNavItems.length - 1)
    else if (event.key === 'ArrowUp') nextIndex = Math.max(index - 1, 0)
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = filteredSettingsNavItems.length - 1
    else return

    event.preventDefault()
    const nextItem = filteredSettingsNavItems[nextIndex]
    if (!nextItem) return
    setSettingsTab(nextItem.id)
    const navItems = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.settings-nav-item')
    navItems?.[nextIndex]?.focus()
  }, [filteredSettingsNavItems])

  useEffect(() => {
    setSettingsTab(settingsTabRequest)
  }, [settingsTabRequest, settingsTabRequestVersion])

  useEffect(() => {
    if (settingsOpen && settingsTab === 'providers') {
      setProviderStatus('')
    }
  }, [settingsOpen, settingsTab])

  useEffect(() => {
    if (!settingsOpen) return

    const frameId = requestAnimationFrame(() => {
      settingsSearchRef.current?.focus()
    })

    return () => cancelAnimationFrame(frameId)
  }, [settingsOpen])

  useEffect(() => {
    const query = settingsSearch.trim().toLowerCase()
    if (!query) {
      lastAutoOpenedSettingsQueryRef.current = ''
      return
    }
    if (!settingsOpen || lastAutoOpenedSettingsQueryRef.current === query) return
    const firstMatch = filteredSettingsNavItems[0]
    if (firstMatch) {
      setSettingsTab(firstMatch.id)
      lastAutoOpenedSettingsQueryRef.current = query
    }
  }, [filteredSettingsNavItems, settingsOpen, settingsSearch])

  return (
    <aside className="llm-panel">
      <header className="panel-header">
        <div className="panel-header-row">
          <div className="panel-title">
            <button
              className="panel-icon icon-button"
              type="button"
              onClick={() => { setSettingsTab('providers'); onOpenSettings() }}
              title={t('settings.tab.providers')}
              aria-label={t('settings.tab.providers')}
            >
              <Bot size={15} aria-hidden />
            </button>
            <div className="panel-title-text">
              <h1 title={modelLabel.name}>{modelLabel.name}</h1>
              <p title={modelLabel.version || provider.name}>{modelLabel.version || provider.name}</p>
            </div>
          </div>
          <div className="panel-header-right">
            <div className="agent-toggle-group">
              <span>{t('panel.agent')}</span>
              <button
                className={`agent-toggle ${assistMode === 'agent' ? 'on' : ''}`}
                type="button"
                role="switch"
                aria-checked={assistMode === 'agent'}
                title={assistMode === 'agent' ? t('panel.agentToggle.disable') : t('panel.agentToggle.enable')}
                onClick={toggleAgentMode}
              >
                <span />
              </button>
            </div>
            <button
              className="icon-button panel-action-button"
              type="button"
              onClick={onOpenSettings}
              title={t('panel.settings')}
              aria-label={t('panel.settings')}
            >
              <Settings2 size={16} aria-hidden />
            </button>
            <button
              className="icon-button panel-action-button"
              type="button"
              onClick={toggleHistory}
              title={t('chat.history')}
              aria-label={t('chat.history')}
            >
              <History size={16} aria-hidden />
            </button>
            <button
              className="icon-button panel-action-button"
              type="button"
              onClick={() => void openSavePromptDialog()}
              disabled={messages.length === 0}
              title={t('chat.saveAsPrompt')}
              aria-label={t('chat.saveAsPrompt')}
            >
              <BookmarkPlus size={16} aria-hidden />
            </button>
            <button
              className="icon-button panel-action-button"
              type="button"
              onClick={clearHistory}
              title={t('panel.newChat')}
              aria-label={t('panel.newChat')}
            >
              <MessageSquarePlus size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className="permission-badges" aria-label="Assistant permissions">
          <span className={`permission-chip shell ${activeSession?.status ?? 'exited'}`}>
            <span className="permission-dot" />
            <span>{activeSession?.label ?? 'zsh'}</span>
          </span>
          <span className={`permission-chip ${assistMode !== 'off' ? 'read' : ''}`}>
            <span>{t('panel.permission.read')}</span>
          </span>
          <span className={`permission-chip ${assistMode === 'agent' ? 'execute' : ''}`}>
            <span>{t('panel.permission.execute')}</span>
          </span>
          {assistMode !== 'off' && activeSession?.status === 'running' && (
            <span className={`live-status-chip ${liveStatus}`} aria-live="polite" aria-label={t(`panel.status.${liveStatus}`)}>
              <span className="live-status-dot" aria-hidden />
              <span>{t(`panel.status.${liveStatus}`)}</span>
            </span>
          )}
        </div>
      </header>

      {settingsOpen ? createPortal(
        <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <section className="settings-screen">
            <header className="settings-header">
              <div className="settings-title">
                <Settings2 size={17} aria-hidden />
                <h2 id="settings-title">{t('settings.title')}</h2>
              </div>
              <button className="icon-button settings-close-button" type="button" onClick={onCloseSettings} title="Close settings" aria-label="Close settings">
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="settings-body">
              <nav className="settings-nav" aria-label="Settings sections">
                <label className="settings-search">
                  <Search size={13} aria-hidden />
                  <input
                    ref={settingsSearchRef}
                    type="text"
                    value={settingsSearch}
                    onChange={(event) => setSettingsSearch(event.target.value)}
                    placeholder={t('settings.search')}
                  />
                </label>
                {filteredSettingsNavItems.length > 0 ? filteredSettingsNavItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-nav-item ${settingsTab === item.id ? 'active' : ''}`}
                    onClick={() => setSettingsTab(item.id)}
                    onKeyDown={(event) => handleSettingsNavKeyDown(event, index)}
                  >
                    <HighlightSearchText text={item.label} query={settingsSearch} />
                  </button>
                )) : (
                  <p className="settings-nav-empty">{t('settings.search.empty')}</p>
                )}
              </nav>

              <div className="settings-content">
                {settingsTab === 'appearance' ? (
                  <>
                    <h3 className="settings-content-title">{t('appearance.title')}</h3>
                    <div className={`appearance-row ${settingsMatchClass([t('appearance.theme.label'), t('appearance.theme.desc'), 'theme color scheme ui terminal'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('appearance.theme.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc"><HighlightSearchText text={t('appearance.theme.desc')} query={settingsSearch} /></small>
                      </div>
                      <div className="appearance-row-right">
                        <select
                          className="language-select"
                          value={themeId}
                          onChange={(event) => onThemeChange(event.target.value)}
                        >
                          {themes.map((theme) => (
                            <option key={theme.id} value={theme.id}>{theme.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className={`appearance-row ${settingsMatchClass([t('appearance.fontSize.label'), t('appearance.fontSize.desc'), 'font size text terminal'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('appearance.fontSize.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc"><HighlightSearchText text={t('appearance.fontSize.desc')} query={settingsSearch} /></small>
                      </div>
                      <div className="appearance-row-right">
                        <input
                          className={`numeric-input ${!isValidTextSize(textSizeDraft) ? 'invalid-input' : ''}`}
                          type="number"
                          step="0.5"
                          min={MIN_TEXT_SIZE}
                          max={MAX_TEXT_SIZE}
                          inputMode="decimal"
                          value={textSizeDraft}
                          onChange={(event) => handleTextSizeChange(event.target.value)}
                          onBlur={commitTextSizeDraft}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className={`appearance-row ${settingsMatchClass([t('appearance.language.label'), t('appearance.language.desc'), t('appearance.language.en'), t('appearance.language.ru'), t('appearance.language.cn'), 'language locale translation'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('appearance.language.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc"><HighlightSearchText text={t('appearance.language.desc')} query={settingsSearch} /></small>
                      </div>
                      <div className="appearance-row-right">
                        <select
                          className="language-select"
                          value={language}
                          onChange={(event) => onLanguageChange(event.target.value as Language)}
                        >
                          <option value="en">{t('appearance.language.en')}</option>
                          <option value="ru">{t('appearance.language.ru')}</option>
                          <option value="cn">{t('appearance.language.cn')}</option>
                        </select>
                      </div>
                    </div>
                    <div className={`appearance-row ${settingsMatchClass([t('appearance.hideShortcut.label'), t('appearance.hideShortcut.desc'), electronToDisplay(hideShortcut), 'shortcut hotkey hide show'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('appearance.hideShortcut.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc"><HighlightSearchText text={t('appearance.hideShortcut.desc')} query={settingsSearch} /></small>
                      </div>
                      <div className="appearance-row-right">
                        <button
                          type="button"
                          className={`shortcut-recorder ${recordingShortcut ? 'recording' : ''}`}
                          onClick={() => { setRecordingShortcut(true); setShortcutError(null) }}
                        >
                          {recordingShortcut ? t('appearance.hideShortcut.recording') : electronToDisplay(hideShortcut)}
                        </button>
                        {shortcutError && (
                          <small className="shortcut-error">
                            {t('appearance.hideShortcut.conflict', { shortcut: electronToDisplay(shortcutError) })}
                          </small>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}

                {settingsTab === 'providers' ? (
                  <>
                    <h3 className="settings-content-title">{t('providers.title')}</h3>
                    <div className="providers-layout">
                      {/* Left column — provider list */}
                      <div>
                        <div className="providers-list-header">
                          <span>{t('providers.title')}</span>
                          <button type="button" className="quiet-button settings-add-button" title={t('providers.addProvider')} aria-label={t('providers.addProvider')} onClick={addProvider}>
                            <Plus size={15} aria-hidden />
                          </button>
                        </div>
                        <div className="provider-list">
                          {allProviders.map((p) => {
                            const isEditingProvider = p.apiKeyRef === provider.apiKeyRef
                            const isActiveProvider = p.apiKeyRef === activeProviderRef
                            return (
                              <div
                                key={p.apiKeyRef}
                                className={`provider-list-item ${isEditingProvider ? 'active' : ''} ${isActiveProvider ? 'chat-active' : ''}`}
                                onClick={() => switchProvider(p)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') switchProvider(p) }}
                              >
                                <span className={`provider-active-dot ${isActiveProvider ? 'visible' : ''}`} />
                                <span className="provider-list-item-name">{p.name || t('providers.unnamed')}</span>
                                {isActiveProvider ? <span className="provider-active-label">{t('providers.active')}</span> : null}
                                {allProviders.length > 1 ? (
                                  <button
                                    type="button"
                                    className="provider-list-item-delete icon-button"
                                    title={t('providers.deleteProvider')}
                                    aria-label={t('providers.deleteProvider')}
                                    onClick={(e) => { e.stopPropagation(); void handleDeleteProvider(p.apiKeyRef) }}
                                  >
                                    <Trash2 size={14} aria-hidden />
                                  </button>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Right column — provider form */}
                      <div className="provider-form">
                        <div className={`provider-field ${settingsMatchClass([t('providers.type'), t('providers.type.openai'), t('providers.type.ollama'), t('providers.type.lmstudio'), 'provider type openai ollama lm studio'])}`}>
                          <span className="provider-field-label"><HighlightSearchText text={t('providers.type')} query={settingsSearch} /></span>
                          <select
                            value={getProviderType(provider)}
                            onChange={(event) => setProvider((p) => applyProviderTypeDefaults(p, event.target.value as LLMProviderType))}
                          >
                            {providerTypeOptions.map((providerType) => (
                              <option key={providerType} value={providerType}>
                                {t(`providers.type.${providerType}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={`provider-field ${settingsMatchClass([t('providers.name'), provider.name, 'provider name label'])}`}>
                          <span className="provider-field-label"><HighlightSearchText text={t('providers.name')} query={settingsSearch} /></span>
                          <input
                            value={provider.name}
                            onChange={(event) => setProvider((p) => ({ ...p, name: event.target.value }))}
                          />
                        </div>
                        <div className={`provider-field ${settingsMatchClass([t('providers.baseUrl'), provider.baseUrl, 'base url endpoint api'])}`}>
                          <span className="provider-field-label"><HighlightSearchText text={t('providers.baseUrl')} query={settingsSearch} /></span>
                          <input
                            className={provider.baseUrl.trim() && !isValidProviderBaseUrl(provider.baseUrl) ? 'invalid-input' : undefined}
                            aria-invalid={Boolean(provider.baseUrl.trim() && !isValidProviderBaseUrl(provider.baseUrl))}
                            value={provider.baseUrl}
                            onChange={(event) => setProvider((p) => ({ ...p, baseUrl: event.target.value }))}
                          />
                        </div>
                        <label className={`provider-toggle-field ${settingsMatchClass([t('providers.allowInsecureTls'), t('providers.allowInsecureTls.desc'), 'tls ssl insecure certificate'])}`}>
                          <span>
                            <strong><HighlightSearchText text={t('providers.allowInsecureTls')} query={settingsSearch} /></strong>
                            <small><HighlightSearchText text={t('providers.allowInsecureTls.desc')} query={settingsSearch} /></small>
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(provider.allowInsecureTls)}
                            onChange={(event) => setProvider((p) => ({ ...p, allowInsecureTls: event.target.checked }))}
                          />
                          <i aria-hidden />
                        </label>
                        <div className={`provider-field ${settingsMatchClass([t('providers.apiKey'), t('providers.apiKey.saved'), t('providers.apiKey.change'), 'api key secret token keychain'])}`}>
                          <span className="provider-field-label"><HighlightSearchText text={t('providers.apiKey')} query={settingsSearch} /></span>
                          {!editingApiKey && hasApiKey ? (
                            <div className="apikey-masked">
                              <span className="apikey-masked-text">●●●●●●●●</span>
                              <span className="apikey-masked-hint"><HighlightSearchText text={t('providers.apiKey.saved')} query={settingsSearch} /></span>
                              <button
                                type="button"
                                className="apikey-change-btn"
                                onClick={() => setEditingApiKey(true)}
                              >
                                <HighlightSearchText text={t('providers.apiKey.change')} query={settingsSearch} />
                              </button>
                            </div>
                          ) : (
                            <input
                              type="password"
                              value={apiKey}
                              onChange={(event) => setApiKey(event.target.value)}
                              placeholder={hasApiKey ? t('providers.apiKey.replacePlaceholder') : t('providers.apiKey.placeholder')}
                            />
                          )}
                        </div>
                        <div className="provider-actions">
                          <button type="button" className="primary-button provider-save-button" onClick={() => void saveProvider()}>
                            <KeyRound size={14} aria-hidden />
                            {t('providers.save')}
                          </button>
                        </div>
                        {providerStatus ? (
                          <div className={`provider-connection-status ${statusToInlineStatus(providerStatus).tone}`}>
                            <span>{statusToInlineStatus(providerStatus).tone === 'success' ? '●' : statusToInlineStatus(providerStatus).tone === 'danger' ? '✕' : statusToInlineStatus(providerStatus).tone === 'warning' ? '◐' : '◌'} {providerStatus}</span>
                          </div>
                        ) : null}
                        <div className="provider-model-selectors">
                          <div className={`model-field ${settingsMatchClass([t('providers.chatModel'), t('providers.searchChatModel'), provider.selectedModel, 'chat model completion'])}`}>
                            <span><HighlightSearchText text={t('providers.chatModel')} query={settingsSearch} /></span>
                            <ModelCombobox
                              value={provider.selectedModel ?? ''}
                              models={models}
                              placeholder={t('providers.searchChatModel')}
                              onOpen={() => void loadModels()}
                              onChange={(modelId) => {
                                const updated = { ...provider, selectedModel: modelId }
                                updateProvider(updated)
                              }}
                            />
                          </div>
                          <div className={`model-field ${settingsMatchClass([t('providers.safetyModel'), t('providers.searchSafetyModel'), provider.commandRiskModel, 'safety risk command model'])}`}>
                            <span><HighlightSearchText text={t('providers.safetyModel')} query={settingsSearch} /></span>
                            <ModelCombobox
                              value={provider.commandRiskModel ?? ''}
                              models={models}
                              placeholder={t('providers.searchSafetyModel')}
                              onOpen={() => void loadModels()}
                              onChange={(modelId) => {
                                const updated = { ...provider, commandRiskModel: modelId }
                                updateProvider(updated)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {settingsTab === 'connections' ? (
                  <>
                    <h3 className="settings-content-title">{t('connections.title')}</h3>
                    <div className="connections-layout">
                      <div>
                        <div className="providers-list-header">
                          <span>{t('connections.title')}</span>
                          {sshProfiles.length > 0 ? (
                            <button type="button" className="quiet-button settings-add-button" title={t('connections.addConnection')} aria-label={t('connections.addConnection')} onClick={addSshProfile}>
                              <Plus size={15} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                        <div className="provider-list">
                          {sshProfiles.length === 0 ? (
                            <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                              {t('connections.noConnections')}
                            </div>
                          ) : null}
                          {sshProfiles.map((p) => {
                            const isEditing = p.id === sshProfile?.id
                            return (
                              <div
                                key={p.id}
                                className={`provider-list-item ${isEditing ? 'active' : ''}`}
                                onClick={() => setSshProfile(p)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') setSshProfile(p) }}
                              >
                                <Server size={13} style={{ flexShrink: 0, color: 'var(--text-muted)' }} aria-hidden />
                                <span className="provider-list-item-name">{p.name || p.host || t('connections.unnamed')}</span>
                                <button
                                  type="button"
                                  className="provider-list-item-delete icon-button"
                                  title={t('connections.deleteConnection')}
                                  aria-label={t('connections.deleteConnection')}
                                  onClick={(e) => { e.stopPropagation(); void deleteSshProfile(p.id) }}
                                >
                                  <Trash2 size={14} aria-hidden />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {sshProfile ? (
                        <div className="connections-form">
                          <div className={`provider-field ${settingsMatchClass([t('connections.name'), sshProfile.name, t('connections.newConnection'), 'connection name label'])}`}>
	                            <span className="provider-field-label"><HighlightSearchText text={t('connections.name')} query={settingsSearch} /></span>
                            <input
                              value={sshProfile.name ?? ''}
                              placeholder={t('connections.newConnection')}
                              onChange={(event) => setSshProfile((p) => p ? { ...p, name: event.target.value } : p)}
                            />
                          </div>
                          <div className={`provider-field ${settingsMatchClass([t('connections.host'), sshProfile.host, 'host hostname server domain ip'])}`}>
	                            <span className="provider-field-label"><HighlightSearchText text={t('connections.host')} query={settingsSearch} /></span>
                            <input
                              value={sshProfile.host}
                              placeholder="example.com"
                              onChange={(event) => setSshProfile((p) => p ? { ...p, host: event.target.value } : p)}
                            />
                          </div>
                          <div className={`provider-field ${settingsMatchClass([t('connections.user'), sshProfile.user, 'user username login'])}`}>
	                            <span className="provider-field-label"><HighlightSearchText text={t('connections.user')} query={settingsSearch} /></span>
                            <input
                              value={sshProfile.user ?? ''}
                              placeholder="root"
                              onChange={(event) => setSshProfile((p) => p ? { ...p, user: event.target.value } : p)}
                            />
                          </div>
                          <div className={`provider-field ${settingsMatchClass([t('connections.port'), String(sshProfile.port ?? ''), 'port ssh 22'])}`}>
	                            <span className="provider-field-label"><HighlightSearchText text={t('connections.port')} query={settingsSearch} /></span>
                            <input
                              type="number"
                              min={MIN_SSH_PORT}
                              max={MAX_SSH_PORT}
                              step="1"
                              className={`numeric-input ${!isValidSshPort(sshProfile.port) ? 'invalid-input' : ''}`}
                              aria-invalid={!isValidSshPort(sshProfile.port)}
                              value={sshProfile.port ?? ''}
                              placeholder="22"
                              onChange={(event) => {
                                const val = event.target.value
                                setSshProfile((p) => p ? { ...p, port: val ? Number(val) : undefined } : p)
                              }}
                              onBlur={commitSshPort}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur()
                                }
                              }}
                            />
                          </div>
                          <div className={`provider-field ${settingsMatchClass([t('connections.identityFile'), t('connections.browseIdentityFile'), sshProfile.identityFile, 'identity file key pem rsa private key'])}`}>
	                            <span className="provider-field-label"><HighlightSearchText text={t('connections.identityFile')} query={settingsSearch} /></span>
                            <div className="inline-field-action">
                              <input
                                value={sshProfile.identityFile ?? ''}
                                placeholder="~/.ssh/id_rsa"
                                onChange={(event) => setSshProfile((p) => p ? { ...p, identityFile: event.target.value } : p)}
                              />
                              <button type="button" className="quiet-button" onClick={() => void chooseSshIdentityFile()}>
	                                <HighlightSearchText text={t('connections.browseIdentityFile')} query={settingsSearch} />
                              </button>
                            </div>
                          </div>
                          <div className={`provider-field ${settingsMatchClass([t('connections.extraArgs'), sshProfile.extraArgs?.join(' '), 'extra args ssh options arguments'])}`}>
	                            <span className="provider-field-label"><HighlightSearchText text={t('connections.extraArgs')} query={settingsSearch} /></span>
                            <input
                              value={sshProfile.extraArgs?.join(' ') ?? ''}
                              placeholder="-o ServerAliveInterval=30"
                              onChange={(event) => {
                                const val = event.target.value.trim()
                                setSshProfile((p) => p ? { ...p, extraArgs: val ? val.split(/\s+/) : undefined } : p)
                              }}
                            />
                          </div>
                          <div className="connection-actions">
                            <button type="button" className="primary-button" disabled={!isValidSshPort(sshProfile.port)} onClick={() => void saveSshProfile()}>
                              {t('connections.save')}
                            </button>
                            {sshProfile.host ? (
                              <button type="button" className="primary-button connection-connect-button" disabled={!isValidSshPort(sshProfile.port)} onClick={() => connectSshProfile(sshProfile)}>
                                <Zap size={13} aria-hidden />
                                {t('connections.connect')}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="connections-empty-detail">
                          {sshProfiles.length === 0 ? (
                            <button type="button" className="quiet-button connection-connect-button" onClick={addSshProfile}>
                              <Plus size={13} aria-hidden />
                              {t('connections.emptyCta')}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}

                {settingsTab === 'prompts' ? (
                  <>
                    <h3 className="settings-content-title">{t('prompts.title')}</h3>
                    <PromptLibrarySection settingsSearch={settingsSearch} />
                  </>
                ) : null}

                {settingsTab === 'snippets' ? (
                  <>
                    <h3 className="settings-content-title">{t('snippets.title')}</h3>
                    <CommandSnippetLibrarySection
                      addSnippetRequestVersion={addSnippetRequestVersion}
                      snippetDraftRequest={snippetDraftRequest}
                      settingsSearch={settingsSearch}
                    />
                  </>
                ) : null}

                {settingsTab === 'data' ? (
                  <>
                    <h3 className="settings-content-title">{t('data.title')}</h3>
                    <div className={`appearance-row ${settingsMatchClass([t('appearance.outputContext.label'), t('appearance.outputContext.desc'), 'output context ai max characters chars terminal'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('appearance.outputContext.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc"><HighlightSearchText text={t('appearance.outputContext.desc')} query={settingsSearch} /></small>
                      </div>
                      <div className="appearance-row-right">
                        <input
                          className={`numeric-input ${!isValidOutputContext(maxOutputContextDraft) ? 'invalid-input' : ''}`}
                          type="number"
                          step="1000"
                          min={MIN_OUTPUT_CONTEXT}
                          value={maxOutputContextDraft}
                          onChange={(event) => handleMaxOutputContextChange(event.target.value)}
                          onBlur={commitMaxOutputContextDraft}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                          }}
                        />
                        <span className="input-suffix">chars</span>
                      </div>
                    </div>
                    <div className={`appearance-row ${settingsMatchClass([t('data.restoreSessions.label'), t('data.restoreSessions.desc'), 'restore sessions startup state'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('data.restoreSessions.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc">
                          <HighlightSearchText text={t('data.restoreSessions.desc')} query={settingsSearch} />
                        </small>
                      </div>
                      <div className="appearance-row-right">
                        <button
                          className={`agent-toggle ${restoreSessions ? 'on' : ''}`}
                          type="button"
                          role="switch"
                          aria-checked={restoreSessions}
                          title={t('data.restoreSessions.label')}
                          onClick={() => onRestoreSessionsChange(!restoreSessions)}
                        >
                          <span />
                        </button>
                      </div>
                    </div>
                    <div className={`appearance-row ${settingsMatchClass([t('data.exportImport.label'), t('data.exportImport.desc'), t('data.export'), t('data.import'), 'export import backup json settings'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('data.exportImport.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc">
                          <HighlightSearchText text={t('data.exportImport.desc')} query={settingsSearch} />
                        </small>
                      </div>
                      <div className="appearance-row-right" style={{ gap: 8, display: 'flex' }}>
                        <button type="button" className="quiet-button" onClick={() => void handleExport()}>
                          <HighlightSearchText text={t('data.export')} query={settingsSearch} />
                        </button>
                        <button type="button" className="quiet-button" onClick={() => void handleImport()}>
                          <HighlightSearchText text={t('data.import')} query={settingsSearch} />
                        </button>
                      </div>
                    </div>
                    <div className={`appearance-row ${settingsMatchClass([t('data.clearSessions.label'), t('data.clearSessions.desc'), t('data.clearSessions'), 'clear saved state session destructive'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('data.clearSessions.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc">
                          <HighlightSearchText text={t('data.clearSessions.desc')} query={settingsSearch} />
                        </small>
                      </div>
                      <div className="appearance-row-right">
                        <button type="button" className="danger-outline-button" onClick={() => void handleClearSavedSessionState()}>
                          <HighlightSearchText text={t('data.clearSessions')} query={settingsSearch} />
                        </button>
                      </div>
                    </div>
                    <div className={`appearance-row ${settingsMatchClass([t('data.clearChatHistory.label'), t('data.clearChatHistory.desc'), t('data.clearChatHistory'), 'clear chat history destructive'])}`}>
                      <div className="appearance-row-left">
                        <span className="appearance-row-label"><HighlightSearchText text={t('data.clearChatHistory.label')} query={settingsSearch} /></span>
                        <small className="appearance-row-desc">
                          <HighlightSearchText text={t('data.clearChatHistory.desc')} query={settingsSearch} />
                        </small>
                      </div>
                      <div className="appearance-row-right">
                        <button type="button" className="danger-outline-button" onClick={handleClearChatHistory}>
                          <HighlightSearchText text={t('data.clearChatHistory')} query={settingsSearch} />
                        </button>
                      </div>
                    </div>
                    {dataStatus ? <p className="settings-status">{dataStatus}</p> : null}
                  </>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      , document.body) : null}

      {historyOpen ? (
        <div className="history-overlay">
          <div className="history-search">
            <Search size={14} aria-hidden />
            <input
              type="text"
              placeholder={t('chat.historySearch')}
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>
          <div className="history-list">
            {filteredHistoryChats.length === 0 ? (
              <p className="history-empty">
                {historyChats.length > 0 && historySearch.trim()
                  ? t('chat.historyNoMatch', { query: historySearch.trim() })
                  : t('chat.historyEmpty')}
              </p>
            ) : (
              filteredHistoryChats.map((chat) => (
                <div key={chat.id} className="history-item" onClick={() => handleReopenChat(chat.id)}>
                  <div className="history-item-info">
                    <span className="history-item-title">{chat.title}</span>
                    <span className="history-item-meta">
                      {new Date(chat.createdAt).toLocaleDateString()} · {chat.messageCount} {t('chat.historyMessages')}
                      {chat.modelId ? ` · ${formatModelLabel(chat.modelId).name}` : ''}
                    </span>
                  </div>
                  <div className="history-item-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={(e) => { e.stopPropagation(); void handleDeleteHistoryChat(chat.id) }}
                      title={t('chat.historyDelete')}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
      <>
      <section className="chat-log" aria-live="polite" ref={chatLogRef}>
        {messages.length === 0 ? (
          <div className="empty-chat">
            <strong>{t('chat.empty.title')}</strong>
            <p>{t('chat.empty.body')}</p>
            <div className="suggestion-chips">
              {suggestionChips.map((suggestion) => (
                <button type="button" key={suggestion.id} onClick={() => setPromptDraft(suggestion.prompt)}>
                  {suggestion.label}
                </button>
              ))}
            </div>
            {!provider.selectedModel ? (
              <button className="quiet-button" type="button" onClick={onOpenSettings}>
                {t('chat.connectProvider')}
              </button>
            ) : null}
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isLastAssistant = message.role === 'assistant' && index === messages.length - 1
          const showDots = isLastAssistant && streaming && !message.content && !message.reasoningContent
          const reasoningIsStreaming = isLastAssistant && streaming && Boolean(message.reasoningContent) && !message.content
          const messageActionsDisabled = streaming || agenticRunning || agenticCommandRunning || Boolean(commandConfirmation)
          const canRegenerate = message.role === 'assistant' && index > 0
          const canFork = message.role === 'assistant'

          if (message.display === 'command-output') {
            return (
              <div className="command-output-message" key={`command-output-${index}`}>
                <div>
                  <span className="system-prefix">&gt;</span>
                  <span>{t('chat.commandOutput.label')}</span>
                  {message.command ? <code>{message.command}</code> : null}
                </div>
                <details>
                  <summary>{t('chat.commandOutput.show')}</summary>
                  <pre>{message.output?.trim() || t('chat.commandOutput.noOutput')}</pre>
                </details>
              </div>
            )
          }

          if (message.display === 'system-status') {
            return (
              <div className="command-output-message command-edit-message" key={`system-status-${index}`}>
                <div>
                  <span className="system-prefix">&gt;</span>
                  <span>{t('chat.commandEdited.label')}</span>
                </div>
                <div className="command-edit-details">
                  <div>
                    <span>{t('chat.commandEdited.original')}</span>
                    <pre>{message.output}</pre>
                  </div>
                  <div>
                    <span>{t('chat.commandEdited.final')}</span>
                    <pre>{message.command}</pre>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
              <div className="chat-message-meta">
                <span className="chat-avatar">
                  {message.role === 'assistant'
                    ? <Bot size={10} aria-hidden />
                    : <User size={10} aria-hidden />}
                </span>
                <span className="chat-role-label">{message.role === 'assistant' ? t('chat.role.assistant') : t('chat.role.user')}</span>
              </div>
              {message.role === 'assistant' && message.reasoningContent ? (
                <ThinkingBlock
                  content={message.reasoningContent}
                  isStreaming={reasoningIsStreaming}
                  title={t('chat.thinking')}
                />
              ) : null}
              {showDots ? (
                <div className="streaming-dots">
                  <span /><span /><span />
                </div>
              ) : message.role === 'assistant' && message.content ? (
                <MessageContent
                  content={message.content}
                  onRun={runCommand}
                  onPrompt={setPromptDraft}
                  disabled={!activeSession || agenticCommandRunning}
                />
              ) : message.role === 'assistant' ? null : (
                <p>{message.content}</p>
              )}
              {canRegenerate || canFork ? (
                <div className="chat-message-actions">
                  {canRegenerate ? (
                    <button
                      type="button"
                      className="chat-message-action"
                      onClick={() => regenerateMessage(index)}
                      disabled={messageActionsDisabled}
                      title={t('chat.regenerate')}
                      aria-label={t('chat.regenerate')}
                    >
                      <RefreshCw size={11} aria-hidden />
                    </button>
                  ) : null}
                  {canFork ? (
                    <button
                      type="button"
                      className="chat-message-action"
                      onClick={() => forkChatFromMessage(index)}
                      disabled={messageActionsDisabled}
                      title={t('chat.forkFromMessage')}
                      aria-label={t('chat.forkFromMessage')}
                    >
                      <GitFork className="chat-message-action-icon-fork" size={11} aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}

        {agenticRunning && agenticStep > 0 ? (
          <div className="agentic-status">
            <Zap size={12} aria-hidden />
            <span>{t('agent.step', { step: agenticStep, state: commandConfirmation ? t('agent.waiting') : t('agent.running') })} <code>{agenticCommand}</code></span>
          </div>
        ) : null}

        {status ? (
          <div className={`inline-status ${status.tone}`}>
            <span>{status.label}</span>
          </div>
        ) : null}
      </section>

      {commandConfirmation ? (
        <section
          className={`command-confirmation-card ${commandConfirmation.tone}`}
          role="dialog"
          aria-labelledby="command-confirmation-title"
        >
          <div className="command-confirmation-head">
            <div>
              <AlertTriangle size={12} aria-hidden />
              <h2 id="command-confirmation-title">{commandConfirmation.title}</h2>
            </div>
            <span>{commandConfirmation.tone === 'danger' ? t('confirm.review') : t('confirm.warning')}</span>
          </div>
          <div className="command-confirmation-body">
            <label className="command-confirmation-command">
              <span>{t('confirm.command')}</span>
              <textarea
                value={commandConfirmation.command}
                onChange={(event) => updateCommandConfirmationCommand(commandConfirmation.sessionId, event.target.value)}
                spellCheck={false}
                rows={Math.min(5, Math.max(2, commandConfirmation.command.split('\n').length))}
              />
            </label>
            <div className="command-confirmation-reason">
              <span>{t('confirm.reason')}</span>
              <p>{commandConfirmation.reason}</p>
            </div>
            <p className="command-confirmation-note">{t('confirm.agentPaused')}</p>
          </div>
          <footer>
            <button type="button" className="quiet-button" onClick={() => resolveCommandConfirmation(commandConfirmation.sessionId, false)}>
              {t('confirm.cancel')}
            </button>
            <button
              type="button"
              className={`danger-button ${commandConfirmation.tone}`}
              disabled={!commandConfirmation.command.trim()}
              onClick={() => resolveCommandConfirmation(commandConfirmation.sessionId, true, commandConfirmation.command)}
            >
              {commandConfirmation.confirmLabel}
            </button>
          </footer>
        </section>
      ) : null}

      <form
        className={`chat-form ${inputDisabled ? 'disabled' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage()
        }}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          disabled={inputDisabled}
          onChange={(event) => {
            if (activeSessionId) {
              updateThread(activeSessionId, (thread) => ({ ...thread, draft: event.target.value }))
            }
          }}
          onKeyDown={(event) => {
            const wantsSend = event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing
            const wantsMetaSend = event.key === 'Enter' && event.metaKey && !event.nativeEvent.isComposing
            if (wantsSend || wantsMetaSend) {
              event.preventDefault()
              sendMessage()
            }
          }}
          placeholder={t('chat.input.placeholder')}
          rows={1}
        />
        <div className="chat-form-actions">
          <PromptPicker onSelect={setPromptDraft} open={promptPickerOpen} onOpenChange={togglePromptPicker} />
          {streaming || agenticRunning ? (
            <button
              className="stop-button"
              type="button"
              onClick={() => {
                if (activeSessionId) stopAgentic(activeSessionId)
              }}
              title={t('chat.stopAgent')}
              aria-label={t('chat.stopAgent')}
            >
              <Square size={14} aria-hidden />
            </button>
          ) : null}
          <button
            className={`send-button ${streaming ? 'streaming' : ''}`}
            type="submit"
            disabled={streaming || agenticCommandRunning || inputDisabled || !draft.trim()}
            title={t('chat.send')}
            aria-label={t('chat.send')}
          >
            <Send size={15} aria-hidden />
          </button>
        </div>
      </form>
      </>
      )}

      {promptPickerOpen ? createPortal(
        <div className="prompt-picker-overlay" onClick={(event) => { if (event.target === event.currentTarget) closePromptPicker() }}>
          <section className="prompt-picker-palette" role="dialog" aria-modal="true" aria-label={t('promptPalette.title')}>
            <div className="prompt-picker-search">
              <Search size={15} aria-hidden />
              <input
                ref={promptPickerSearchRef}
                type="text"
                placeholder={t('promptPalette.search')}
                value={promptPickerQuery}
                onChange={(e) => setPromptPickerQuery(e.target.value)}
                onKeyDown={handlePromptPickerKeyDown}
              />
            </div>
            <div className="prompt-picker-hint">
              <div className="prompt-picker-shortcuts">
                <span>{t('promptPalette.enterInserts')}</span>
              </div>
              <button type="button" className="prompt-picker-add" onClick={openAddPrompt}>
                <Plus size={12} aria-hidden />
                {t('promptPalette.addPrompt')}
              </button>
            </div>
            <div className="prompt-picker-list" ref={promptPickerListRef}>
              {promptPickerFiltered.length > 0 ? promptPickerFiltered.map((prompt, i) => (
                <button
                  key={prompt.id}
                  type="button"
                  className={`prompt-picker-item ${i === promptPickerActiveIndex ? 'active' : ''}`}
                  onClick={() => {
                    setPromptDraft(prompt.content)
                    closePromptPicker()
                  }}
                  onMouseEnter={() => setPromptPickerActiveIndex(i)}
                >
                  <FileText size={14} aria-hidden />
                  <div className="prompt-picker-item-text">
                    <span className="prompt-picker-item-name">{prompt.name}</span>
                    <span className="prompt-picker-item-preview">{prompt.content}</span>
                  </div>
                </button>
              )) : (
                <p className="prompt-picker-empty">
                  {promptPickerPrompts.length === 0
                    ? t('promptPalette.empty')
                    : t('promptPalette.noMatch')}
                </p>
              )}
            </div>
          </section>
        </div>
      , document.body) : null}

      {savePromptDialog ? createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) closeSavePromptDialog() }}
        >
          <div className="modal-panel">
            <div className="modal-header">
              <BookmarkPlus size={15} aria-hidden />
              <span>{t('chat.saveAsPrompt')}</span>
            </div>
            {savePromptDialog.content === '' ? (
              <>
                <div className="save-prompt-generating">
                  <span className="save-prompt-spinner" />
                  <span>{t('chat.savePrompt.generating')}</span>
                </div>
                <div className="modal-actions">
                  <button type="button" className="quiet-button" onClick={closeSavePromptDialog}>
                    {t('prompts.cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <input
                  className="save-prompt-name-input"
                  value={savePromptName}
                  onChange={(e) => setSavePromptName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSavePromptFromChat()
                    if (e.key === 'Escape') closeSavePromptDialog()
                  }}
                  placeholder={t('prompts.namePlaceholder')}
                  autoFocus
                />
                {savePromptDuplicateName ? (
                  <p className="form-warning">{t('prompts.duplicateName')}</p>
                ) : null}
                <textarea
                  className="save-prompt-content-editor"
                  value={savePromptDialog.content}
                  onChange={(e) => setSavePromptDialog({ ...savePromptDialog, content: e.target.value })}
                  rows={6}
                />
                <div className="modal-actions">
                  <button type="button" className="quiet-button" onClick={closeSavePromptDialog}>
                    {t('prompts.cancel')}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSavePromptFromChat()}
                    disabled={savePromptStatus === 'saving' || savePromptDuplicateName || !savePromptName.trim() || !savePromptDialog.content.trim()}
                  >
                    {savePromptStatus === 'saved'
                      ? t('chat.savePrompt.saved')
                      : savePromptStatus === 'saving'
                        ? t('chat.savePrompt.saving')
                        : t('chat.savePrompt.save')}
                  </button>
                </div>
                {savePromptStatus === 'error' ? (
                  <p className="save-prompt-error">{t('chat.savePrompt.error')}</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      , document.body) : null}

      {deleteConfirmation ? (
        <ConfirmDialog
          title={deleteConfirmation.title}
          message={deleteConfirmation.message}
          confirmLabel={deleteConfirmation.confirmLabel}
          onConfirm={() => void confirmDeleteAction()}
          onCancel={() => setDeleteConfirmation(null)}
        />
      ) : null}
    </aside>
  )
}

interface ModelComboboxProps {
  value: string
  models: LLMModel[]
  placeholder: string
  onOpen?: () => void
  onChange: (modelId: string) => void
}

function ModelCombobox({ value, models, placeholder, onOpen, onChange }: ModelComboboxProps): JSX.Element {
  const { t } = useT()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [listPos, setListPos] = useState<DOMRect | null>(null)

  const formattedValue = useMemo(() => {
    return formatModelDisplay(value)
  }, [value])

  // When dropdown closes, reset query so input shows formatted value
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Track input position for portal-positioned dropdown
  useEffect(() => {
    if (!open) { setListPos(null); return }
    const update = () => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      setListPos(rect ?? null)
    }
    update()
    const ro = new ResizeObserver(update)
    if (wrapperRef.current) ro.observe(wrapperRef.current)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  const availableModels = useMemo(() => {
    if (!value || models.some((model) => model.id === value)) {
      return models
    }

    return [{ id: value }, ...models]
  }, [models, value])

  const matchingModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return availableModels

    return availableModels.filter((model) => {
      const display = formatModelDisplay(model.id)
      const owner = model.ownedBy ?? ''
      return `${model.id} ${display} ${owner}`.toLowerCase().includes(normalizedQuery)
    })
  }, [availableModels, query])

  const visibleModels = matchingModels.slice(0, MAX_VISIBLE_MODELS)
  const activeModel = visibleModels[activeIndex]
  const activeOptionId = activeModel ? `${listboxId}-option-${activeIndex}` : undefined

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(visibleModels.length - 1, 0)))
  }, [visibleModels.length])

  const commitModel = useCallback((modelId: string) => {
    setQuery('')
    setOpen(false)
    onChange(modelId)
  }, [onChange])

  const openList = useCallback(() => {
    setOpen((current) => {
      if (!current) onOpen?.()
      return true
    })
  }, [onOpen])

  const closeList = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      closeList()
    }
  }, [closeList])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openList()
      setActiveIndex((index) => Math.min(index + 1, Math.max(visibleModels.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      openList()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (activeModel) {
        commitModel(activeModel.id)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeList()
    }
  }, [activeModel, closeList, commitModel, open, openList, visibleModels.length])

  const listContent = open ? (
    <div
      className="model-combobox-list"
      id={listboxId}
      role="listbox"
      style={listPos ? (() => {
        const gap = 6
        const spaceBelow = window.innerHeight - listPos.bottom - 16
        const spaceAbove = listPos.top - 16
        const opensUp = spaceBelow < 180 && listPos.top > spaceBelow
        const availableSpace = opensUp ? spaceAbove : spaceBelow
        const maxHeight = Math.min(220, Math.max(120, availableSpace - gap))
        return {
          position: 'fixed',
          top: opensUp ? Math.max(16, listPos.top - maxHeight - gap) : listPos.bottom + gap,
          left: listPos.left,
          width: listPos.width,
          maxHeight
        }
      })() : undefined}
    >
      {visibleModels.length > 0 ? (
        visibleModels.map((model, index) => {
          const modelDisplay = formatModelDisplay(model.id)
          return (
            <button
              id={`${listboxId}-option-${index}`}
              key={`${model.id}-${index}`}
              type="button"
              role="option"
              aria-selected={model.id === value}
              className={`model-combobox-option ${index === activeIndex ? 'active' : ''} ${model.id === value ? 'selected' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitModel(model.id)}
            >
              <span>{modelDisplay}</span>
              {model.ownedBy ? <small>{model.ownedBy}</small> : null}
            </button>
          )
        })
      ) : (
        <div className="model-combobox-empty">
          {models.length > 0 ? t('model.noMatch') : t('model.loadFirst')}
        </div>
      )}
      {matchingModels.length > MAX_VISIBLE_MODELS ? (
        <div className="model-combobox-count">
          {t('model.showing', { visible: MAX_VISIBLE_MODELS, total: matchingModels.length })}
        </div>
      ) : null}
    </div>
  ) : null

  return (
    <div ref={wrapperRef} className={`model-combobox ${open ? 'open' : ''}`} onBlur={handleBlur}>
      <input
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        value={open ? query : formattedValue}
        placeholder={models.length > 0 || value ? placeholder : t('model.loadModelsFirst')}
        onFocus={(event) => {
          openList()
          event.currentTarget.select()
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          openList()
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="model-combobox-toggle"
        aria-label="Open model list"
        tabIndex={-1}
        onMouseDown={(event) => {
          event.preventDefault()
          if (open) {
            closeList()
            return
          }
          openList()
          inputRef.current?.focus()
        }}
      >
        <ChevronDown size={14} aria-hidden />
      </button>
      {listContent ? createPortal(listContent, document.body) : null}
    </div>
  )
}

function SettingsStatus({ label }: { label: string }): JSX.Element {
  const { t } = useT()

  if (label === t('status.saved')) {
    return (
      <div className="inline-status success settings-inline-status">
        <Check size={13} aria-hidden />
        <span>{label}</span>
      </div>
    )
  }

  return <p className="settings-status">{label}</p>
}

interface PromptLibrarySectionProps {
  settingsSearch: string
}

function PromptLibrarySection({ settingsSearch }: PromptLibrarySectionProps): JSX.Element {
  const { t } = useT()
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [addingPrompt, setAddingPrompt] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [promptStatus, setPromptStatus] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const duplicateName = useMemo(() => {
    const name = normalizeLibraryName(newName)
    if (!name) return false
    return prompts.some((prompt) => prompt.id !== editing?.id && normalizeLibraryName(prompt.name) === name)
  }, [editing?.id, newName, prompts])
  const settingsMatchClass = useCallback((terms: Array<string | undefined>) => (
    matchesSearchQuery(settingsSearch, terms) ? 'settings-search-match' : ''
  ), [settingsSearch])

  const reload = useCallback(async () => {
    try {
      const list = await window.api.prompt.list()
      setPrompts(list)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleSave = useCallback(async () => {
    if (!newName.trim() || !newContent.trim() || duplicateName) return
    setPromptStatus('Saving...')
    try {
      await window.api.prompt.save({
        id: editing?.id ?? '',
        name: newName.trim(),
        content: newContent.trim(),
        createdAt: editing?.createdAt ?? new Date().toISOString()
      })
      setNewName('')
      setNewContent('')
      setEditing(null)
      setAddingPrompt(false)
      setPromptStatus(t('status.saved'))
      await reload()
    } catch (err) {
      setPromptStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [duplicateName, editing, newContent, newName, reload, t])

  const handleEdit = useCallback((prompt: PromptTemplate) => {
    setEditing(prompt)
    setAddingPrompt(false)
    setNewName(prompt.name)
    setNewContent(prompt.content)
  }, [])

  const handleDelete = useCallback((id: string) => {
    setPendingDeleteId(id)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      await window.api.prompt.delete(id)
      await reload()
    } catch {
      // ignore
    }
  }, [pendingDeleteId, reload])

  const handleImport = useCallback(async () => {
    setPromptStatus('Importing...')
    try {
      const imported = await window.api.prompt.importFiles()
      setPromptStatus(`Imported ${imported.length} prompt(s)`)
      await reload()
    } catch (err) {
      setPromptStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [reload])

  const handleCancel = useCallback(() => {
    setEditing(null)
    setAddingPrompt(false)
    setNewName('')
    setNewContent('')
  }, [])

  const handleAddPrompt = useCallback(() => {
    setEditing(null)
    setAddingPrompt(true)
    setNewName('')
    setNewContent('')
  }, [])

  return (
    <section className="settings-section">
      <div className={`settings-section-heading ${settingsMatchClass([t('prompts.title'), t('prompts.importFromFile'), t('prompts.addPrompt'), 'prompt prompts template markdown import library'])}`}>
        <span><HighlightSearchText text={t('prompts.title')} query={settingsSearch} /></span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="quiet-button prompt-import-btn" onClick={() => void handleImport()}>
            <HighlightSearchText text={t('prompts.importFromFile')} query={settingsSearch} />
          </button>
          {!editing && !addingPrompt ? (
            <button type="button" className="quiet-button" style={{ fontSize: 11 }} onClick={handleAddPrompt}>
              <Plus size={12} aria-hidden />
              {' '}<HighlightSearchText text={t('prompts.addPrompt')} query={settingsSearch} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="prompt-list">
        {prompts.length > 0 ? (
          prompts.map((prompt) => (
            <div key={prompt.id} className={`prompt-list-item ${settingsMatchClass([prompt.name, prompt.content])}`}>
              <div className="prompt-list-item-info">
                <span className="prompt-list-item-name"><HighlightSearchText text={prompt.name} query={settingsSearch} /></span>
                <span className="prompt-list-item-preview">
                  <HighlightSearchText text={`${prompt.content.slice(0, 80)}${prompt.content.length > 80 ? '…' : ''}`} query={settingsSearch} />
                </span>
              </div>
              <div className="prompt-list-item-actions">
                <button
                  type="button"
                  className="icon-button"
                  title={t('prompts.edit')}
                  onClick={() => handleEdit(prompt)}
                >
                  <Pencil size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title={t('prompts.delete')}
                  onClick={() => void handleDelete(prompt.id)}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="prompt-list-empty">
            <p>{t('prompts.noPrompts')}</p>
            {!editing && !addingPrompt ? (
              <button type="button" className="quiet-button" onClick={handleAddPrompt}>
                <Plus size={12} aria-hidden />
                {t('prompts.addPrompt')}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {(editing || addingPrompt) ? (
        <div className={`prompt-form ${settingsMatchClass([t('prompts.namePlaceholder'), t('prompts.contentPlaceholder'), t('prompts.savePrompt'), t('prompts.addPrompt'), newName, newContent, 'prompt name content'])}`}>
          <input
            type="text"
            placeholder={t('prompts.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          {duplicateName ? (
            <p className="form-warning">{t('prompts.duplicateName')}</p>
          ) : null}
          <textarea
            className="prompt-form-content"
            placeholder={t('prompts.contentPlaceholder')}
            rows={3}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <div className="prompt-form-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!newName.trim() || !newContent.trim() || duplicateName}
              onClick={() => void handleSave()}
            >
              {editing ? t('prompts.savePrompt') : t('prompts.addPrompt')}
            </button>
            {(editing || addingPrompt) ? (
              <button type="button" className="quiet-button" onClick={handleCancel}>
                {t('prompts.cancel')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {promptStatus ? <SettingsStatus label={promptStatus} /> : null}

      {pendingDeleteId !== null ? (
        <ConfirmDialog
          title={withObjectName(t('prompts.deleteConfirmTitle'), prompts.find((prompt) => prompt.id === pendingDeleteId)?.name)}
          message={t('prompts.deleteConfirmMessage')}
          confirmLabel={t('prompts.deleteConfirmBtn')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDeleteId(null)}
        />
      ) : null}
    </section>
  )
}

interface CommandSnippetLibrarySectionProps {
  addSnippetRequestVersion: number
  snippetDraftRequest?: { id: string; name?: string; command?: string } | null
  settingsSearch: string
}

function snippetNameFromCommand(command: string): string {
  return command.split('\n')[0]?.trim().slice(0, 48) || ''
}

function CommandSnippetLibrarySection({ addSnippetRequestVersion, snippetDraftRequest, settingsSearch }: CommandSnippetLibrarySectionProps): JSX.Element {
  const { t } = useT()
  const [snippets, setSnippets] = useState<CommandSnippet[]>([])
  const [editing, setEditing] = useState<CommandSnippet | null>(null)
  const [addingSnippet, setAddingSnippet] = useState(false)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [status, setStatus] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const handledSnippetDraftRequestRef = useRef<string>()
  const duplicateName = useMemo(() => {
    const normalizedName = normalizeLibraryName(name)
    if (!normalizedName) return false
    return snippets.some((snippet) => snippet.id !== editing?.id && normalizeLibraryName(snippet.name) === normalizedName)
  }, [editing?.id, name, snippets])
  const settingsMatchClass = useCallback((terms: Array<string | undefined>) => (
    matchesSearchQuery(settingsSearch, terms) ? 'settings-search-match' : ''
  ), [settingsSearch])

  const reload = useCallback(async () => {
    try {
      const list = await window.api.commandSnippet.list()
      setSnippets(list)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleSave = useCallback(async () => {
    if (!name.trim() || !command.trim() || duplicateName) return
    setStatus('Saving...')
    try {
      await window.api.commandSnippet.save({
        id: editing?.id ?? '',
        name: name.trim(),
        command: command.trim(),
        createdAt: editing?.createdAt ?? new Date().toISOString(),
        updatedAt: editing?.updatedAt ?? new Date().toISOString()
      })
      setName('')
      setCommand('')
      setEditing(null)
      setAddingSnippet(false)
      setStatus(t('status.saved'))
      await reload()
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [command, duplicateName, editing, name, reload, t])

  const handleEdit = useCallback((snippet: CommandSnippet) => {
    setEditing(snippet)
    setAddingSnippet(false)
    setName(snippet.name)
    setCommand(snippet.command)
  }, [])

  const handleCancel = useCallback(() => {
    setEditing(null)
    setAddingSnippet(false)
    setName('')
    setCommand('')
  }, [])

  const handleAddSnippet = useCallback(() => {
    setEditing(null)
    setAddingSnippet(true)
    setName('')
    setCommand('')
  }, [])

  const handleAddSnippetDraft = useCallback((draftCommand: string, draftName?: string) => {
    setEditing(null)
    setAddingSnippet(true)
    setName(draftName?.trim() || snippetNameFromCommand(draftCommand))
    setCommand(draftCommand)
  }, [])

  useEffect(() => {
    if (addSnippetRequestVersion > 0) {
      handleAddSnippet()
    }
  }, [addSnippetRequestVersion, handleAddSnippet])

  useEffect(() => {
    if (!snippetDraftRequest || handledSnippetDraftRequestRef.current === snippetDraftRequest.id) return
    handledSnippetDraftRequestRef.current = snippetDraftRequest.id
    if (snippetDraftRequest.command?.trim()) {
      handleAddSnippetDraft(snippetDraftRequest.command.trim(), snippetDraftRequest.name)
    } else {
      handleAddSnippet()
    }
  }, [handleAddSnippet, handleAddSnippetDraft, snippetDraftRequest])

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      await window.api.commandSnippet.delete(id)
      await reload()
    } catch {
      // ignore
    }
  }, [pendingDeleteId, reload])

  return (
    <section className="settings-section">
      <div className={`settings-section-heading ${settingsMatchClass([t('snippets.title'), t('snippets.quickHint'), t('snippets.addSnippet'), 'snippet snippets command terminal shell quick open run insert'])}`}>
        <span><HighlightSearchText text={t('snippets.quickHint')} query={settingsSearch} /></span>
        {!editing && !addingSnippet ? (
          <button type="button" className="quiet-button" style={{ fontSize: 11 }} onClick={handleAddSnippet}>
            <Plus size={12} aria-hidden />
            {' '}<HighlightSearchText text={t('snippets.addSnippet')} query={settingsSearch} />
          </button>
        ) : null}
      </div>

      <div className="prompt-list">
        {snippets.length > 0 ? snippets.map((snippet) => (
          <div key={snippet.id} className={`prompt-list-item command-snippet-list-item ${settingsMatchClass([snippet.name, snippet.command])}`}>
            <Command size={13} aria-hidden />
            <div className="prompt-list-item-info">
              <span className="prompt-list-item-name"><HighlightSearchText text={snippet.name} query={settingsSearch} /></span>
              <span className="prompt-list-item-preview command-snippet-command"><HighlightSearchText text={snippet.command} query={settingsSearch} /></span>
            </div>
            <div className="prompt-list-item-actions">
              <button
                type="button"
                className="icon-button"
                title={t('snippets.edit')}
                onClick={() => handleEdit(snippet)}
              >
                <Pencil size={16} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-button"
                title={t('snippets.delete')}
                onClick={() => setPendingDeleteId(snippet.id)}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          </div>
        )) : (
          <div className="prompt-list-empty">
            <p>{t('snippets.noSnippets')}</p>
            {!editing && !addingSnippet ? (
              <button type="button" className="quiet-button" onClick={handleAddSnippet}>
                <Plus size={12} aria-hidden />
                {t('snippets.addSnippet')}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {(editing || addingSnippet) ? (
        <div className={`prompt-form ${settingsMatchClass([t('snippets.namePlaceholder'), t('snippets.commandPlaceholder'), t('snippets.saveSnippet'), t('snippets.addSnippet'), name, command, 'snippet command shell terminal'])}`}>
          <input
            type="text"
            placeholder={t('snippets.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {duplicateName ? (
            <p className="form-warning">{t('snippets.duplicateName')}</p>
          ) : null}
          <textarea
            className="prompt-form-content command-snippet-form-command"
            placeholder={t('snippets.commandPlaceholder')}
            rows={4}
            value={command}
            onChange={(event) => setCommand(event.target.value)}
          />
          <div className="prompt-form-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!name.trim() || !command.trim() || duplicateName}
              onClick={() => void handleSave()}
            >
              {editing ? t('snippets.saveSnippet') : t('snippets.addSnippet')}
            </button>
            {(editing || addingSnippet) ? (
              <button type="button" className="quiet-button" onClick={handleCancel}>
                {t('prompts.cancel')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {status ? <SettingsStatus label={status} /> : null}

      {pendingDeleteId !== null ? (
        <ConfirmDialog
          title={withObjectName(t('snippets.deleteConfirmTitle'), snippets.find((snippet) => snippet.id === pendingDeleteId)?.name)}
          message={t('snippets.deleteConfirmMessage')}
          confirmLabel={t('snippets.deleteConfirmBtn')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDeleteId(null)}
        />
      ) : null}
    </section>
  )
}
