import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('../../src/renderer/src/styles.css', import.meta.url), 'utf8')
const rootEnd = styles.indexOf('\n}\n\n*')
const runtimeStyles = rootEnd >= 0 ? styles.slice(rootEnd) : styles

describe('semantic color tokens', () => {
  it('defines the shared signal palette', () => {
    expect(styles).toContain('--color-accent: var(--accent-cyan);')
    expect(styles).toContain('--color-success: var(--accent-green);')
    expect(styles).toContain('--color-warning: var(--accent-amber);')
    expect(styles).toContain('--color-danger: var(--accent-red-text);')
    expect(styles).toContain('--color-neutral: var(--text-secondary);')
  })

  it('maps key UI signals to semantic colors', () => {
    expect(styles).toMatch(/\.agent-toggle\.on\s*{\s*background: var\(--color-accent\);/s)
    expect(styles).toMatch(/\.privacy-status-message\s*{\s*color: var\(--color-neutral\);/s)
    expect(styles).toMatch(/\.provider-status-badge\.ready\s*{[^}]*color: var\(--color-success\);/s)
    expect(styles).toMatch(/\.danger-button\.warning\s*{[^}]*color: rgba\(var\(--color-warning-rgb\), 0\.90\);/s)
    expect(styles).toMatch(/\.command-confirmation-card\.danger\s*{[^}]*border-color: rgba\(var\(--color-danger-rgb\), 0\.30\);/s)
  })

  it('keeps runtime status styling on semantic tokens instead of raw palette variables', () => {
    expect(runtimeStyles).not.toMatch(/--accent-(cyan|green|amber|red)(?:-rgb|-text)?\b/)
    expect(runtimeStyles).not.toContain('#34C759')
  })
})
