// SPDX-License-Identifier: MPL-2.0
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const mainEntry = join(repoRoot, 'out/main/index.js')
const screenshotDir = join(repoRoot, 'screenshots/telemetry-ui')

if (!existsSync(mainEntry)) {
  throw new Error('Build output is missing. Run `npm run build` before telemetry UI screenshots.')
}

await rm(screenshotDir, { recursive: true, force: true })
await mkdir(screenshotDir, { recursive: true })

const userDataDir = await mkdtemp(join(tmpdir(), 'taviraq-telemetry-ui-'))
const app = await electron.launch({
  args: [repoRoot],
  env: {
    ...process.env,
    TAVIRAQ_DEMO_MODE: '1',
    TAVIRAQ_USER_DATA_DIR: userDataDir
  }
})

const screenshots = []
async function captureLocator(locator, name) {
  const path = join(screenshotDir, name)
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  await locator.screenshot({ path })
  screenshots.push(path)
}

try {
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1320, height: 900 })
  await page.evaluate(() => {
    localStorage.setItem('taviraq.language', 'ru')
    localStorage.setItem('taviraq.sidebarVisible', 'true')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell').waitFor({ state: 'visible' })

  // 1) First-run opt-in consent prompt.
  const consent = page.locator('.telemetry-consent')
  await consent.waitFor({ state: 'visible' })
  await page.getByText('Помочь улучшить Taviraq?').waitFor({ state: 'visible' })
  await captureLocator(consent, '01-consent-prompt.png')

  // 2) Settings toggle, off state.
  await page.getByRole('button', { name: 'Настройки (⌘,)' }).click()
  await page.getByRole('button', { name: 'Безопасность' }).click()
  await page.getByRole('heading', { name: 'Безопасность' }).waitFor({ state: 'visible' })

  const telemetrySwitch = page.getByRole('switch', { name: 'Анонимная телеметрия использования' })
  const telemetryRow = page.locator('.security-row').filter({ has: telemetrySwitch })
  await telemetryRow.waitFor({ state: 'visible' })
  await page.getByText('Не отправляется', { exact: true }).waitFor({ state: 'visible' })
  await captureLocator(telemetryRow, '02-settings-toggle-off.png')

  // 3) Settings toggle, on state after opting in.
  await telemetrySwitch.click()
  await page.getByText('Отправляется', { exact: true }).waitFor({ state: 'visible' })
  await captureLocator(telemetryRow, '03-settings-toggle-on.png')

  const reportPath = join(screenshotDir, 'report.json')
  await writeFile(reportPath, JSON.stringify({ screenshots }, null, 2))
  console.log(`Telemetry UI screenshots saved to ${screenshotDir}`)
} finally {
  await app.close()
  await rm(userDataDir, { recursive: true, force: true })
}
