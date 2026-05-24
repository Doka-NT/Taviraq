import { describe, expect, it } from 'vitest'
import { buildShellLaunchScript, formatToolResult, listMcpToolsFromSession, resolveMcpBootstrapShell } from '@main/services/mcpRuntime'

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
  })

  it('falls back to a POSIX-compatible bootstrap shell for non-POSIX login shells', () => {
    expect(resolveMcpBootstrapShell('/opt/homebrew/bin/fish', (path) => path === '/bin/zsh')).toBe('/bin/zsh')
    expect(resolveMcpBootstrapShell('/usr/bin/zsh', () => false)).toBe('/usr/bin/zsh')
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
})
