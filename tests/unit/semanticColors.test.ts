import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('../../src/renderer/src/styles.css', import.meta.url), 'utf8')

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styles.match(new RegExp(`${escaped}\\s*{[^}]*}`, 's'))
  expect(match).toBeTruthy()
  return match?.[0] ?? ''
}

describe('semantic color tokens', () => {
  it('defines the shared signal palette', () => {
    expect(styles).toContain('--color-accent: var(--accent-cyan);')
    expect(styles).toContain('--color-success: var(--accent-green);')
    expect(styles).toContain('--color-warning: var(--accent-amber);')
    expect(styles).toContain('--color-danger: var(--accent-red-text);')
    expect(styles).toContain('--color-danger-strong: var(--accent-red);')
    expect(styles).toContain('--color-danger-bg: var(--accent-red);')
    expect(styles).toContain('--color-neutral-rgb: var(--surface-rgb);')
    expect(styles).toContain('--color-neutral: rgba(var(--color-neutral-rgb), 0.50);')
  })

  it('maps key UI signals to semantic colors', () => {
    expect(selectorBlock('.agent-toggle.on')).toContain('background: var(--color-accent);')
    expect(selectorBlock('.privacy-status-message')).toContain('color: var(--color-neutral);')
    expect(selectorBlock('.provider-status-badge.ready')).toContain('color: var(--color-success);')
    expect(selectorBlock('.danger-button.warning')).toContain('color: rgba(var(--color-warning-rgb), 0.90);')
    expect(selectorBlock('.command-confirmation-card.danger')).toContain('border-color: rgba(var(--color-danger-rgb), 0.30);')
    expect(selectorBlock('.tab-context-menu-item.danger:hover')).toContain('color: var(--color-danger-strong);')
    expect(selectorBlock('.command-confirmation-card.danger .command-confirmation-head svg')).toContain('color: var(--color-danger-strong);')
  })

  it('keeps the migrated signal selectors off raw palette variables', () => {
    const migratedBlocks = [
      '.agent-toggle.on',
      '.privacy-status-message',
      '.provider-status-badge.ready',
      '.danger-button.warning',
      '.command-confirmation-card.danger',
      '.tab-context-menu-item.danger:hover',
      '.command-confirmation-card.danger .command-confirmation-head svg'
    ].map(selectorBlock).join('\n')

    expect(migratedBlocks).not.toMatch(/--accent-(cyan|green|amber|red)(?:-rgb|-text)?\b/)
    expect(migratedBlocks).not.toContain('#34C759')
  })
})
