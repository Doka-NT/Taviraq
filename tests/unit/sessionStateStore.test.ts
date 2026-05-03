import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/ai-terminal-tests'
  }
}))

import { MAX_SAVED_OUTPUT_CHARS, normalizeSessionState, trimSavedOutput } from '@main/services/sessionStateStore'

describe('session state helpers', () => {
  it('keeps only the newest output when terminal scrollback exceeds the limit', () => {
    const output = `${'a'.repeat(MAX_SAVED_OUTPUT_CHARS)}tail`

    expect(trimSavedOutput(output)).toBe(`${'a'.repeat(MAX_SAVED_OUTPUT_CHARS - 4)}tail`)
  })

  it('drops assistant threads for sessions that are no longer open', () => {
    const snapshot = normalizeSessionState({
      version: 1,
      savedAt: '2026-05-03T00:00:00.000Z',
      activeSessionId: 'missing',
      sessions: [{
        id: 'live',
        kind: 'local',
        label: 'zsh',
        command: '/bin/zsh',
        createdAt: 1,
        status: 'running',
        output: 'hello'
      }],
      assistantThreads: {
        live: { messages: [{ role: 'user', content: 'hi' }], draft: 'next' },
        missing: { messages: [{ role: 'assistant', content: 'stale' }], draft: '' }
      }
    })

    expect(snapshot.activeSessionId).toBe('live')
    expect(Object.keys(snapshot.assistantThreads)).toEqual(['live'])
  })

  it('backfills an ssh reconnect command from the saved remote target', () => {
    const snapshot = normalizeSessionState({
      version: 1,
      savedAt: '2026-05-03T00:00:00.000Z',
      activeSessionId: 'ssh-tab',
      sessions: [{
        id: 'ssh-tab',
        kind: 'ssh',
        label: 'artem@cloud-vm',
        remoteHost: 'cloud-vm',
        remoteTarget: 'artem@cloud-vm',
        command: '/bin/zsh',
        createdAt: 1,
        status: 'disconnected',
        output: ''
      }],
      assistantThreads: {}
    })

    expect(snapshot.sessions[0].reconnectCommand).toBe('ssh artem@cloud-vm')
  })
})
