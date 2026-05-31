import { readFileSync } from 'node:fs'

const appSource = readFileSync(new URL('../../src/renderer/src/App.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../../src/renderer/src/styles.css', import.meta.url), 'utf8')

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styles.match(new RegExp(`${escaped}\\s*{[^}]*}`, 's'))
  expect(match).toBeTruthy()
  return match?.[0] ?? ''
}

describe('topbar toolbar affordances', () => {
  it('groups primary and utility toolbar actions', () => {
    expect(appSource).toContain('<div className="topbar-actions" role="toolbar" aria-label={appT(\'app.terminalToolbar\')}>')
    expect(appSource).toContain('className="toolbar-group toolbar-group-primary"')
    expect(appSource).toContain('className="toolbar-group toolbar-group-utility"')
    expect(cssBlock('.toolbar-group + .toolbar-group')).toContain('border-left: 1px solid')
  })

  it('uses custom tooltips while preserving accessible labels', () => {
    expect(appSource).toContain('data-tooltip={newTabDropdownOpen ? undefined : appT(\'app.newTerminal\')}')
    expect(appSource).toContain('data-tooltip={`${appT(\'commandPalette.title\')} (⌘⇧P)`}')
    expect(appSource).toContain('data-tooltip={sidebarVisible ? appT(\'app.hideSidebar\') : appT(\'app.showSidebar\')}')
    expect(appSource).toContain('data-tooltip={appT(\'app.settings\')}')
    expect(appSource).toContain('aria-label={appT(\'app.newTerminal\')}')
    expect(appSource).toContain('aria-label={`${appT(\'commandPalette.title\')} (⌘⇧P)`}')
  })

  it('makes the new terminal action the prominent toolbar control', () => {
    expect(appSource).toContain('className="icon-button topbar-action topbar-action-primary"')
    expect(cssBlock('.topbar-action-primary')).toContain('rgba(var(--color-accent-rgb), 0.14)')
  })

  it('defines hover and keyboard-visible tooltip styles', () => {
    expect(cssBlock('.topbar')).toContain('z-index: 20;')
    expect(cssBlock('.topbar-action[data-tooltip]::after')).toContain('content: attr(data-tooltip);')
    expect(cssBlock('.topbar-action[data-tooltip]::after')).toContain('white-space: normal;')
    expect(styles).toContain('.topbar-action[data-tooltip]:focus-visible::after')
  })
})
