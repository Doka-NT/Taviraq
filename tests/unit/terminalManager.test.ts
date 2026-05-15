import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalManager } from '../../src/main/services/TerminalManager'
import type { TerminalSessionInfo } from '../../src/shared/types'

function createManagerWithSession(
  info: Partial<TerminalSessionInfo>,
  inputLine?: string,
  sends: Array<{ channel: string; payload: unknown }> = []
): { manager: TerminalManager; writes: string[] } {
  const writes: string[] = []
  const manager = new TerminalManager(() => ({
    webContents: {
      send: (channel: string, payload: unknown) => sends.push({ channel, payload })
    }
  }) as never)
  const sessionInfo: TerminalSessionInfo = {
    id: 'session-1',
    kind: 'local',
    label: 'zsh',
    cwd: '/tmp',
    shell: '/bin/zsh',
    command: '/bin/zsh',
    createdAt: 1,
    ...info
  }

  ;(manager as unknown as {
    sessions: Map<string, unknown>
  }).sessions.set(sessionInfo.id, {
    info: sessionInfo,
    inputLine,
    pty: {
      write: (data: string) => writes.push(data),
      resize: () => undefined,
      kill: () => undefined,
      pid: 123
    }
  })

  return { manager, writes }
}

describe('TerminalManager.runConfirmed', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs confirmed commands without changing the existing empty-line behavior', () => {
    const { manager, writes } = createManagerWithSession({})

    manager.runConfirmed('session-1', 'pwd')

    expect(writes).toEqual(['pwd\r'])
  })

  it('cancels pending user input before running a confirmed local command', () => {
    vi.useFakeTimers()
    const { manager, writes } = createManagerWithSession({}, 'git status')

    manager.runConfirmed('session-1', 'pwd')

    expect(writes).toEqual(['\x03'])

    vi.advanceTimersByTime(100)

    expect(writes).toEqual(['\x03', 'pwd\r'])
  })

  it('cancels pending user input before running a confirmed SSH command', () => {
    vi.useFakeTimers()
    const { manager, writes } = createManagerWithSession({ kind: 'ssh' }, 'ls')

    manager.runConfirmed('session-1', 'pwd')

    expect(writes).toEqual(['\x03'])

    vi.advanceTimersByTime(100)

    expect(writes).toEqual(['\x03', 'pwd\r'])
  })

  it('writes resolved SSH commands while emitting placeholder metadata', () => {
    const sends: Array<{ channel: string; payload: unknown }> = []
    const { manager, writes } = createManagerWithSession({ kind: 'ssh' }, undefined, sends)

    manager.runConfirmed(
      'session-1',
      'curl -H "Authorization: Bearer real-token" https://example.test',
      'curl -H "Authorization: Bearer [[TAVIRAQ_SECRET_1_TOKEN]]" https://example.test'
    )

    expect(writes).toEqual(['curl -H "Authorization: Bearer real-token" https://example.test\r'])
    expect(sends).toContainEqual({
      channel: 'terminal:command',
      payload: {
        sessionId: 'session-1',
        command: 'curl -H "Authorization: Bearer [[TAVIRAQ_SECRET_1_TOKEN]]" https://example.test'
      }
    })
  })

  it('uses placeholder metadata for resolved local command markers', () => {
    const { manager } = createManagerWithSession({})

    manager.runConfirmed(
      'session-1',
      'curl -H "Authorization: Bearer real-token" https://example.test',
      'curl -H "Authorization: Bearer [[TAVIRAQ_SECRET_1_TOKEN]]" https://example.test'
    )

    const display = (manager as unknown as {
      displayCommandForParsedMarker: (session: unknown, command: string) => string
      sessions: Map<string, unknown>
    }).displayCommandForParsedMarker(
      (manager as unknown as { sessions: Map<string, unknown> }).sessions.get('session-1'),
      'curl -H "Authorization: Bearer real-token" https://example.test'
    )

    expect(display).toBe('curl -H "Authorization: Bearer [[TAVIRAQ_SECRET_1_TOKEN]]" https://example.test')
  })

  it('emits command events for commands typed inside direct SSH sessions', () => {
    const sends: Array<{ channel: string; payload: unknown }> = []
    const { manager, writes } = createManagerWithSession({ kind: 'ssh' }, undefined, sends)

    manager.write('session-1', 'ls -la\r')

    expect(writes).toEqual(['ls -la\r'])
    expect(sends).toContainEqual({
      channel: 'terminal:command',
      payload: { sessionId: 'session-1', command: 'ls -la' }
    })
  })
})
