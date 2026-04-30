import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type {
  AppShortcutAction,
  ChatStreamRequest,
  CommandRiskAssessmentRequest,
  CreateTerminalRequest,
  SaveLLMProviderRequest,
  SSHProfile
} from '@shared/types'
import { TerminalManager } from './services/TerminalManager'
import { ConfigStore } from './services/configStore'
import { saveApiKey } from './services/secretStore'
import { assessCommandRisk, listModels, streamChatCompletion } from './services/llmService'
import { extractCommandProposals } from './utils/commandProposals'

let mainWindow: BrowserWindow | undefined
const terminalManager = new TerminalManager(() => mainWindow)
const configStore = new ConfigStore()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
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
      nodeIntegration: false
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
    if (
      input.type !== 'keyDown' ||
      !input.meta ||
      input.control ||
      input.alt ||
      input.shift ||
      input.isAutoRepeat
    ) {
      return
    }

    const key = input.key.toLowerCase()
    const isClearShortcut = key === 'k' || input.code === 'KeyK'
    const isSettingsShortcut = key === ',' || input.code === 'Comma'
    const isNewTabShortcut = key === 't' || input.code === 'KeyT'
    const isCloseTabShortcut = key === 'w' || input.code === 'KeyW'
    let action: AppShortcutAction | undefined

    if (isClearShortcut) {
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

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('config:load', () => configStore.load())

  ipcMain.handle('terminal:create', (_event, request?: CreateTerminalRequest) => {
    return terminalManager.createLocal(request)
  })

  ipcMain.handle('terminal:list', () => terminalManager.list())

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

  ipcMain.handle('llm:saveProvider', async (_event, request: SaveLLMProviderRequest) => {
    if (request.apiKey?.trim()) {
      await saveApiKey(request.provider.apiKeyRef, request.apiKey.trim())
    }

    return configStore.upsertProvider(request.provider)
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

  ipcMain.handle('command:propose', (_event, text: string) => extractCommandProposals(text))

  ipcMain.handle('command:runConfirmed', (_event, sessionId: string, command: string) => {
    terminalManager.runConfirmed(sessionId, command)
  })

  ipcMain.on('llm:chatStream', (event, request: ChatStreamRequest) => {
    void streamChatCompletion(request, (content) => {
      event.sender.send('llm:chatStream:event', {
        requestId: request.requestId,
        type: 'chunk',
        content
      })
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
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
