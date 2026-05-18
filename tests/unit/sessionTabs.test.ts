import { describe, expect, it } from 'vitest'
import {
  formatSessionUptime,
  getCwdBasename,
  getSessionCommandTarget,
  getSessionStatusMeta,
  getSessionTooltip,
  getTabLabel,
  type SessionTabInfo
} from '@renderer/utils/sessionTabs'

describe('session tab helpers', () => {
  it('prefers the remote target for SSH tab labels and command targets', () => {
    const session: SessionTabInfo = {
      id: 'ssh-1',
      kind: 'ssh',
      label: 'production',
      remoteTarget: 'deploy@example.com',
      remoteHost: 'example.com',
      reconnectCommand: 'ssh deploy@example.com',
      cwd: '/Users/artem/project',
      command: 'ssh deploy@example.com',
      createdAt: 1_000,
      status: 'disconnected'
    }

    expect(getTabLabel(session)).toBe('production · deploy@example.com')
    expect(getSessionCommandTarget(session)).toBe('deploy@example.com')
    expect(getSessionTooltip(session, 121_000)).toContain('Reconnect: ssh deploy@example.com')
  })

  it('returns compact cwd badges and local command targets', () => {
    const session: SessionTabInfo = {
      id: 'local-1',
      kind: 'local',
      label: 'zsh',
      cwd: '/Users/artem/PhpstormProjects/Taviraq',
      command: '/bin/zsh',
      createdAt: 1_000,
      status: 'idle'
    }

    expect(getCwdBasename(session.cwd)).toBe('Taviraq')
    expect(getSessionCommandTarget(session)).toBe('Taviraq')
  })

  it('formats session uptime for tab tooltips', () => {
    expect(formatSessionUptime(1_000, 30_000)).toBe('<1m')
    expect(formatSessionUptime(1_000, 181_000)).toBe('3m')
    expect(formatSessionUptime(1_000, 7_261_000)).toBe('2h 1m')
    expect(formatSessionUptime(1_000, 176_401_000)).toBe('2d 1h')
  })

  it('exposes tab status labels for idle and reconnecting sessions', () => {
    expect(getSessionStatusMeta('idle')).toEqual({ label: 'Idle', className: 'idle' })
    expect(getSessionStatusMeta('reconnecting')).toEqual({ label: 'Reconnecting', className: 'reconnecting' })
  })
})
