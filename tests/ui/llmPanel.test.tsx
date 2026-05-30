import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cleanCommandOutput } from '@renderer/utils/commandOutput'
import { buildAgentContinuation, wasTerminalContextSentToProvider } from '@renderer/utils/agentContinuation'
import { estimateComposerContextTokens, formatComposerContextTokens } from '@renderer/utils/composerContext'
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isChatScrolledToBottom } from '@renderer/utils/chatAutoscroll'
import { LlmPanel } from '@renderer/components/LlmPanel'
import type { AppConfig, ImportResult, LocalUsageStats } from '@shared/types'

const defaultConfig: AppConfig = {
  providers: [
    {
      name: 'OpenAI Compatible',
      providerType: 'openai',
      baseUrl: 'https://api.openai.com',
      apiKeyRef: 'openai-compatible-default',
      selectedModel: '',
      commandRiskModel: ''
    }
  ],
  activeProviderRef: 'openai-compatible-default'
}

function createApiMock() {
  return {
    app: {
      openExternalUrl: vi.fn(),
      setWindowOpacity: vi.fn()
    },
    shortcuts: {
      onShortcut: vi.fn(() => vi.fn()),
      setHide: vi.fn(() => Promise.resolve(true)),
      startRecording: vi.fn(() => Promise.resolve(undefined)),
      stopRecording: vi.fn(() => Promise.resolve(undefined)),
      onRecorded: vi.fn(() => vi.fn()),
      onWindowShow: vi.fn(() => vi.fn()),
      notifyWindowReady: vi.fn()
    },
    config: {
      load: vi.fn(() => Promise.resolve(defaultConfig)),
      setSecretMaskingMode: vi.fn(() => Promise.resolve(defaultConfig)),
      setSecretMaskingSettings: vi.fn(() => Promise.resolve(defaultConfig))
    },
    terminal: {
      create: vi.fn(),
      list: vi.fn(() => Promise.resolve([])),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn(() => vi.fn()),
      onCommand: vi.fn(() => vi.fn()),
      onExit: vi.fn(() => vi.fn()),
      onCwd: vi.fn(() => vi.fn()),
      onSession: vi.fn(() => vi.fn()),
      onPrompt: vi.fn(() => vi.fn())
    },
    sessionState: {
      load: vi.fn(),
      save: vi.fn(),
      clear: vi.fn()
    },
    chatHistory: {
      list: vi.fn(() => Promise.resolve([])),
      get: vi.fn(),
      save: vi.fn(() => Promise.resolve(undefined)),
      delete: vi.fn(() => Promise.resolve(undefined)),
      clear: vi.fn(() => Promise.resolve(undefined))
    },
    ssh: {
      connectProfile: vi.fn(),
      connectCommand: vi.fn(),
      listProfiles: vi.fn(() => Promise.resolve([])),
      saveProfile: vi.fn(() => Promise.resolve(defaultConfig)),
      deleteProfile: vi.fn(() => Promise.resolve(defaultConfig)),
      chooseIdentityFile: vi.fn()
    },
    mcp: {
      listServers: vi.fn(() => Promise.resolve([])),
      saveServer: vi.fn(() => Promise.resolve([])),
      deleteServer: vi.fn(() => Promise.resolve([])),
      refreshTools: vi.fn(() => Promise.resolve([])),
      setToolEnabled: vi.fn(() => Promise.resolve([])),
      discoverExternal: vi.fn(() => Promise.resolve({ servers: [], errors: [] })),
      importServers: vi.fn(() => Promise.resolve({ imported: 0, skipped: 0 }))
    },
    llm: {
      saveProvider: vi.fn(() => Promise.resolve(defaultConfig)),
      hasApiKey: vi.fn(() => Promise.resolve(false)),
      deleteProvider: vi.fn(() => Promise.resolve(defaultConfig)),
      listModels: vi.fn(() => Promise.resolve({ models: [] })),
      assessCommandRisk: vi.fn(),
      summarizeConversation: vi.fn(),
      cancelSummarizeConversation: vi.fn(),
      cancelChatStream: vi.fn(),
      chatStream: vi.fn(),
      onChatStreamEvent: vi.fn(() => vi.fn())
    },
    command: {
      propose: vi.fn(() => Promise.resolve([])),
      runConfirmed: vi.fn()
    },
    secret: {
      maskOutput: vi.fn((_sessionId: string, text: string) => Promise.resolve(text)),
      listAuditEvents: vi.fn(() => Promise.resolve([])),
      clearAuditEvents: vi.fn(() => Promise.resolve(undefined)),
      onAuditEvent: vi.fn(() => vi.fn())
    },
    prompt: {
      list: vi.fn(() => Promise.resolve([])),
      save: vi.fn(),
      delete: vi.fn(),
      importFiles: vi.fn(() => Promise.resolve([]))
    },
    commandSnippet: {
      list: vi.fn(() => Promise.resolve([])),
      save: vi.fn(),
      delete: vi.fn()
    },
    data: {
      export: vi.fn(() => Promise.resolve(undefined)),
      import: vi.fn<() => Promise<ImportResult | undefined>>(() => Promise.resolve(undefined)),
      localStats: vi.fn<() => Promise<LocalUsageStats>>(() => Promise.resolve({ savedChats: 0, savedSessions: 0, storageUsed: '0 B' }))
    }
  }
}

function renderDataSettings() {
  return render(
    <LlmPanel
      sessionIds={[]}
      selectedText=""
      getOutput={() => ''}
      getOutputForSession={() => ''}
      settingsOpen
      onOpenSettings={() => undefined}
      onCloseSettings={() => undefined}
      settingsTabRequest="data"
      settingsTabRequestVersion={1}
      addSnippetRequestVersion={0}
      promptLibraryRequestVersion={0}
      textSize={14}
      onTextSizeChange={() => undefined}
      terminalFontFamily="system"
      onTerminalFontFamilyChange={() => undefined}
      terminalCursorStyle="block"
      onTerminalCursorStyleChange={() => undefined}
      terminalCursorBlink={false}
      onTerminalCursorBlinkChange={() => undefined}
      terminalLineHeight={1.2}
      onTerminalLineHeightChange={() => undefined}
      terminalScrollback={1000}
      onTerminalScrollbackChange={() => undefined}
      windowOpacity={1}
      onWindowOpacityChange={() => undefined}
      sidebarWidth={360}
      onSidebarWidthChange={() => undefined}
      language="en"
      onLanguageChange={() => undefined}
      themeId="dark"
      onThemeChange={() => undefined}
      hideShortcut="CommandOrControl+Shift+Space"
      onHideShortcutChange={() => undefined}
      maxOutputContext={20000}
      onMaxOutputContextChange={() => undefined}
      restoreSessions
      onRestoreSessionsChange={() => undefined}
      restoredThreads={{}}
      onThreadsChange={() => undefined}
      onClearSavedSessionState={() => Promise.resolve(undefined)}
      onReopenChat={() => undefined}
      onConnectSsh={() => undefined}
    />
  )
}

let apiMock: ReturnType<typeof createApiMock>

beforeEach(() => {
  apiMock = createApiMock()
  Object.defineProperty(window, 'api', {
    value: apiMock,
    configurable: true
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LlmPanel data local usage stats', () => {
  it('renders local usage values on the Data settings tab', async () => {
    apiMock.data.localStats.mockResolvedValue({ savedChats: 5, savedSessions: 3, storageUsed: '1.2 MB' })

    renderDataSettings()

    const localUsage = (await screen.findByText('Local usage')).closest('section')
    expect(localUsage).not.toBeNull()
    expect(within(localUsage!).getByText('Storage used')).toBeInTheDocument()
    expect(within(localUsage!).getByText('1.2 MB')).toBeInTheDocument()
    expect(within(localUsage!).getByText('Saved chats')).toBeInTheDocument()
    expect(within(localUsage!).getByText('5')).toBeInTheDocument()
    expect(within(localUsage!).getByText('Saved sessions')).toBeInTheDocument()
    expect(within(localUsage!).getByText('3')).toBeInTheDocument()
  })

  it('renders zero local usage values without hiding them', async () => {
    apiMock.data.localStats.mockResolvedValue({ savedChats: 0, savedSessions: 0, storageUsed: '0 B' })

    renderDataSettings()

    expect(await screen.findByText('0 B')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(2)
  })

  it('refreshes local usage after clearing chat history', async () => {
    apiMock.data.localStats
      .mockResolvedValueOnce({ savedChats: 2, savedSessions: 1, storageUsed: '8 KB' })
      .mockResolvedValueOnce({ savedChats: 0, savedSessions: 1, storageUsed: '4 KB' })
    const user = userEvent.setup()

    renderDataSettings()

    await waitFor(() => expect(apiMock.data.localStats).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Clear chat history' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(apiMock.chatHistory.clear).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(apiMock.data.localStats).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('4 KB')).toBeInTheDocument()
  })

  it('refreshes local usage after importing data', async () => {
    apiMock.data.localStats
      .mockResolvedValueOnce({ savedChats: 1, savedSessions: 0, storageUsed: '2 KB' })
      .mockResolvedValueOnce({ savedChats: 5, savedSessions: 2, storageUsed: '12 KB' })
    apiMock.data.import.mockResolvedValue({
      providersAdded: 0,
      promptsAdded: 0,
      commandSnippetsAdded: 0,
      sshProfilesAdded: 0,
      mcpServersAdded: 0
    })
    const user = userEvent.setup()

    renderDataSettings()

    await waitFor(() => expect(apiMock.data.localStats).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(apiMock.data.import).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(apiMock.data.localStats).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('12 KB')).toBeInTheDocument()
  })
})

describe('LlmPanel command output cleanup', () => {
  it('strips PTY echo when a secret placeholder was resolved before execution', () => {
    const command = 'curl -H "Authorization: Bearer [[TAVIRAQ_SECRET_1_BEARER_TOKEN]]" https://example.test'
    const output = [
      'curl -H "Authorization: Bearer token-ABC1234567890_token-ABC1234567890" https://example.test',
      '{"ok":true}',
      '$ '
    ].join('\n')

    expect(cleanCommandOutput(command, output)).toBe('{"ok":true}')
  })

  it('withholds command output from provider continuation in strict mode', () => {
    const command = 'curl -H "Authorization: Bearer token-ABC1234567890_token-ABC1234567890" https://example.test'
    const output = 'SECRET_TOKEN=abc1234567890abc1234567890'
    const continuation = buildAgentContinuation(command, output, true)

    expect(continuation).toContain('strict terminal context')
    expect(continuation).not.toContain(command)
    expect(continuation).not.toContain(output)
  })

  it('marks strict command output as hidden from provider for display labels', () => {
    const strictContinuation = buildAgentContinuation('ps aux', 'secret output', true)
    const regularContinuation = buildAgentContinuation('pwd', '/Users/artem', false)

    expect(wasTerminalContextSentToProvider(strictContinuation)).toBe(false)
    expect(wasTerminalContextSentToProvider(regularContinuation)).toBe(true)
    expect(wasTerminalContextSentToProvider(regularContinuation, false)).toBe(false)
  })

  it('estimates composer context tokens from payload characters', () => {
    expect(estimateComposerContextTokens(0)).toBe(0)
    expect(estimateComposerContextTokens(1)).toBe(1)
    expect(estimateComposerContextTokens(78_000)).toBe(19_500)
  })

  it('formats composer context tokens compactly', () => {
    expect(formatComposerContextTokens(0)).toBe('0')
    expect(formatComposerContextTokens(999)).toBe('999')
    expect(formatComposerContextTokens(1000)).toBe('1k')
    expect(formatComposerContextTokens(12_040)).toBe('12k')
    expect(formatComposerContextTokens(12_560)).toBe('12.6k')
  })

  it('keeps assistant autoscroll active near the bottom of the chat', () => {
    expect(isChatScrolledToBottom({
      scrollHeight: 1000,
      scrollTop: 552,
      clientHeight: 400
    })).toBe(true)
  })

  it('pauses assistant autoscroll when the user scrolls above the bottom threshold', () => {
    expect(isChatScrolledToBottom({
      scrollHeight: 1000,
      scrollTop: 551 - CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
      clientHeight: 400
    })).toBe(false)
  })

  it('resumes assistant autoscroll after the user returns to the bottom', () => {
    expect(isChatScrolledToBottom({
      scrollHeight: 1000,
      scrollTop: 600,
      clientHeight: 400
    })).toBe(true)
  })
})
