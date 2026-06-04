import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '@shared/types'

const { autoUpdater } = electronUpdater

const UPDATE_STATUS_CHANNEL = 'update:status'
/** Re-check the feed periodically while the app stays open (6 hours). */
const PERIODIC_CHECK_MS = 6 * 60 * 60 * 1000

let initialized = false
let lastStatus: UpdateStatus = { state: 'idle' }
let getWindow: () => BrowserWindow | undefined = () => undefined
let periodicTimer: NodeJS.Timeout | undefined

function publishStatus(status: UpdateStatus): void {
  lastStatus = status
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(UPDATE_STATUS_CHANNEL, status)
  }
}

/** Auto-update only makes sense for packaged, signed macOS builds with a release feed. */
function isUpdateSupported(): boolean {
  return app.isPackaged && process.platform === 'darwin'
}

function registerListeners(): void {
  autoUpdater.on('checking-for-update', () => {
    publishStatus({ state: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    publishStatus({ state: 'available', version: info?.version })
  })
  autoUpdater.on('update-not-available', () => {
    publishStatus({ state: 'not-available' })
  })
  autoUpdater.on('download-progress', (progress) => {
    publishStatus({
      state: 'downloading',
      percent: typeof progress?.percent === 'number' ? Math.round(progress.percent) : undefined
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    publishStatus({ state: 'downloaded', version: info?.version })
  })
  autoUpdater.on('error', (error) => {
    publishStatus({ state: 'error', error: error?.message ?? String(error) })
  })
}

/**
 * Wire up electron-updater. Downloads happen automatically; the update is staged
 * and installed on the next quit, with a renderer prompt offering an immediate restart.
 */
export function initAutoUpdates(windowGetter: () => BrowserWindow | undefined): void {
  getWindow = windowGetter
  if (initialized || !isUpdateSupported()) {
    return
  }
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  registerListeners()

  void checkForUpdates()
  periodicTimer = setInterval(() => {
    void checkForUpdates()
  }, PERIODIC_CHECK_MS)
  periodicTimer.unref?.()
}

export async function checkForUpdates(): Promise<void> {
  if (!isUpdateSupported()) {
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    publishStatus({ state: 'error', error: error instanceof Error ? error.message : String(error) })
  }
}

export function getUpdateStatus(): UpdateStatus {
  return lastStatus
}

/** Restart now and apply a downloaded update. No-op until an update has finished downloading. */
export function quitAndInstall(): void {
  if (lastStatus.state !== 'downloaded') {
    return
  }
  setImmediate(() => autoUpdater.quitAndInstall())
}

export function disposeAutoUpdates(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = undefined
  }
}
