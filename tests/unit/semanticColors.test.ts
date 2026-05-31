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
    expect(selectorBlock('.agent-toggle.on')).toContain('background: rgba(var(--color-success-rgb), 0.22);')
    expect(selectorBlock('.security-switch.on')).toContain('background: rgba(var(--color-success-rgb), 0.22);')
    expect(selectorBlock('.privacy-status-message')).toContain('color: var(--color-neutral);')
    expect(selectorBlock('.provider-status-badge.ready')).toContain('color: var(--color-success);')
    expect(selectorBlock('.permission-indicator.read')).toContain('color: var(--color-success);')
    expect(selectorBlock('.permission-indicator.agent')).toContain('color: var(--color-success);')
    expect(selectorBlock('.composer-status-chip.waiting')).toContain('color: var(--color-warning);')
    expect(selectorBlock('.composer-config-chip.agent')).toContain('color: var(--color-success);')
    expect(selectorBlock('.composer-config-chip.read')).toContain('color: var(--color-success);')
    expect(selectorBlock('.composer-mode-option.active.agent')).toContain('color: var(--color-success);')
    expect(selectorBlock('.danger-button.warning')).toContain('color: rgba(var(--color-warning-rgb), 0.90);')
    expect(selectorBlock('.command-confirmation-card.danger')).toContain('border-color: rgba(var(--color-danger-rgb), 0.30);')
    expect(selectorBlock('.topbar-action-primary')).toContain('color: rgba(var(--color-accent-rgb), 0.96);')
    expect(selectorBlock('.tab-remote-badge')).toContain('color: rgba(var(--color-accent-rgb), 0.92);')
    expect(selectorBlock('.tab-context-menu-item.danger:hover')).toContain('color: var(--color-danger-strong);')
    expect(selectorBlock('.command-confirmation-card.danger .command-confirmation-head svg')).toContain('color: var(--color-danger-strong);')
  })

  it('keeps the migrated signal selectors off raw palette variables', () => {
    const migratedBlocks = [
      '.agent-toggle.on',
      '.security-switch.on',
      '.privacy-status-message',
      '.provider-status-badge.ready',
      '.permission-indicator.read',
      '.permission-indicator.agent',
      '.composer-status-chip.waiting',
      '.composer-config-chip.agent',
      '.composer-config-chip.read',
      '.composer-mode-option.active.agent',
      '.danger-button.warning',
      '.command-confirmation-card.danger',
      '.topbar-action-primary',
      '.tab-remote-badge',
      '.tab-context-menu-item.danger:hover',
      '.command-confirmation-card.danger .command-confirmation-head svg'
    ].map(selectorBlock).join('\n')

    expect(migratedBlocks).not.toMatch(/--accent-(cyan|green|amber|red)(?:-rgb|-text)?\b/)
    expect(migratedBlocks).not.toContain('#34C759')
  })
})
