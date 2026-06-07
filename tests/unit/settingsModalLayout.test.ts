// SPDX-License-Identifier: MPL-2.0
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const styles = readFileSync(join(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

function getCssRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]+)\\}`).exec(styles)
  return match?.groups?.body ?? ''
}

describe('settings modal layout', () => {
  it('keeps the Settings frame at one canonical viewport-bounded size', () => {
    const settingsScreenRule = getCssRule('.settings-screen')

    expect(settingsScreenRule).toContain('--settings-modal-width: 860px')
    expect(settingsScreenRule).toContain('--settings-modal-height: 760px')
    expect(settingsScreenRule).toContain('inline-size: min(var(--settings-modal-width), 100%, calc(100vw - 32px))')
    expect(settingsScreenRule).toContain('block-size: min(var(--settings-modal-height), calc(100vh - 32px))')
    expect(settingsScreenRule).not.toMatch(/\b(width|height):\s*(auto|fit-content|max-content|min-content)/)
  })
})
