import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const mainEntry = join(repoRoot, 'out/main/index.js')

if (!existsSync(mainEntry)) {
  throw new Error('Build output is missing. Run `npm run build` before the MCP production smoke test.')
}

const userDataDir = await mkdtemp(join(tmpdir(), 'taviraq-prod-mcp-settings-'))
const app = await electron.launch({
  args: [repoRoot],
  env: {
    ...process.env,
    TAVIRAQ_DEMO_MODE: '1',
    TAVIRAQ_USER_DATA_DIR: userDataDir
  }
})

try {
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1320, height: 900 })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[renderer] ${message.text()}`)
    }
  })

  await page.evaluate(() => {
    localStorage.setItem('taviraq.language', 'en')
    localStorage.setItem('taviraq.sidebarVisible', 'true')
    localStorage.setItem('taviraq.sidebarWidth', '620')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 })

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.locator('.settings-screen').waitFor({ state: 'visible', timeout: 10_000 })

  const navItems = await page.locator('.settings-nav-item').allTextContents()
  assert.ok(navItems.includes('MCP'), `Expected MCP settings tab in production build. Found: ${navItems.join(', ')}`)

  await page.getByRole('button', { name: 'MCP', exact: true }).click()
  await page.getByRole('heading', { name: 'MCP servers', exact: true }).waitFor({ state: 'visible', timeout: 5_000 })

  console.log('Production MCP settings smoke test passed.')
} finally {
  await app.close()
  await rm(userDataDir, { recursive: true, force: true })
}
