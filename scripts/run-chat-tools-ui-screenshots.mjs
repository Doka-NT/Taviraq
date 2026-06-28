// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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

// Seed a session whose assistant turn carries a task list + detailed plan, so
// the derived checklist panel renders with real content.
const taskListMessage = [
  'Понял задачу, вот план:',
  '',
  '```tasklist',
  '- [x] Прочитать конфигурацию',
  '- [-] Проверить подключение к серверу',
  '- [ ] Перезапустить сервис',
  '- [ ] Проверить логи',
  '```',
  '',
  'Начинаю со второго шага.',
  '',
  '```taskplan',
  '# План',
  '1. Прочитать ~/.app/config.yml и убедиться, что хост задан.',
  '2. Выполнить health-check эндпоинта.',
  '3. systemctl restart app.',
  '4. journalctl -u app -n 50 для проверки.',
  '```'
].join('\n')

await writeFile(join(userDataDir, 'session-state.json'), JSON.stringify({
  version: 1,
  savedAt: new Date().toISOString(),
  activeSessionId: 'chat-tools-session',
  sessions: [{
    id: 'chat-tools-session',
    kind: 'local',
    label: 'Local',
    cwd: repoRoot,
    shell: '/bin/zsh',
    command: '/bin/zsh',
    createdAt: Date.now(),
    status: 'running',
    output: ''
  }],
  assistantThreads: {
    'chat-tools-session': {
      messages: [
        { role: 'user', content: 'Перезапусти сервис и проверь, что он поднялся.' },
        { role: 'assistant', content: taskListMessage }
      ],
      draft: '',
      session: { id: 'chat-tools-session', kind: 'local', label: 'Local', cwd: repoRoot, shell: '/bin/zsh' }
    }
  }
}), 'utf8')

const app = await electron.launch({
  args: [repoRoot],
  env: {
    ...process.env,
    TAVIRAQ_DEMO_MODE: '1',
    TAVIRAQ_USER_DATA_DIR: userDataDir
  }
})

const screenshots = []

async function captureSettings(page, name) {
  const path = join(screenshotDir, name)
  await page.locator('.settings-screen').screenshot({ path })
  screenshots.push(path)
}

async function captureLocator(locator, name) {
  const path = join(screenshotDir, name)
  await locator.screenshot({ path })
  screenshots.push(path)
}

try {
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1320, height: 900 })
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[renderer] ${message.text()}`)
  })

  await page.evaluate(() => {
    localStorage.setItem('taviraq.language', 'ru')
    localStorage.setItem('taviraq.sidebarVisible', 'true')
    localStorage.setItem('taviraq.sidebarWidth', '640')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell').waitFor({ state: 'visible' })

  // 1. Settings → Chat Tools, toggle off by default.
  await page.getByRole('button', { name: 'Настройки (⌘,)' }).click()
  await page.getByRole('button', { name: 'Инструменты чата' }).click()
  await page.getByRole('heading', { name: 'Инструменты чата' }).waitFor({ state: 'visible' })

  const taskListSwitch = page.getByRole('switch', { name: 'Список задач и планирование' })
  await taskListSwitch.waitFor({ state: 'visible' })
  assert.equal(await taskListSwitch.getAttribute('aria-checked'), 'false')
  await captureSettings(page, '00-task-list-default-off.png')

  // 2. Enable it.
  await taskListSwitch.click()
  await page.waitForFunction(() => (
    document.querySelector('.settings-screen [role="switch"]')?.getAttribute('aria-checked') === 'true'
  ))
  await captureSettings(page, '01-task-list-enabled.png')

  // 3. Close settings; the seeded conversation shows the checklist panel.
  //    The panel is collapsed by default: only the in-progress step + progress
  //    counter are visible; the pending steps stay hidden behind `hidden` +
  //    `.task-list-items:not([hidden]) { display: grid }` (otherwise the author
  //    `display:grid` would override `[hidden] { display:none }`).
  await page.getByRole('button', { name: 'Закрыть настройки' }).click()
  await page.locator('.settings-screen').waitFor({ state: 'hidden' })
  const panel = page.locator('.task-list-panel')
  await panel.waitFor({ state: 'visible' })
  const toggle = panel.locator('.task-list-toggle')
  await toggle.waitFor({ state: 'visible' })
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
  await panel.locator('.task-list-current-step').getByText('Проверить подключение к серверу').waitFor({ state: 'visible' })
  // Pending step exists in the DOM but must NOT be visible while collapsed.
  await panel.getByText('Перезапустить сервис').waitFor({ state: 'hidden' })
  await panel.getByRole('button', { name: 'Показать план в Finder' }).waitFor({ state: 'visible' })
  await captureLocator(panel, '02-task-list-collapsed.png')
  await captureLocator(page.locator('.llm-panel'), '03-task-list-collapsed-in-chat.png')

  // 4. Expand via the toggle: every step is now laid out and visible.
  await toggle.click()
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
  await panel.getByText('Перезапустить сервис').waitFor({ state: 'visible' })
  await panel.getByText('Проверить логи').waitFor({ state: 'visible' })
  await captureLocator(panel, '04-task-list-expanded.png')

  console.log(`Saved ${screenshots.length} screenshot(s):`)
  for (const path of screenshots) console.log(`  ${path}`)
} finally {
  await app.close()
  await rm(userDataDir, { recursive: true, force: true })
}
