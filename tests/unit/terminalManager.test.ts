import { describe, expect, it } from 'vitest'
import { TerminalManager } from '../../src/main/services/TerminalManager'
import type { TerminalSessionInfo } from '../../src/shared/types'

function createManagerWithSession(info: Partial<TerminalSessionInfo>, inputLine?: string): { manager: TerminalManager; writes: string[] } {
  const writes: string[] = []
  const manager = new TerminalManager(() => undefined)
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
  it('runs confirmed commands without changing the existing empty-line behavior', () => {
    const { manager, writes } = createManagerWithSession({})

    manager.runConfirmed('session-1', 'pwd')

    expect(writes).toEqual(['pwd\r'])
  })

  it('cancels pending user input before running a confirmed local command', () => {
    const { manager, writes } = createManagerWithSession({}, 'git status')

    manager.runConfirmed('session-1', 'pwd')

    expect(writes).toEqual(['\x03pwd\r'])
  })

  it('cancels pending user input before running a confirmed SSH command', () => {
    const { manager, writes } = createManagerWithSession({ kind: 'ssh' }, 'ls')

    manager.runConfirmed('session-1', 'pwd')

    expect(writes).toEqual(["\x03pwd; printf '\\x1b]6973;PROMPT\\x07'\r"])
  })
})
