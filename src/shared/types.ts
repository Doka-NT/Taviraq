export type TerminalSessionKind = 'local' | 'ssh'
export type AssistMode = 'off' | 'read' | 'agent'
export type AppShortcutAction =
  | 'clear-terminal'
  | 'open-prompt-library'
  | 'open-command-snippets'
  | 'open-settings'
  | 'new-tab'
  | 'close-tab'
  | 'toggle-sidebar'
  | 'next-tab'
  | `switch-tab-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`

export interface TerminalSessionInfo {
  id: string
  kind: TerminalSessionKind
  label: string
  localLabel?: string
  cwd?: string
  shell?: string
  remoteHost?: string
  remoteTarget?: string
  reconnectCommand?: string
  command: string
  createdAt: number
}

export interface CreateTerminalRequest {
  cwd?: string
  cols?: number
  rows?: number
}

export interface TerminalCommandEvent {
  sessionId: string
  command: string
  echoed: boolean
}

export interface TerminalPromptEvent {
  sessionId: string
}

export interface TerminalBlock {
  id: string
  sessionId: string
  command: string
  startOffset: number
  endOffset: number
  startLine: number
  endLine: number
  complete: boolean
}

export interface SSHProfile {
  name?: string
  host: string
  user?: string
  port?: number
  identityFile?: string
  extraArgs?: string[]
}

export interface SSHProfileConfig extends SSHProfile {
  id: string
}

export interface LLMProviderConfig {
  name: string
  providerType?: LLMProviderType
  baseUrl: string
  apiKeyRef: string
  selectedModel?: string
  commandRiskModel?: string
  defaultHeaders?: Record<string, string>
  allowInsecureTls?: boolean
  proxyUrl?: string
  proxyUsername?: string
  proxyPasswordRef?: string
}

export type LLMProviderType = 'openai' | 'ollama' | 'lmstudio' | 'anthropic'

export interface SaveLLMProviderRequest {
  provider: LLMProviderConfig
  apiKey?: string
  proxyPassword?: string
}

export interface LLMModel {
  id: string
  ownedBy?: string
}

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export type RestorableThreadMessage = ChatMessage & {
  display?: 'command-output' | 'system-status'
  command?: string
  output?: string
  reasoningContent?: string
}

export interface RestorableAssistantThread {
  messages: RestorableThreadMessage[]
  draft: string
  session?: Pick<TerminalSessionInfo, 'id' | 'kind' | 'label' | 'cwd' | 'shell'>
}

export type RestorableAssistantThreads = Record<string, RestorableAssistantThread>

export interface RestoredTerminalSession {
  id: string
  kind: TerminalSessionKind
  label: string
  localLabel?: string
  cwd?: string
  shell?: string
  remoteHost?: string
  remoteTarget?: string
  reconnectCommand?: string
  command: string
  createdAt: number
  status: 'running' | 'exited' | 'disconnected'
  output: string
}

export interface SessionStateSnapshot {
  version: number
  savedAt: string
  activeSessionId?: string
  sessions: RestoredTerminalSession[]
  assistantThreads: RestorableAssistantThreads
}

export type SaveSessionStateRequest = SessionStateSnapshot

export interface TerminalContext {
  selectedText: string
  assistMode?: AssistMode
  terminalOutput?: string
  language?: string
  session?: Pick<TerminalSessionInfo, 'id' | 'kind' | 'label' | 'cwd' | 'shell'>
}

export interface ChatStreamRequest {
  requestId: string
  provider: LLMProviderConfig
  messages: ChatMessage[]
  context: TerminalContext
}

export interface CommandRiskAssessmentRequest {
  provider: LLMProviderConfig
  command: string
  context: TerminalContext
}

export interface CommandRiskAssessment {
  dangerous: boolean
  reason: string
}

export interface SummarizeConversationRequest {
  requestId?: string
  provider: LLMProviderConfig
  messages: ChatMessage[]
  language?: string
}

export interface GeneratedPrompt {
  name: string
  content: string
}

export type ChatStreamEvent =
  | { requestId: string; type: 'chunk'; content: string }
  | { requestId: string; type: 'reasoning'; content: string }
  | { requestId: string; type: 'progress'; stage: 'model_load' | 'prompt_processing'; progress: number }
  | { requestId: string; type: 'error'; message: string }
  | { requestId: string; type: 'done' }

export interface CommandProposal {
  id: string
  command: string
  explanation: string
}

export interface PromptTemplate {
  id: string
  name: string
  content: string
  createdAt: string
}

export interface CommandSnippet {
  id: string
  name: string
  command: string
  createdAt: string
  updatedAt: string
}

export interface SavedChat {
  id: string
  title: string
  messages: RestorableThreadMessage[]
  createdAt: string
  updatedAt: string
  providerRef?: string
  modelId?: string
  sessionSnapshot?: Pick<TerminalSessionInfo, 'kind' | 'label' | 'cwd' | 'shell'>
}

export interface SavedChatSummary {
  id: string
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
  providerRef?: string
  modelId?: string
  sessionSnapshot?: Pick<TerminalSessionInfo, 'kind' | 'label' | 'cwd' | 'shell'>
}

export interface AppConfig {
  providers: LLMProviderConfig[]
  activeProviderRef?: string
  hideShortcut?: string
  sshProfiles?: SSHProfileConfig[]
  windowBounds?: {
    x?: number
    y?: number
    width: number
    height: number
    isMaximized?: boolean
  }
}

export interface ExportData {
  version: number
  exportedAt: string
  config: AppConfig
  apiKeys?: Record<string, string>
  proxyPasswords?: Record<string, string>
  prompts: PromptTemplate[]
  commandSnippets?: CommandSnippet[]
  sshProfiles?: SSHProfileConfig[]
  preferences: {
    textSize?: number
    sidebarWidth?: number
    language?: string
    themeId?: string
  }
}

export interface ImportResult {
  providersAdded: number
  promptsAdded: number
  commandSnippetsAdded: number
  sshProfilesAdded: number
  preferences?: { textSize?: number; sidebarWidth?: number; language?: string; themeId?: string }
}
