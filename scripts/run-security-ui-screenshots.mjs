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
  await page.getByRole('button', { name: 'Безопасность' }).click()
  await page.getByRole('heading', { name: 'Безопасность' }).waitFor({ state: 'visible' })

  const secretMaskingSwitch = page.getByRole('switch', { name: 'Маскирование секретов' })
  await assertSwitch(secretMaskingSwitch, true)
  await capture(page, '01-default-protected.png')

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
  await capture(page, '02-no-active-protection.png')

  await secretMaskingSwitch.click()
  await page.getByText('Провайдер + Экран').waitFor({ state: 'visible' })
  assert.equal(await providerPayloads.isChecked(), true)
  assert.equal(await chatDisplay.isChecked(), true)
  await assertSwitch(secretMaskingSwitch, true)
  await capture(page, '03-reactivated-defaults.png')

  await providerPayloads.uncheck({ force: true })
  await chatDisplay.uncheck({ force: true })
  await strictContext.check({ force: true })
  await page.getByText('Защищено').waitFor({ state: 'visible' })
  await page.getByText('Строгий контекст', { exact: true }).waitFor({ state: 'visible' })
  await assertSwitch(secretMaskingSwitch, true)
  await capture(page, '04-strict-context-protected.png')

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
