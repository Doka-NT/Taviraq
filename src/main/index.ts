import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, screen, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AppConfig,
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
  SecretMaskingMode,
  SSHProfile,
  SSHProfileConfig,
  SummarizeConversationRequest
} from '@shared/types'
import { TerminalManager } from './services/TerminalManager'
import { ChatHistoryStore } from './services/chatHistoryStore'
import { ConfigStore, normalizeSecretMaskingMode } from './services/configStore'
import { PromptStore } from './services/promptStore'
import { CommandSnippetStore } from './services/commandSnippetStore'
import { SessionStateStore } from './services/sessionStateStore'
import { deleteApiKey, getApiKey, saveApiKey } from './services/secretStore'
import { assessCommandRisk, listModels, streamChatCompletion, summarizeConversation } from './services/llmService'
import { extractCommandProposals } from './utils/commandProposals'
import {
  maskTextForDisplay,
  resolveSecretPlaceholders,
  sanitizeSavedChatForStorage,
  type SecretMaskContext
} from './utils/secretMasking'
import { buildAccelerator } from '../shared/accelerator'

const userDataDir = process.env.TAVIRAQ_USER_DATA_DIR ?? process.env.AI_TERMINAL_USER_DATA_DIR

if (userDataDir) {
  app.setPath('userData', userDataDir)
}

let mainWindow: BrowserWindow | undefined
let isQuitting = false
let currentHideShortcut = ''
let isRecordingShortcut = false
let saveWindowBoundsTimer: NodeJS.Timeout | undefined
let quitWindowBoundsSave: Promise<void> | undefined
const configStore = new ConfigStore()
const promptStore = new PromptStore()
const commandSnippetStore = new CommandSnippetStore()
const sessionStateStore = new SessionStateStore()
const chatHistoryStore = new ChatHistoryStore()
const summarizeControllers = new Map<string, AbortController>()
const chatStreamControllers = new Map<string, AbortController>()
const secretContextsBySession = new Map<string, SecretMaskContext>()
const secretContextLocksBySession = new Map<string, Promise<void>>()
const terminalManager = new TerminalManager(() => mainWindow, (sessionId) => {
  secretContextsBySession.delete(sessionId)
  secretContextLocksBySession.delete(sessionId)
})
const OPEN_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])
const DEMO_MODE = process.env.TAVIRAQ_DEMO_MODE === '1' || process.env.AI_TERMINAL_DEMO_MODE === '1'
const demoProvider = {
  name: 'Taviraq Demo',
  providerType: 'openai' as const,
  baseUrl: 'https://demo.local',
  apiKeyRef: 'taviraq-demo',
  selectedModel: 'demo-agent',
  commandRiskModel: 'demo-safety'
}
const demoConfig: AppConfig = {
  providers: [demoProvider],
  activeProviderRef: demoProvider.apiKeyRef,
  hideShortcut: 'CommandOrControl+Shift+Space',
  secretMasking: {
    mode: 'on'
  },
  windowBounds: {
    width: 1440,
    height: 920
  }
}

let secretMaskingModeCache: SecretMaskingMode = normalizeSecretMaskingMode(demoConfig.secretMasking?.mode)

async function initializeSecretMaskingModeCache(): Promise<void> {
  if (DEMO_MODE) {
    updateSecretMaskingModeCache(demoConfig)
    return
  }

  updateSecretMaskingModeCache(await configStore.load())
}

function updateSecretMaskingModeCache(config: AppConfig): void {
  secretMaskingModeCache = normalizeSecretMaskingMode(config.secretMasking?.mode)
}

function getSecretMaskingMode(): SecretMaskingMode {
  return DEMO_MODE ? normalizeSecretMaskingMode(demoConfig.secretMasking?.mode) : secretMaskingModeCache
}

async function withSessionSecretContextLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  const previous = secretContextLocksBySession.get(sessionId) ?? Promise.resolve()
  let release = (): void => {}
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const queued = previous.catch(() => undefined).then(() => current)
  secretContextLocksBySession.set(sessionId, queued)

  await previous.catch(() => undefined)
  try {
    return await task()
  } finally {
    release()
    if (secretContextLocksBySession.get(sessionId) === queued) {
      secretContextLocksBySession.delete(sessionId)
    }
  }
}

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return OPEN_EXTERNAL_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}

async function openAllowedExternalUrl(url: string): Promise<void> {
  if (!isAllowedExternalUrl(url)) {
    throw new Error('Unsupported external URL')
  }

  await shell.openExternal(url)
}

async function sendDemoChatStream(
  event: Electron.IpcMainEvent,
  request: ChatStreamRequest,
  signal: AbortSignal
): Promise<void> {
  const lastMessage = request.messages.at(-1)?.content.toLowerCase() ?? ''
  const chunks = lastMessage.startsWith('command `')
    ? [
        'The command finished successfully.\n\n',
        'You can see the live PTY output on the left while I keep the result in the assistant thread. ',
        'This makes agent execution reviewable without hiding the terminal.'
      ]
    : lastMessage.includes('risk') || lastMessage.includes('safety') || lastMessage.includes('опас')
      ? [
          'I will pause before running a destructive cleanup command.\n\n',
          'Running:\n',
          '```bash\nrm -rf ./dist\n```'
        ]
      : [
          'I will inspect the local workspace and summarize what matters.\n\n',
          'Running:\n',
          '```bash\npwd\nprintf "\\nProject files:\\n"\nls -1 | sed -n "1,12p"\nprintf "\\nPackage scripts:\\n"\nnode -e "const p=require(\\"./package.json\\"); for (const [k,v] of Object.entries(p.scripts)) console.log(k + \\": \\" + v)"\n```'
        ]

  for (const content of chunks) {
    if (signal.aborted) return
    event.sender.send('llm:chatStream:event', {
      requestId: request.requestId,
      type: 'chunk',
      content
    })
    await new Promise((resolve) => setTimeout(resolve, 280))
  }
}

function beginQuit(): void {
  isQuitting = true
  terminalManager.killAll()
}

function finishQuit(): void {
  globalShortcut.unregisterAll()
  app.exit(0)
}

function requestQuit(): void {
  if (!isQuitting) {
    beginQuit()
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    finishQuit()
    return
  }
  app.quit()
}

function registerApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Quit Taviraq',
          accelerator: 'Command+Q',
          click: requestQuit
        }
      ]
    },
    {
      role: 'editMenu'
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => mainWindow?.webContents.toggleDevTools()
        }
      ]
    },
    {
      role: 'windowMenu'
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

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
    title: 'Taviraq',
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
    void openAllowedExternalUrl(details.url).catch((error: unknown) => {
      console.error('[open external url failed]', error)
    })
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
      input.meta &&
      input.alt &&
      !input.control &&
      !input.shift &&
      (input.key.toLowerCase() === 'i' || input.code === 'KeyI')
    ) {
      event.preventDefault()
      mainWindow?.webContents.toggleDevTools()
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
    const isQuitShortcut = key === 'q' || input.code === 'KeyQ'
    const isClearShortcut = key === 'k' || input.code === 'KeyK'
    const isSettingsShortcut = key === ',' || input.code === 'Comma'
    const isNewTabShortcut = key === 't' || input.code === 'KeyT'
    const isCloseTabShortcut = key === 'w' || input.code === 'KeyW'
    const tabShortcut = /^[1-9]$/.test(key) ? Number(key) : undefined
    let action: AppShortcutAction | undefined

    if (isQuitShortcut) {
      event.preventDefault()
      requestQuit()
      return
    }

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

    if (saveWindowBoundsTimer) {
      clearTimeout(saveWindowBoundsTimer)
      saveWindowBoundsTimer = undefined
    }

    if (!quitWindowBoundsSave) {
      e.preventDefault()
      quitWindowBoundsSave = saveWindowBounds()
        .catch((error: unknown) => {
          console.error('[window bounds save before quit failed]', error)
        })
        .finally(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy()
          }
          finishQuit()
        })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = undefined
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
  ipcMain.handle('config:load', async () => {
    const config = DEMO_MODE ? demoConfig : await configStore.load()
    updateSecretMaskingModeCache(config)
    return config
  })

  ipcMain.handle('config:setSecretMaskingMode', async (_event, mode: SecretMaskingMode) => {
    const normalizedMode = normalizeSecretMaskingMode(mode)
    if (DEMO_MODE) {
      demoConfig.secretMasking = { mode: normalizedMode }
      updateSecretMaskingModeCache(demoConfig)
      return demoConfig
    }

    const config = await configStore.updateSecretMaskingMode(normalizedMode)
    updateSecretMaskingModeCache(config)
    return config
  })

  ipcMain.handle('app:openExternalUrl', (_event, url: string) => {
    return openAllowedExternalUrl(url)
  })

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
  ipcMain.handle('chatHistory:save', async (_event, chat: SavedChat) => {
    const sanitizedChat = await sanitizeSavedChatForStorage(chat, getSecretMaskingMode())
    await chatHistoryStore.save(sanitizedChat)
  })
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

  ipcMain.handle('ssh:chooseIdentityFile', async (): Promise<string | undefined> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose SSH Identity File',
      properties: ['openFile', 'showHiddenFiles']
    })
    if (result.canceled || result.filePaths.length === 0) return undefined
    return result.filePaths[0]
  })

  ipcMain.handle('llm:saveProvider', async (_event, request: SaveLLMProviderRequest) => {
    if (DEMO_MODE) {
      return demoConfig
    }

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
    if (DEMO_MODE) {
      return [
        { id: 'demo-agent', ownedBy: 'Taviraq' },
        { id: 'demo-safety', ownedBy: 'Taviraq' }
      ]
    }

    if (request.apiKey?.trim()) {
      return saveApiKey(request.provider.apiKeyRef, request.apiKey.trim()).then(() => listModels(request.provider))
    }

    return listModels(request.provider)
  })

  ipcMain.handle('llm:assessCommandRisk', async (_event, request: CommandRiskAssessmentRequest) => {
    if (DEMO_MODE) {
      return {
        dangerous: /\brm\s+-rf\b|sudo|chmod\s+-r/i.test(request.command),
        reason: 'Demo safety model: this command can remove files recursively, so it requires explicit confirmation.'
      }
    }

    return assessCommandRisk(request, getSecretMaskingMode())
  })

  ipcMain.handle('llm:summarizeConversation', async (_event, request: SummarizeConversationRequest) => {
    if (DEMO_MODE) {
      return {
        name: 'Inspect terminal workspace',
        content: 'Inspect the current terminal workspace, run safe read-only commands when useful, and summarize the result.'
      }
    }

    const requestId = request.requestId
    const secretMaskingMode = getSecretMaskingMode()
    if (!requestId) return summarizeConversation(request, undefined, secretMaskingMode)

    const controller = new AbortController()
    summarizeControllers.set(requestId, controller)
    try {
      return await summarizeConversation(request, controller.signal, secretMaskingMode)
    } finally {
      summarizeControllers.delete(requestId)
    }
  })

  ipcMain.handle('llm:cancelSummarizeConversation', (_event, requestId: string) => {
    summarizeControllers.get(requestId)?.abort()
  })

  ipcMain.handle('llm:cancelChatStream', (_event, requestId: string) => {
    chatStreamControllers.get(requestId)?.abort()
  })

  ipcMain.handle('command:propose', (_event, text: string) => extractCommandProposals(text))

  ipcMain.handle('command:runConfirmed', (_event, sessionId: string, command: string) => {
    try {
      const resolvedCommand = resolveSecretPlaceholders(command, secretContextsBySession.get(sessionId))
      terminalManager.runConfirmed(sessionId, resolvedCommand, command)
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Unable to resolve local secret placeholders.')
    }
  })

  ipcMain.handle('secret:maskOutput', async (_event, sessionId: string, text: string) => {
    return withSessionSecretContextLock(sessionId, async () => {
      const result = await maskTextForDisplay(
        text,
        getSecretMaskingMode(),
        secretContextsBySession.get(sessionId)
      )
      if (result.context.bindings.length > (secretContextsBySession.get(sessionId)?.bindings.length ?? 0)) {
        secretContextsBySession.set(sessionId, result.context)
      }
      return result.text
    })
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
      message: 'Export Taviraq data',
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
      title: 'Export Taviraq Data',
      defaultPath: 'taviraq-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (saveResult.canceled || !saveResult.filePath) return
    await writeFile(saveResult.filePath, JSON.stringify(exportData, null, 2), 'utf8')
  })

  ipcMain.handle('data:import', async (): Promise<ImportResult | undefined> => {
    const openResult = await dialog.showOpenDialog({
      title: 'Import Taviraq Data',
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
    const mergedConfig: AppConfig = {
      ...currentConfig,
      secretMasking: data.config?.secretMasking ?? currentConfig.secretMasking,
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
    updateSecretMaskingModeCache(mergedConfig)
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
    const controller = new AbortController()
    chatStreamControllers.set(request.requestId, controller)

    if (DEMO_MODE) {
      void sendDemoChatStream(event, request, controller.signal)
        .then(() => {
          if (controller.signal.aborted) return
          event.sender.send('llm:chatStream:event', {
            requestId: request.requestId,
            type: 'done'
          })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          event.sender.send('llm:chatStream:event', {
            requestId: request.requestId,
            type: 'error',
            message: error instanceof Error ? error.message : String(error)
          })
        })
        .finally(() => {
          chatStreamControllers.delete(request.requestId)
        })
      return
    }

    void (async () => {
      try {
        const sessionId = request.context.session?.id
        const runStream = async (): Promise<void> => {
          const result = await streamChatCompletion(request, (chunk) => {
            if (chunk.type === 'privacy' && typeof chunk.maskedSecrets === 'number') {
              event.sender.send('llm:chatStream:event', {
                requestId: request.requestId,
                type: 'privacy',
                maskedSecrets: chunk.maskedSecrets
              })
            }

            if (chunk.type === 'progress' && chunk.stage && typeof chunk.progress === 'number') {
              event.sender.send('llm:chatStream:event', {
                requestId: request.requestId,
                type: 'progress',
                stage: chunk.stage,
                progress: chunk.progress
              })
            }

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
          }, controller.signal, getSecretMaskingMode(), sessionId ? secretContextsBySession.get(sessionId) : undefined)

          if (controller.signal.aborted) return
          if (sessionId && result.secretContext.bindings.length > 0) {
            secretContextsBySession.set(sessionId, result.secretContext)
          }
          event.sender.send('llm:chatStream:event', {
            requestId: request.requestId,
            type: 'done',
            ...(result.maskedContent ? { maskedContent: result.maskedContent } : {})
          })
        }

        if (sessionId) {
          await withSessionSecretContextLock(sessionId, runStream)
        } else {
          await runStream()
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        event.sender.send('llm:chatStream:event', {
          requestId: request.requestId,
          type: 'error',
          message: error instanceof Error ? error.message : String(error)
        })
      } finally {
        chatStreamControllers.delete(request.requestId)
      }
    })()
  })
}

void app.whenReady().then(async () => {
  await initializeSecretMaskingModeCache()
  registerApplicationMenu()
  registerIpc()
  void createWindow()

  app.on('activate', () => {
    if (isQuitting) return
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('before-quit', () => {
  beginQuit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
