#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * AI-driven PR QA runner — thin Playwright executor for step JSON.
 *
 * Usage:
 *   node scripts/qa-pr-ai.mjs <pr-number> --steps <file.json>
 *   node scripts/qa-pr-ai.mjs <pr-number> --steps <file.json> --screenshot-dir <dir>
 *   node scripts/qa-pr-ai.mjs <pr-number>           # smoke-only, no custom steps
 *
 * Step JSON: array of step objects — see docs/qa/pr-qa-runbook.md for schema.
 *
 * Outputs screenshot paths to stdout (one per line).
 * Writes report.json to the screenshot directory.
 * Exits 1 if any step failed.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const mainEntry = join(repoRoot, 'out/main/index.js')

// --- CLI parsing ---
const [, , prArg, ...rest] = process.argv
const pr = prArg ?? 'unknown'
const flag = (name) => { const i = rest.indexOf(name); return i !== -1 ? rest[i + 1] : null }
const stepsFile = flag('--steps')
const screenshotDir = flag('--screenshot-dir') ?? join(repoRoot, 'screenshots', `qa-pr-${pr}`)

if (!existsSync(mainEntry)) {
  console.error('Build output missing — run `npm run build` first.')
  process.exit(1)
}

let steps = []
if (stepsFile) {
  steps = JSON.parse(await readFile(resolve(stepsFile), 'utf8'))
}

await rm(screenshotDir, { recursive: true, force: true })
await mkdir(screenshotDir, { recursive: true })

// --- Seed isolated app state ---
const userDataDir = await mkdtemp(join(tmpdir(), `taviraq-qa-pr-${pr}-`))
const sessionId = `qa-pr-${pr}`

await writeFile(join(userDataDir, 'session-state.json'), JSON.stringify({
  version: 1,
  savedAt: new Date().toISOString(),
  activeSessionId: sessionId,
  sessions: [{
    id: sessionId,
    kind: 'local',
    label: 'QA Session',
    cwd: repoRoot,
    shell: '/bin/zsh',
    command: '/bin/zsh',
    createdAt: Date.now(),
    status: 'running',
    output: `PR #${pr} QA session\n$ echo ready\nready\n`
  }],
  assistantThreads: {
    [sessionId]: {
      draft: '',
      session: { id: sessionId, kind: 'local', label: 'QA Session', cwd: repoRoot, shell: '/bin/zsh' },
      messages: [
        {
          role: 'assistant',
          content: '2 secret(s) masked before sending to LLM.',
          display: 'privacy-status',
          output: '2',
          privacy: {
            maskedSecretCount: 2,
            categories: ['GENERIC_API_KEY', 'password'],
            source: 'chat-stream',
            scope: 'provider-payload',
            sessionLabel: 'QA Session'
          }
        },
        { role: 'assistant', content: `QA smoke for PR #${pr}.` }
      ]
    }
  }
}, null, 2), 'utf8')

// --- Launch Electron ---
const app = await electron.launch({
  args: [repoRoot],
  env: { ...process.env, TAVIRAQ_DEMO_MODE: '1', TAVIRAQ_USER_DATA_DIR: userDataDir }
})

const allScreenshots = []
const results = []

async function snap(page, name) {
  const file = join(screenshotDir, name.endsWith('.png') ? name : `${name}.png`)
  await page.screenshot({ path: file })
  allScreenshots.push(file)
  return file
}

async function exec(page, step, idx) {
  const timeout = step.timeout ?? 5000

  switch (step.action) {
    case 'screenshot':
      return { screenshotPath: await snap(page, step.name ?? `step-${idx}`) }

    case 'click':
      if (step.text) {
        await page.getByText(step.text, { exact: !!step.exact }).first().click({ timeout })
      } else {
        await page.locator(step.selector).first().click({ timeout })
      }
      break

    case 'click_role':
      await page.getByRole(step.role, { name: step.accessible_name }).first().click({ timeout })
      break

    case 'type':
      await page.locator(step.selector).type(step.value ?? '', { timeout })
      break

    case 'fill':
      await page.locator(step.selector).fill(step.value ?? '', { timeout })
      break

    case 'press':
      await page.keyboard.press(step.key)
      break

    case 'wait_for':
      await page.locator(step.selector).waitFor({ state: step.state ?? 'visible', timeout })
      break

    case 'wait_ms':
      await page.waitForTimeout(step.ms ?? 300)
      break

    case 'assert_visible':
      await page.locator(step.selector).first().waitFor({ state: 'visible', timeout })
      break

    case 'assert_text': {
      const loc = step.selector
        ? page.locator(step.selector).filter({ hasText: step.text })
        : page.getByText(step.text, { exact: !!step.exact })
      await loc.first().waitFor({ state: 'visible', timeout })
      break
    }

    case 'assert_count': {
      const count = await page.locator(step.selector).count()
      assert.ok(
        count >= (step.min ?? 1),
        `assert_count: "${step.selector}" has ${count}, expected >= ${step.min ?? 1}`
      )
      break
    }

    case 'set_localStorage':
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), [step.key, step.value])
      break

    case 'reload':
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 10000 })
      break

    case 'set_viewport':
      await page.setViewportSize({ width: step.width, height: step.height })
      break

    default:
      throw new Error(`Unknown action: "${step.action}"`)
  }
  return {}
}

// --- Run ---
try {
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1320, height: 900 })
  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[renderer] ${msg.text()}`)
  })

  await page.evaluate(() => {
    localStorage.setItem('taviraq.language', 'ru')
    localStorage.setItem('taviraq.sidebarVisible', 'true')
    localStorage.setItem('taviraq.sidebarWidth', '620')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(500)

  const initPath = await snap(page, '00-initial.png')
  results.push({ idx: 0, label: 'initial', action: 'screenshot', status: 'pass', screenshotPath: initPath, error: null })

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const label = step.name ?? `step-${String(i + 1).padStart(2, '0')}`
    const r = { idx: i + 1, label, action: step.action, status: 'pass', screenshotPath: null, error: null }
    results.push(r)
    console.error(`  [${String(i + 1).padStart(2, '0')}] ${step.action}  ${label}`)

    try {
      const extra = await exec(page, step, String(i + 1).padStart(2, '0'))
      if (extra?.screenshotPath) r.screenshotPath = extra.screenshotPath
      if (step.screenshot_after) {
        r.screenshotPath = await snap(page, step.screenshot_after)
      }
    } catch (err) {
      r.status = 'fail'
      r.error = err.message
      console.error(`    ✗ ${err.message}`)
      r.screenshotPath = await snap(page,
        `fail-${String(i + 1).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`
      ).catch(() => null)
    }
  }

  const finalPath = await snap(page, '99-final.png')
  results.push({ idx: steps.length + 1, label: 'final', action: 'screenshot', status: 'pass', screenshotPath: finalPath, error: null })

} finally {
  await app.close().catch(() => {})
  await rm(userDataDir, { recursive: true, force: true })
}

// --- Report ---
const passed = results.filter(r => r.status === 'pass').length
const failed = results.filter(r => r.status === 'fail').length
const report = { pr, screenshotDir, summary: { total: results.length, passed, failed }, steps: results }

await writeFile(join(screenshotDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(allScreenshots.join('\n'))
console.error(`\nPR #${pr} QA: ${passed} passed, ${failed} failed`)
console.error(`Report: ${screenshotDir}/report.json`)

if (failed > 0) process.exit(1)
