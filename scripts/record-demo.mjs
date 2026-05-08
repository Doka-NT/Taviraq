#!/usr/bin/env node
import { _electron as playwrightElectron } from 'playwright'
import electronBinary from 'electron'
import { spawnSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const artifactsDir = join(projectRoot, 'demo-artifacts')
const framesDir = join(artifactsDir, 'frames')
const userDataDir = join(tmpdir(), `ai-terminal-demo-${process.pid}`)
const outputMp4 = join(artifactsDir, 'ai-terminal-demo.mp4')
const outputGif = join(artifactsDir, 'ai-terminal-demo.gif')
const makeGif = process.argv.includes('--gif')
const skipBuild = process.argv.includes('--no-build')
const fps = 30
const viewport = { width: 1920, height: 1080 }

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
    ...options
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

function quietRun(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8'
  })
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function startFrameRecorder(page) {
  let frame = 0
  let stopped = false
  let capturing = Promise.resolve()
  const startedAt = performance.now()

  const capture = async () => {
    if (stopped) return
    frame += 1
    const framePath = join(framesDir, `frame-${String(frame).padStart(5, '0')}.png`)
    await page.screenshot({ path: framePath })
  }

  const timer = setInterval(() => {
    capturing = capturing.then(capture).catch((error) => {
      stopped = true
      clearInterval(timer)
      console.error('[record-demo] frame capture failed:', error)
    })
  }, 1000 / fps)

  await capture()

  return async () => {
    stopped = true
    clearInterval(timer)
    await capturing
    const durationSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001)
    const actualFps = frame / durationSeconds
    return { frameCount: frame, durationSeconds, actualFps }
  }
}

async function typeInTerminal(page, text) {
  await page.locator('.terminal-container').click()
  await page.keyboard.type(text, { delay: 18 })
  await page.keyboard.press('Enter')
}

async function sendAssistantMessage(page, text) {
  const input = page.locator('.chat-form textarea')
  await input.click()
  await input.fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

async function prepareDemoPreferences(page) {
  await page.evaluate(() => {
    localStorage.setItem('ai-terminal.textSize', '17')
    localStorage.setItem('ai-terminal.sidebarWidth', '480')
    localStorage.setItem('ai-terminal.sidebarVisible', 'true')
    localStorage.setItem('ai-terminal.restoreSessions', 'false')
    localStorage.setItem('ai-terminal.language', 'en')
  })
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.locator('.terminal-container').waitFor({ timeout: 20_000 })
}


async function main() {
  await rm(framesDir, { recursive: true, force: true })
  await rm(userDataDir, { recursive: true, force: true })
  await mkdir(framesDir, { recursive: true })

  if (!skipBuild) {
    console.log('[record-demo] Building app...')
    run('npm', ['run', 'build'])
  }

  console.log('[record-demo] Launching Electron in demo mode...')
  const app = await playwrightElectron.launch({
    executablePath: electronBinary,
    args: [projectRoot],
    env: {
      ...process.env,
      AI_TERMINAL_DEMO_MODE: '1',
      AI_TERMINAL_USER_DATA_DIR: userDataDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
  let recordingStats

  try {
    const page = await app.firstWindow()
    await page.setViewportSize(viewport)
    await page.waitForLoadState('domcontentloaded')
    await page.locator('.terminal-container').waitFor({ timeout: 20_000 })
    await prepareDemoPreferences(page)
    await sleep(1200)

    const stopRecording = await startFrameRecorder(page)

    await typeInTerminal(page, `cd ${JSON.stringify(projectRoot)}`)
    await sleep(900)
    await typeInTerminal(page, 'printf "AI Terminal demo\\nLocal PTY session is live\\n"')
    await sleep(1300)
    await typeInTerminal(page, 'node -v && pwd')
    await sleep(1400)

    await sendAssistantMessage(page, 'Inspect this workspace and show the main package scripts.')
    await page.locator('.command-output-message').waitFor({ timeout: 20_000 })
    await sleep(3500)

    await sendAssistantMessage(page, 'Show how safety review works with a risky cleanup command.')
    await page.locator('.command-confirmation-card').waitFor({ timeout: 15_000 })
    await sleep(2200)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await sleep(1400)

    await page.locator('.panel-action-button[title="Settings"]').click()
    await page.locator('.settings-screen').waitFor({ timeout: 10_000 })
    await sleep(1000)
    await page.getByText('Appearance', { exact: true }).click()
    await sleep(900)
    await page.getByText('Providers', { exact: true }).click()
    await sleep(900)
    await page.getByText('Prompts', { exact: true }).click()
    await sleep(900)
    await page.locator('button[title="Close settings"]').click()
    await sleep(900)

    recordingStats = await stopRecording()
    console.log(
      `[record-demo] Captured ${recordingStats.frameCount} frames in ${recordingStats.durationSeconds.toFixed(1)}s ` +
      `(${recordingStats.actualFps.toFixed(2)} fps).`
    )
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }

  if (quietRun('ffmpeg', ['-version']).status !== 0) {
    console.log(`[record-demo] ffmpeg not found. PNG frames are in ${framesDir}`)
    return
  }

  console.log('[record-demo] Rendering MP4...')
  const inputFramerate = recordingStats?.actualFps.toFixed(3) ?? String(fps)
  run('ffmpeg', [
    '-y',
    '-framerate', inputFramerate,
    '-i', join(framesDir, 'frame-%05d.png'),
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-r', String(fps),
    '-c:v', 'libx264',
    '-preset', 'veryslow',
    '-crf', '10',
    '-tune', 'animation',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-movflags', '+faststart',
    outputMp4
  ])

  if (makeGif) {
    console.log('[record-demo] Rendering GIF...')
    run('ffmpeg', [
      '-y',
      '-i', outputMp4,
      '-vf', 'fps=15,scale=1440:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=sierra2_4a',
      outputGif
    ])
  }

  console.log(`[record-demo] Done: ${outputMp4}`)
  if (makeGif && existsSync(outputGif)) {
    console.log(`[record-demo] GIF: ${outputGif}`)
  }
}

main().catch((error) => {
  console.error('[record-demo]', error)
  process.exit(1)
})
