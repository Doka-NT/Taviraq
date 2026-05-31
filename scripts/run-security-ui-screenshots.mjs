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
const screenshotDir = join(repoRoot, 'screenshots/security-ui')

if (!existsSync(mainEntry)) {
  throw new Error('Build output is missing. Run `npm run build` before security UI screenshots.')
}

await rm(screenshotDir, { recursive: true, force: true })
await mkdir(screenshotDir, { recursive: true })

const userDataDir = await mkdtemp(join(tmpdir(), 'taviraq-security-ui-'))
await writeFile(join(userDataDir, 'session-state.json'), JSON.stringify({
  version: 1,
  savedAt: new Date().toISOString(),
  activeSessionId: 'security-ui-session',
  sessions: [{
    id: 'security-ui-session',
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
    'security-ui-session': {
      messages: [{
        role: 'assistant',
        content: '2 secret(s) masked before sending to LLM.',
        display: 'privacy-status',
        output: '2',
        privacy: {
          maskedSecretCount: 2,
          categories: ['GENERIC_API_KEY', 'password'],
          source: 'chat-stream',
          scope: 'provider-payload',
          sessionLabel: 'Local'
        }
      }],
      draft: '',
      session: {
        id: 'security-ui-session',
        kind: 'local',
        label: 'Local',
        cwd: repoRoot,
        shell: '/bin/zsh'
      }
    }
  }
}, null, 2), 'utf8')
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

async function captureLocator(locator, name) {
  const path = join(screenshotDir, name)
  await locator.screenshot({ path })
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

  const permissionSummary = page.locator('.permission-summary')
  await permissionSummary.waitFor({ state: 'visible' })
  assert.equal(await page.locator('.permission-chip').count(), 0)
  assert.equal(await page.locator('.live-status-chip').count(), 0)
  await page.locator('.shell-readout-label').getByText('Local').waitFor({ state: 'visible' })
  const permissionIndicator = page.locator('.permission-indicator')
  await permissionIndicator.getByText('R+X').waitFor({ state: 'visible' })
  assert.match(await permissionIndicator.getAttribute('title') ?? '', /выполняет команды/)
  const composerStatus = page.locator('.composer-status-chip')
  assert.equal(await composerStatus.count(), 0)
  await captureLocator(page.locator('.llm-panel'), '00-permission-summary-no-idle-panel.png')

  const privacyCard = page.locator('.privacy-trust-card').first()
  await privacyCard.waitFor({ state: 'visible' })
  assert.equal(await page.locator('.privacy-trust-card').count(), 1)
  const collapsedPrivacyBox = await privacyCard.boundingBox()
  assert.ok(collapsedPrivacyBox && collapsedPrivacyBox.height <= 44, 'privacy badge should stay compact when collapsed')
  const privacyTitleFontSize = await privacyCard.locator('.privacy-trust-card-title strong').evaluate((node) => (
    Number.parseFloat(window.getComputedStyle(node).fontSize)
  ))
  const messageFontSize = await page.evaluate(() => (
    Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--app-text-size') || '13.5') - 1
  ))
  assert.ok(privacyTitleFontSize < messageFontSize, 'privacy badge title should stay smaller than assistant message text')
  await captureLocator(privacyCard, '00-privacy-trust-card-collapsed.png')
  await privacyCard.locator('.privacy-trust-card-header').click()
  await page.getByText('Категории').waitFor({ state: 'visible' })
  await page.getByText('Generic Api Key').waitFor({ state: 'visible' })
  await page.getByText('Настройки безопасности').waitFor({ state: 'visible' })
  await captureLocator(privacyCard, '01-privacy-trust-card-expanded.png')

  await page.getByRole('button', { name: 'Настройки (⌘,)' }).click()
  await page.getByRole('button', { name: 'Безопасность' }).click()
  await page.getByRole('heading', { name: 'Безопасность' }).waitFor({ state: 'visible' })

  const secretMaskingSwitch = page.getByRole('switch', { name: 'Маскирование секретов' })
  await assertSwitch(secretMaskingSwitch, true)
  await capture(page, '02-default-protected.png')

  const providerPayloads = controlInput(page, 'Запросы провайдеру')
  const chatDisplay = controlInput(page, 'Отображение чата')
  const strictContext = controlInput(page, 'Строгий контекст терминала')
  await providerPayloads.uncheck({ force: true })
  await chatDisplay.uncheck({ force: true })
  if (await strictContext.isChecked()) {
    await strictContext.uncheck({ force: true })
  }

  await page.getByText('Нет активной защиты').waitFor({ state: 'visible' })
  await page.getByText('Ничего не защищено, пока не включена хотя бы одна область.').waitFor({ state: 'visible' })
  await assertSwitch(secretMaskingSwitch, false)
  await capture(page, '03-no-active-protection.png')

  await secretMaskingSwitch.click()
  await page.getByText('Провайдер + Экран').waitFor({ state: 'visible' })
  assert.equal(await providerPayloads.isChecked(), true)
  assert.equal(await chatDisplay.isChecked(), true)
  await assertSwitch(secretMaskingSwitch, true)
  await capture(page, '04-reactivated-defaults.png')

  await providerPayloads.uncheck({ force: true })
  await chatDisplay.uncheck({ force: true })
  await strictContext.check({ force: true })
  await page.getByText('Защищено').waitFor({ state: 'visible' })
  await page.getByText('Строгий контекст', { exact: true }).waitFor({ state: 'visible' })
  await assertSwitch(secretMaskingSwitch, true)
  await capture(page, '05-strict-context-protected.png')

  await page.getByRole('button', { name: 'Закрыть настройки' }).click()
  await page.locator('.settings-screen').waitFor({ state: 'hidden' })
  await permissionIndicator.getByText('X', { exact: true }).waitFor({ state: 'visible' })
  assert.match(await permissionIndicator.getAttribute('title') ?? '', /Выполняет команды/)
  assert.equal(await composerStatus.count(), 0)
  await captureLocator(page.locator('.llm-panel'), '05-strict-context-execute-only-no-idle-panel.png')

  const reportPath = join(screenshotDir, 'report.json')
  await writeFile(reportPath, JSON.stringify({ screenshots }, null, 2))
  console.log(`Security UI screenshots saved to ${screenshotDir}`)
} finally {
  await app.close()
  await rm(userDataDir, { recursive: true, force: true })
}

async function assertSwitch(locator, checked) {
  await locator.waitFor({ state: 'visible' })
  assert.equal(await locator.getAttribute('aria-checked'), checked ? 'true' : 'false')
}

function controlInput(page, label) {
  return page.locator('.security-control').filter({
    has: page.getByText(label, { exact: true })
  }).locator('input')
}
