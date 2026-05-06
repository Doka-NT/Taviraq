import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AppShortcutAction,
  ChatStreamRequest,
  CommandSnippet,
  CommandRiskAssessmentRequest,
  CreateTerminalRequest,
  ExportData,
  ImportResult,
  PromptTemplate,
  SaveSessionStateRequest,
  SaveLLMProviderRequest,
  SavedChat,
  SSHProfile,
  SSHProfileConfig,
  SummarizeConversationRequest
} from '@shared/types'
import { TerminalManager } from './services/TerminalManager'
import { ChatHistoryStore } from './services/chatHistoryStore'
import { ConfigStore } from './services/configStore'
import { PromptStore } from './services/promptStore'
import { CommandSnippetStore } from './services/commandSnippetStore'
import { SessionStateStore } from './services/sessionStateStore'
import { deleteApiKey, getApiKey, saveApiKey } from './services/secretStore'
import { assessCommandRisk, listModels, streamChatCompletion, summarizeConversation } from './services/llmService'
import { extractCommandProposals } from './utils/commandProposals'
import { buildAccelerator } from '../shared/accelerator'

let mainWindow: BrowserWindow | undefined
let isQuitting = false
let currentHideShortcut = ''
let isRecordingShortcut = false
let saveWindowBoundsTimer: NodeJS.Timeout | undefined
let didSaveWindowBoundsForQuit = false
const terminalManager = new TerminalManager(() => mainWindow)
const configStore = new ConfigStore()
const promptStore = new PromptStore()
const commandSnippetStore = new CommandSnippetStore()
const sessionStateStore = new SessionStateStore()
const chatHistoryStore = new ChatHistoryStore()
const summarizeControllers = new Map<string, AbortController>()

function registerHideShortcut(shortcut: string): boolean {
  if (currentHideShortcut) globalShortcut.unregister(currentHideShortcut)
  const success = globalShortcut.register(shortcut, () => {
    if (!mainWindow) return
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide()
    } else if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.setOpacity(0)
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('app:window-show')
    }
  })
  if (success) {
    currentHideShortcut = shortcut
  } else {
    // Re-register previous shortcut if new one failed
    if (currentHideShortcut) {
      globalShortcut.register(currentHideShortcut, () => {
        if (!mainWindow) return
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide()
        } else if (mainWindow.isVisible()) {
          mainWindow.focus()
        } else {
          mainWindow.setOpacity(0)
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('app:window-show')
        }
      })
    }
  }
  return success
}

const defaultWindowBounds = {
  width: 1440,
  height: 920
}

function normalizeWindowBounds(
  bounds: Awaited<ReturnType<ConfigStore['load']>>['windowBounds']
): { width: number; height: number; x?: number; y?: number } {
  const width = Math.max(bounds?.width ?? defaultWindowBounds.width, 1060)
  const height = Math.max(bounds?.height ?? defaultWindowBounds.height, 680)

  if (typeof bounds?.x !== 'number' || typeof bounds?.y !== 'number') {
    return { width, height }
  }
  const { x, y } = bounds

  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea
    return (
      x < area.x + area.width &&
      x + width > area.x &&
      y < area.y + area.height &&
      y + height > area.y
    )
  })

  return visible ? { width, height, x, y } : { width, height }
}

async function saveWindowBounds(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const bounds = mainWindow.getNormalBounds()
  const isMaximized = mainWindow.isMaximized()

  try {
    await configStore.update((config) => ({
      ...config,
      windowBounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized
      }
    }))
  } catch (error: unknown) {
    console.error('[window bounds save failed]', error)
  }
}

function queueWindowBoundsSave(): void {
  if (saveWindowBoundsTimer) clearTimeout(saveWindowBoundsTimer)
  saveWindowBoundsTimer = setTimeout(() => {
    void saveWindowBounds()
  }, 300)
}

async function createWindow(): Promise<void> {
  const config = await configStore.load()
  const bounds = normalizeWindowBounds(config.windowBounds)

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1060,
    minHeight: 680,
    title: 'AI Terminal',
    backgroundColor: '#050514',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = level >= 2 ? 'renderer error' : 'renderer log'
    console.log(`[${prefix}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer load failed] ${errorCode} ${errorDescription}: ${validatedURL}`)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer gone] ${details.reason}`)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return

    // Shortcut recording mode: capture any key combo and send to renderer
    if (isRecordingShortcut) {
      const accelerator = buildAccelerator(!!input.meta, !!input.control, !!input.shift, !!input.alt, input.code ?? '')
      if (accelerator) {
        event.preventDefault()
        mainWindow?.webContents.send('shortcut:recorded', accelerator)
        isRecordingShortcut = false
      }
      return
    }

    if (!input.meta && !input.control && !input.alt && input.shift && (input.key === 'Tab' || input.code === 'Tab')) {
      event.preventDefault()
      mainWindow?.webContents.send('app:shortcut', 'next-tab' satisfies AppShortcutAction)
      return
    }

    if (input.meta && !input.control && !input.alt && input.shift && (input.key.toLowerCase() === 'k' || input.code === 'KeyK')) {
      event.preventDefault()
      mainWindow?.webContents.send('app:shortcut', 'open-command-snippets' satisfies AppShortcutAction)
      return
    }

    if (input.meta && !input.control && !input.alt && input.shift && (input.key.toLowerCase() === 'p' || input.code === 'KeyP')) {
      event.preventDefault()
      mainWindow?.webContents.send('app:shortcut', 'open-prompt-library' satisfies AppShortcutAction)
      return
    }

    if (
      !input.meta ||
      input.control ||
      input.alt ||
      input.shift
    ) {
      return
    }

    const key = input.key.toLowerCase()
    const isClearShortcut = key === 'k' || input.code === 'KeyK'
    const isSettingsShortcut = key === ',' || input.code === 'Comma'
    const isNewTabShortcut = key === 't' || input.code === 'KeyT'
    const isCloseTabShortcut = key === 'w' || input.code === 'KeyW'
    const tabShortcut = /^[1-9]$/.test(key) ? Number(key) : undefined
    let action: AppShortcutAction | undefined

    if (tabShortcut) {
      action = `switch-tab-${tabShortcut}` as AppShortcutAction
    } else if (isClearShortcut) {
      action = 'clear-terminal'
    } else if (isSettingsShortcut) {
      action = 'open-settings'
    } else if (isNewTabShortcut) {
      action = 'new-tab'
    } else if (isCloseTabShortcut) {
      action = 'close-tab'
    }

    if (!action) return

    event.preventDefault()
    mainWindow?.webContents.send('app:shortcut', action)
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      void saveWindowBounds()
      mainWindow?.hide()
      return
    }

    if (!didSaveWindowBoundsForQuit) {
      e.preventDefault()
      void saveWindowBounds().finally(() => {
        didSaveWindowBoundsForQuit = true
        mainWindow?.close()
      })
    }
  })

  mainWindow.on('resize', queueWindowBoundsSave)
  mainWindow.on('move', queueWindowBoundsSave)

  if (config.windowBounds?.isMaximized) {
    mainWindow.maximize()
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerHideShortcut(config.hideShortcut ?? 'CommandOrControl+Shift+Space')
}

function registerIpc(): void {
  ipcMain.handle('config:load', () => configStore.load())

  ipcMain.handle('shortcut:setHide', async (_event, shortcut: string) => {
    const success = registerHideShortcut(shortcut)
    if (success) {
      const config = await configStore.load()
      await configStore.save({ ...config, hideShortcut: shortcut })
    }
    return success
  })

  ipcMain.on('app:window-ready', () => {
    mainWindow?.setOpacity(1)
  })

  ipcMain.handle('shortcut:startRecording', () => {
    isRecordingShortcut = true
  })

  ipcMain.handle('shortcut:stopRecording', () => {
    isRecordingShortcut = false
  })

  ipcMain.handle('terminal:create', (_event, request?: CreateTerminalRequest) => {
    return terminalManager.createLocal(request)
  })

  ipcMain.handle('terminal:list', () => terminalManager.list())

  ipcMain.handle('sessionState:load', () => sessionStateStore.load())

  ipcMain.handle('sessionState:save', (_event, snapshot: SaveSessionStateRequest) => {
    return sessionStateStore.save(snapshot)
  })

  ipcMain.handle('sessionState:clear', () => sessionStateStore.clear())

  ipcMain.handle('chatHistory:list', () => chatHistoryStore.list())
  ipcMain.handle('chatHistory:get', (_event, id: string) => chatHistoryStore.get(id))
  ipcMain.handle('chatHistory:save', (_event, chat: SavedChat) => chatHistoryStore.save(chat))
  ipcMain.handle('chatHistory:delete', (_event, id: string) => chatHistoryStore.delete(id))
  ipcMain.handle('chatHistory:clear', () => chatHistoryStore.clear())

  ipcMain.handle('terminal:write', (_event, sessionId: string, data: string) => {
    terminalManager.write(sessionId, data)
  })

  ipcMain.handle('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
    terminalManager.resize(sessionId, cols, rows)
  })

  ipcMain.handle('terminal:kill', (_event, sessionId: string) => {
    terminalManager.kill(sessionId)
  })

  ipcMain.handle('ssh:connectProfile', (_event, profile: SSHProfile, request?: CreateTerminalRequest) => {
    return terminalManager.connectSsh(profile, request)
  })

  ipcMain.handle('ssh:listProfiles', async () => {
    const config = await configStore.load()
    return configStore.listSshProfiles(config)
  })

  ipcMain.handle('ssh:saveProfile', async (_event, profile: SSHProfileConfig) => {
    return configStore.upsertSshProfile(profile)
  })

  ipcMain.handle('ssh:deleteProfile', async (_event, id: string) => {
    return configStore.deleteSshProfile(id)
  })

  ipcMain.handle('llm:saveProvider', async (_event, request: SaveLLMProviderRequest) => {
    if (request.apiKey?.trim()) {
      await saveApiKey(request.provider.apiKeyRef, request.apiKey.trim())
    }

    return configStore.upsertProvider(request.provider)
  })

  ipcMain.handle('llm:deleteProvider', async (_event, apiKeyRef: string) => {
    await deleteApiKey(apiKeyRef)
    return configStore.deleteProvider(apiKeyRef)
  })

  ipcMain.handle('llm:listModels', (_event, request: SaveLLMProviderRequest) => {
    if (request.apiKey?.trim()) {
      return saveApiKey(request.provider.apiKeyRef, request.apiKey.trim()).then(() => listModels(request.provider))
    }

    return listModels(request.provider)
  })

  ipcMain.handle('llm:assessCommandRisk', (_event, request: CommandRiskAssessmentRequest) => {
    return assessCommandRisk(request)
  })

  ipcMain.handle('llm:summarizeConversation', async (_event, request: SummarizeConversationRequest) => {
    const requestId = request.requestId
    if (!requestId) return summarizeConversation(request)

    const controller = new AbortController()
    summarizeControllers.set(requestId, controller)
    try {
      return await summarizeConversation(request, controller.signal)
    } finally {
      summarizeControllers.delete(requestId)
    }
  })

  ipcMain.handle('llm:cancelSummarizeConversation', (_event, requestId: string) => {
    summarizeControllers.get(requestId)?.abort()
  })

  ipcMain.handle('command:propose', (_event, text: string) => extractCommandProposals(text))

  ipcMain.handle('command:runConfirmed', (_event, sessionId: string, command: string) => {
    terminalManager.runConfirmed(sessionId, command)
  })

  // Prompts
  ipcMain.handle('prompt:list', () => promptStore.list())

  ipcMain.handle('prompt:save', (_event, prompt: PromptTemplate) => {
    return promptStore.save(prompt)
  })

  ipcMain.handle('prompt:delete', (_event, id: string) => {
    return promptStore.delete(id)
  })

  ipcMain.handle('prompt:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Prompt',
      filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) return []
    const imported: PromptTemplate[] = []
    for (const filePath of result.filePaths) {
      const prompt = await promptStore.importFromFile(filePath)
      imported.push(prompt)
    }
    return imported
  })

  ipcMain.handle('commandSnippet:list', () => commandSnippetStore.list())

  ipcMain.handle('commandSnippet:save', (_event, snippet: CommandSnippet) => {
    return commandSnippetStore.save(snippet)
  })

  ipcMain.handle('commandSnippet:delete', (_event, id: string) => {
    return commandSnippetStore.delete(id)
  })

  ipcMain.handle('data:export', async (_event, preferences: ExportData['preferences']) => {
    const config = await configStore.load()
    const prompts = await promptStore.list()
    const commandSnippets = await commandSnippetStore.list()
    const includeKeysResult = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Continue', 'Cancel'],
      cancelId: 1,
      defaultId: 0,
      message: 'Export AI Terminal data',
      detail: 'Choose whether this export should include plaintext API keys.',
      checkboxLabel: 'Include API keys in export file',
      checkboxChecked: false
    })

    if (includeKeysResult.response === 1) return

    const apiKeys: Record<string, string> = {}
    if (includeKeysResult.checkboxChecked) {
      for (const provider of config.providers) {
        const apiKey = await getApiKey(provider.apiKeyRef)
        if (apiKey) apiKeys[provider.apiKeyRef] = apiKey
      }
    }

    const exportData: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      config,
      ...(Object.keys(apiKeys).length > 0 ? { apiKeys } : {}),
      prompts,
      commandSnippets,
      sshProfiles: config.sshProfiles ?? [],
      preferences
    }

    const saveResult = await dialog.showSaveDialog({
      title: 'Export AI Terminal Data',
      defaultPath: 'ai-terminal-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (saveResult.canceled || !saveResult.filePath) return
    await writeFile(saveResult.filePath, JSON.stringify(exportData, null, 2), 'utf8')
  })

  ipcMain.handle('data:import', async (): Promise<ImportResult | undefined> => {
    const openResult = await dialog.showOpenDialog({
      title: 'Import AI Terminal Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (openResult.canceled || openResult.filePaths.length === 0) return undefined

    const raw = await readFile(openResult.filePaths[0], 'utf8')
    const data = JSON.parse(raw) as Partial<ExportData>
    if (data.version !== 1) {
      throw new Error('Unsupported import file version')
    }

    const currentConfig = await configStore.load()
    const currentProviderRefs = new Set(currentConfig.providers.map((provider) => provider.apiKeyRef))
    const importedProviders = data.config?.providers ?? []
    const newProviders = importedProviders.filter((provider) => !currentProviderRefs.has(provider.apiKeyRef))
    const mergedConfig = {
      ...currentConfig,
      providers: [...currentConfig.providers, ...newProviders]
    }

    const currentPrompts = await promptStore.list()
    const currentPromptIds = new Set(currentPrompts.map((prompt) => prompt.id))
    const importedPrompts = Array.isArray(data.prompts) ? data.prompts : []
    const newPrompts = importedPrompts.filter((prompt) => !currentPromptIds.has(prompt.id))
    const snippetsAdded = await commandSnippetStore.importMany(
      Array.isArray(data.commandSnippets) ? data.commandSnippets : []
    )

    const newProviderRefs = new Set(newProviders.map((provider) => provider.apiKeyRef))
    if (data.apiKeys) {
      for (const [ref, apiKey] of Object.entries(data.apiKeys)) {
        if (newProviderRefs.has(ref)) {
          await saveApiKey(ref, apiKey)
        }
      }
    }

    await configStore.save(mergedConfig)
    for (const prompt of newPrompts) {
      await promptStore.save(prompt)
    }

    const currentSshProfiles = currentConfig.sshProfiles ?? []
    const currentSshIds = new Set(currentSshProfiles.map((p) => p.id))
    const importedSshProfiles = Array.isArray(data.sshProfiles) ? data.sshProfiles : []
    const newSshProfiles = importedSshProfiles.filter((p) => !currentSshIds.has(p.id))
    for (const profile of newSshProfiles) {
      await configStore.upsertSshProfile(profile)
    }

    return {
      providersAdded: newProviders.length,
      promptsAdded: newPrompts.length,
      commandSnippetsAdded: snippetsAdded,
      sshProfilesAdded: newSshProfiles.length,
      preferences: data.preferences
    }
  })

  ipcMain.on('llm:chatStream', (event, request: ChatStreamRequest) => {
    void streamChatCompletion(request, (chunk) => {
      if (chunk.reasoningContent) {
        event.sender.send('llm:chatStream:event', {
          requestId: request.requestId,
          type: 'reasoning',
          content: chunk.reasoningContent
        })
      }

      if (chunk.content) {
        event.sender.send('llm:chatStream:event', {
          requestId: request.requestId,
          type: 'chunk',
          content: chunk.content
        })
      }
    })
      .then(() => {
        event.sender.send('llm:chatStream:event', {
          requestId: request.requestId,
          type: 'done'
        })
      })
      .catch((error: unknown) => {
        event.sender.send('llm:chatStream:event', {
          requestId: request.requestId,
          type: 'error',
          message: error instanceof Error ? error.message : String(error)
        })
      })
  })
}

void app.whenReady().then(() => {
  registerIpc()
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
