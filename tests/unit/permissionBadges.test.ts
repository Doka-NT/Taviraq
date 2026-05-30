import { readFileSync } from 'node:fs'
import { getComposerLiveStatus, getPermissionIndicatorState, getProviderTerminalContext } from '@renderer/components/LlmPanel'

const panelSource = readFileSync(new URL('../../src/renderer/src/components/LlmPanel.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../../src/renderer/src/styles.css', import.meta.url), 'utf8')
const translations = readFileSync(new URL('../../src/renderer/src/i18n/translations.ts', import.meta.url), 'utf8')

describe('permission indicator semantics', () => {
  it('separates shell, permission, and agent status UI regions', () => {
    expect(panelSource).toContain('className="permission-summary"')
    expect(panelSource).toContain('className={`shell-readout ${activeSession?.status ?? \'exited\'}`}')
    expect(panelSource).toContain('className={`permission-indicator ${permissionIndicator.visualMode}`}')
    expect(panelSource).toContain('className={`composer-status-chip ${liveStatus}`')
    expect(panelSource).not.toContain('permission-chip')
    expect(panelSource).not.toContain('live-status-chip')
  })

  it('uses compact permission labels with localized accessible text', () => {
    expect(panelSource).toContain("assistMode === 'agent'")
    expect(panelSource).toContain("'R+X'")
    expect(panelSource).toContain("'X'")
    expect(panelSource).toContain("'R'")
    expect(panelSource).toContain("titleKey: 'panel.permission.readExecute'")
    expect(panelSource).toContain("titleKey: 'panel.permission.execute'")
    expect(panelSource).toContain("titleKey: 'panel.permission.readOnly'")
    expect(panelSource).toContain("titleKey: 'panel.permission.none'")
    expect(translations).toContain("'panel.permission.summary': string")
    expect(translations).toContain("'panel.permission.execute': string")
    expect(translations).toContain("'panel.permission.readExecute': string")
    expect(translations).toContain("'panel.shell.label': string")
  })

  it('does not show an idle composer status chip', () => {
    expect(getComposerLiveStatus({
      commandConfirmation: null,
      streaming: false,
      agenticRunning: false,
      agenticCommandRunning: false
    })).toBeNull()
    expect(getComposerLiveStatus({
      commandConfirmation: null,
      streaming: true,
      agenticRunning: false,
      agenticCommandRunning: false
    })).toBe('running')
    expect(getComposerLiveStatus({
      commandConfirmation: {},
      streaming: false,
      agenticRunning: false,
      agenticCommandRunning: false
    })).toBe('waiting')
    expect(panelSource).toContain("{liveStatus && assistMode !== 'off'")
    expect(panelSource).not.toContain('panel.status.idle')
  })

  it('removes read labels when strict context policy blocks terminal context', () => {
    expect(getPermissionIndicatorState('agent', true)).toEqual({
      label: 'R+X',
      titleKey: 'panel.permission.readExecute',
      visualMode: 'agent'
    })
    expect(getPermissionIndicatorState('agent', false)).toEqual({
      label: 'X',
      titleKey: 'panel.permission.execute',
      visualMode: 'agent'
    })
    expect(getPermissionIndicatorState('read', true)).toEqual({
      label: 'R',
      titleKey: 'panel.permission.readOnly',
      visualMode: 'read'
    })
    expect(getPermissionIndicatorState('read', false)).toEqual({
      label: '—',
      titleKey: 'panel.permission.none',
      visualMode: 'off'
    })
  })

  it('removes terminal context from provider requests when strict context is active', () => {
    expect(getProviderTerminalContext({
      selectedText: 'selected secret',
      terminalOutput: 'terminal secret',
      strictTerminalContextActive: true
    })).toEqual({
      selectedText: '',
      terminalOutput: undefined
    })
    expect(getProviderTerminalContext({
      selectedText: 'selected text',
      terminalOutput: 'terminal output',
      strictTerminalContextActive: false
    })).toEqual({
      selectedText: 'selected text',
      terminalOutput: 'terminal output'
    })
    expect(panelSource.match(/const providerTerminalContext = getProviderTerminalContext/g)?.length).toBe(3)
    expect(panelSource.match(/\.\.\.providerTerminalContext/g)?.length).toBe(3)
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
