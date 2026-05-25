import { readFileSync } from 'node:fs'

const panelSource = readFileSync(new URL('../../src/renderer/src/components/LlmPanel.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../../src/renderer/src/styles.css', import.meta.url), 'utf8')
const translations = readFileSync(new URL('../../src/renderer/src/i18n/translations.ts', import.meta.url), 'utf8')

describe('permission indicator semantics', () => {
  it('separates shell, permission, and agent status UI regions', () => {
    expect(panelSource).toContain('className="permission-summary"')
    expect(panelSource).toContain('className={`shell-readout ${activeSession?.status ?? \'exited\'}`}')
    expect(panelSource).toContain('className={`permission-indicator ${assistMode}`}')
    expect(panelSource).toContain('className={`composer-status-chip ${liveStatus}`')
    expect(panelSource).not.toContain('permission-chip')
    expect(panelSource).not.toContain('live-status-chip')
  })

  it('uses compact permission labels with localized accessible text', () => {
    expect(panelSource).toContain("assistMode === 'agent'")
    expect(panelSource).toContain("'R+X'")
    expect(panelSource).toContain("'R'")
    expect(panelSource).toContain("t('panel.permission.readExecute')")
    expect(panelSource).toContain("t('panel.permission.readOnly')")
    expect(panelSource).toContain("t('panel.permission.none')")
    expect(translations).toContain("'panel.permission.summary': string")
    expect(translations).toContain("'panel.permission.readExecute': string")
    expect(translations).toContain("'panel.shell.label': string")
  })

  it('styles the shell as plain text and keeps the permission indicator visible', () => {
    expect(styles).toContain('.shell-readout {')
    expect(styles).toContain('.shell-readout-label {')
    expect(styles).toContain('.permission-indicator {')
    expect(styles).toContain('.permission-indicator.agent {')
    expect(styles).toContain('.composer-status-chip.running {')
    expect(styles).not.toContain('.permission-chip')
    expect(styles).not.toContain('.live-status-chip')
  })
})
