// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it, vi, afterEach } from 'vitest'
import { buildMcpEnv, buildShellLaunchScript, formatToolResult, listMcpToolsFromSession, resolveMcpBootstrapShell } from '@main/services/mcpRuntime'

describe('mcpRuntime', () => {
  it('launches MCP servers through user shell init while protecting stdout framing', () => {
    const script = buildShellLaunchScript({
      command: 'my-mcp-alias',
      args: ['--path', "/tmp/Project's Files"]
    })

    expect(script).toContain('. "${HOME}/.zshrc"')
    expect(script).toContain('exec 1>&2')
    expect(script).toContain('exec 1>&3')
    expect(script).toContain('my-mcp-alias')
    expect(script).toContain('--path')
    expect(script).toContain('Project')
    // Command must not use eval — direct invocation only
    expect(script).not.toContain('eval ')
    // Shell aliases/functions must be resolvable: command runs in the same shell
    // that sourced the RC files, not via exec env -i (which only finds external binaries)
    expect(script).not.toContain('exec env -i')
  })

  it('exports server-specific env vars before the command', () => {
    const script = buildShellLaunchScript({
      command: 'my-server',
      args: [],
      env: { MY_TOKEN: 'secret123', DB_URL: 'postgres://localhost/db' }
    })

    expect(script).toContain("export MY_TOKEN='secret123'")
    expect(script).toContain('export DB_URL=')
    // Exports must appear before the command line
    const exportIdx = script.indexOf('export MY_TOKEN=')
    const cmdIdx = script.indexOf('my-server')
    expect(exportIdx).toBeGreaterThanOrEqual(0)
    expect(cmdIdx).toBeGreaterThan(exportIdx)
  })

  it('drops env keys with shell metacharacters to prevent injection', () => {
    const script = buildShellLaunchScript({
      command: 'my-server',
      args: [],
      env: {
        SAFE_KEY: 'safe-value',
        'A=$(touch /tmp/pwn)': 'evil',
        'KEY WITH SPACE': 'evil',
        '123STARTS_WITH_DIGIT': 'evil'
      }
    })

    expect(script).toContain('export SAFE_KEY=')
    expect(script).not.toContain('$(touch')
    expect(script).not.toContain('KEY WITH SPACE')
    expect(script).not.toContain('123STARTS_WITH_DIGIT')
  })

  it('falls back to a POSIX-compatible bootstrap shell for non-POSIX login shells', () => {
    expect(resolveMcpBootstrapShell('/opt/homebrew/bin/fish', (path) => path === '/bin/zsh')).toBe('/bin/zsh')
    expect(resolveMcpBootstrapShell('/usr/bin/zsh', (path) => path === '/usr/bin/zsh')).toBe('/usr/bin/zsh')
    expect(resolveMcpBootstrapShell('/missing/zsh', (path) => path === '/bin/bash')).toBe('/bin/bash')
  })

  it('collects paginated tools/list responses', async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    const tools = await listMcpToolsFromSession({
      request: (method, params) => {
        calls.push({ method, params })
        return Promise.resolve(calls.length === 1
          ? {
              tools: [{ name: 'first', description: 'First tool' }],
              nextCursor: 'page-2'
            }
          : {
              tools: [
                { name: 'second', inputSchema: { type: 'object' } },
                { name: 'first' }
              ]
            })
      }
    })

    expect(calls).toEqual([
      { method: 'tools/list', params: {} },
      { method: 'tools/list', params: { cursor: 'page-2' } }
    ])
    expect(tools).toEqual([
      { name: 'first', description: 'First tool', enabled: true },
      { name: 'second', inputSchema: { type: 'object' }, enabled: true }
    ])
  })

  it('formats MCP isError result content for thrown failures', () => {
    expect(formatToolResult({
      isError: true,
      content: [{ type: 'text', text: 'Tool failed' }]
    })).toBe('Tool failed')
  })

  describe('buildMcpEnv()', () => {
    afterEach(() => vi.restoreAllMocks())

    it('passes only allowlisted env vars to MCP child process', () => {
      vi.stubEnv('PATH', '/usr/bin:/bin')
      vi.stubEnv('HOME', '/home/user')
      vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret')
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-123')
      vi.stubEnv('DATABASE_URL', 'postgres://...')

      const env = buildMcpEnv()
      expect(env['PATH']).toBe('/usr/bin:/bin')
      expect(env['HOME']).toBe('/home/user')
      expect(env['AWS_SECRET_ACCESS_KEY']).toBeUndefined()
      expect(env['ANTHROPIC_API_KEY']).toBeUndefined()
      expect(env['DATABASE_URL']).toBeUndefined()
    })

    it('merges server-specific env on top of the allowlist', () => {
      vi.stubEnv('HOME', '/home/user')
      vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'should-not-leak')

      const env = buildMcpEnv({ MY_SERVER_TOKEN: 'tok', HOME: '/override' })
      expect(env['MY_SERVER_TOKEN']).toBe('tok')
      expect(env['HOME']).toBe('/override')
      expect(env['AWS_SECRET_ACCESS_KEY']).toBeUndefined()
    })
  })
})
