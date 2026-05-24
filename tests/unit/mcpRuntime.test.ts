import { describe, expect, it } from 'vitest'
import { buildShellLaunchScript, resolveMcpBootstrapShell } from '@main/services/mcpRuntime'

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
})
