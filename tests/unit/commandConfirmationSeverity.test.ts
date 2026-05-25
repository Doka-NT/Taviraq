import { readFileSync } from 'node:fs'

const panelSource = readFileSync(new URL('../../src/renderer/src/components/LlmPanel.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../../src/renderer/src/styles.css', import.meta.url), 'utf8')

describe('command confirmation severity UI', () => {
  it('uses severity tone classes and run-anyway copy for risky commands', () => {
    expect(panelSource).toContain("tone: riskLevel === 'danger' ? 'danger' : 'warning'")
    expect(panelSource).toContain("confirmLabel: t('confirm.runAnyway')")
    expect(panelSource).not.toContain("confirmLabel: t('confirm.runCommand')")
    expect(panelSource).toContain('className={`danger-button ${commandConfirmation.tone}`}')
  })

  it('keeps warning actions amber and destructive actions red', () => {
    expect(styles).toContain('.danger-button.warning')
    expect(styles).toContain('rgba(var(--accent-amber-rgb), 0.14)')
    expect(styles).toContain('.command-confirmation-card.danger .danger-button')
    expect(styles).toContain('rgba(var(--accent-red-rgb), 0.18)')
  })
})
