import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const mainEntry = join(repoRoot, 'out/main/index.js')
const screenshotDir = join(repoRoot, 'screenshots/chat-tools-ui')

if (!existsSync(mainEntry)) {
  throw new Error('Build output is missing. Run `npm run build` before chat tools UI screenshots.')
}

await rm(screenshotDir, { recursive: true, force: true })
await mkdir(screenshotDir, { recursive: true })

const userDataDir = await mkdtemp(join(tmpdir(), 'taviraq-chat-tools-ui-'))

const app = await electron.launch({
  args: [repoRoot],
  env: {
    ...process.env,
    TAVIRAQ_DEMO_MODE: '1',
    TAVIRAQ_USER_DATA_DIR: userDataDir
  }
})

const screenshots = []

async function capture(page, name) {
  const path = join(screenshotDir, name)
  await page.locator('.settings-screen').screenshot({ path })
  screenshots.push(path)
}

try {
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1320, height: 900 })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[renderer] ${message.text()}`)
    }
  })

  await page.evaluate(() => {
    localStorage.setItem('taviraq.language', 'ru')
    localStorage.setItem('taviraq.sidebarVisible', 'true')
    localStorage.setItem('taviraq.sidebarWidth', '620')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell').waitFor({ state: 'visible' })

  await page.getByRole('button', { name: 'Настройки (⌘,)' }).click()
  await page.getByRole('button', { name: 'Инструменты чата' }).click()
  await page.getByRole('heading', { name: 'Инструменты чата' }).waitFor({ state: 'visible' })

  const taskListSwitch = page.getByRole('switch', { name: 'Список задач и планирование' })
  await taskListSwitch.waitFor({ state: 'visible' })

  // Off by default — agent mode behaviour is unchanged until the user opts in.
  assert.equal(await taskListSwitch.getAttribute('aria-checked'), 'false')
  await capture(page, '00-task-list-default-off.png')

  // Toggle on and confirm the switch reflects the enabled state.
  await taskListSwitch.click()
  await page.waitForFunction(() => {
    const el = document.querySelector('.settings-screen [role="switch"]')
    return el?.getAttribute('aria-checked') === 'true'
  })
  assert.equal(await taskListSwitch.getAttribute('aria-checked'), 'true')
  await capture(page, '01-task-list-enabled.png')

  console.log(`Saved ${screenshots.length} screenshot(s):`)
  for (const path of screenshots) console.log(`  ${path}`)
} finally {
  await app.close()
  await rm(userDataDir, { recursive: true, force: true })
}
