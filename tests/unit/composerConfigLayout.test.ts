import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const styles = readFileSync(resolve(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

function cssRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(^|\\n)${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, 's').exec(styles)
  expect(match).toBeTruthy()
  return match?.groups?.body ?? ''
}

describe('composer config layout', () => {
  it('keeps the assistant controls popover in the composer flow', () => {
    const footerRule = cssRule('.chat-composer-footer')
    const controlRule = cssRule('.composer-config-control')
    const popoverRule = cssRule('.composer-config-popover')
    const actionsRule = cssRule('.chat-form-actions')

    expect(footerRule).toContain('align-items: flex-end;')
    expect(controlRule).toContain('flex-direction: column;')
    expect(controlRule).toContain('align-items: flex-end;')
    expect(popoverRule).toContain('order: -1;')
    expect(popoverRule).not.toMatch(/\bposition:\s*absolute\b/)
    expect(popoverRule).not.toContain('bottom: calc(100% + 8px);')
    expect(actionsRule).toContain('align-items: flex-end;')
  })
})
