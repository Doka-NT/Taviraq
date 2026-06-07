// SPDX-License-Identifier: MPL-2.0
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TMP_DIR = join(__dirname, '__tmp_mcp_store__')
const HOME_DIR = join(TMP_DIR, 'home')

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => name === 'home' ? HOME_DIR : TMP_DIR
  },
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: () => true,
      resize: vi.fn()
    }))
  }
}))

import { discoverExternalMcpServers, extractMcpServers, McpConfigStore, parseCodexMcpServersToml } from '@main/services/mcpConfigStore'

async function cleanTmp(): Promise<void> {
  if (existsSync(TMP_DIR)) {
    await rm(TMP_DIR, { recursive: true })
  }
}

describe('McpConfigStore', () => {
  beforeEach(() => cleanTmp())
  afterEach(() => cleanTmp())

  it('extracts MCP servers from object-shaped mcp.json', () => {
    expect(extractMcpServers({
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          env: { TOKEN: 'secret' }
        },
        invalid: { args: ['missing-command'] }
      }
    }, 'claude', '/tmp/mcp.json')).toMatchObject([
      {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: { TOKEN: 'secret' },
        enabled: true,
        source: 'claude',
        importedFrom: '/tmp/mcp.json'
      }
    ])
  })

  it('ignores non-object env values while normalizing servers', () => {
    expect(extractMcpServers({
      mcpServers: {
        badEnv: {
          command: 'node',
          env: ['TOKEN=value']
        }
      }
    })).toMatchObject([
      {
        name: 'badEnv',
        command: 'node',
        enabled: true
      }
    ])
    expect(extractMcpServers({
      mcpServers: {
        badEnv: {
          command: 'node',
          env: ['TOKEN=value']
        }
      }
    })[0].env).toBeUndefined()
  })

  it('persists configured servers to mcp.json', async () => {
    const store = new McpConfigStore()
    const servers = await store.upsert({
      id: 'filesystem',
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      enabled: true,
      source: 'manual',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z'
    })

    expect(servers).toHaveLength(1)
    const raw = JSON.parse(await readFile(join(TMP_DIR, 'mcp.json'), 'utf8')) as unknown
    expect(raw).toEqual({
      mcpServers: {
        filesystem: {
          id: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          source: 'manual',
          createdAt: '2026-05-24T00:00:00.000Z',
          updatedAt: '2026-05-24T00:00:00.000Z'
        }
      }
    })
  })

  it('keeps MCP server names unique because mcp.json is keyed by name', async () => {
    const store = new McpConfigStore()
    await store.saveAll([
      {
        id: 'first',
        name: 'github',
        command: 'npx',
        args: ['server-a'],
        enabled: true,
        source: 'manual',
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z'
      },
      {
        id: 'second',
        name: 'GitHub',
        command: 'node',
        args: ['server-b'],
        enabled: true,
        source: 'manual',
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z'
      }
    ])

    expect(await store.list()).toMatchObject([
      { id: 'first', name: 'github', command: 'npx' }
    ])
  })

  it('preserves imported MCP source metadata after reload', async () => {
    const store = new McpConfigStore()
    await store.saveAll([
      {
        id: 'github',
        name: 'github',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        enabled: true,
        source: 'claude',
        importedFrom: '/Users/demo/.claude/mcp.json',
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z'
      }
    ])

    expect(await store.list()).toMatchObject([
      {
        id: 'github',
        name: 'github',
        command: 'npx',
        source: 'claude',
        importedFrom: '/Users/demo/.claude/mcp.json'
      }
    ])
  })

  it('persists and updates per-tool enabled settings', async () => {
    const store = new McpConfigStore()
    await store.upsert({
      id: 'filesystem',
      name: 'filesystem',
      command: 'npx',
      enabled: true,
      source: 'manual',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z'
    })
    await store.saveTools('filesystem', [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object' },
        enabled: true
      }
    ])
    const servers = await store.setToolEnabled('filesystem', 'read_file', false)

    expect(servers[0].tools).toEqual([
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object' },
        enabled: false
      }
    ])
    expect(JSON.parse(await readFile(join(TMP_DIR, 'mcp.json'), 'utf8'))).toMatchObject({
      mcpServers: {
        filesystem: {
          tools: [{ name: 'read_file', enabled: false }]
        }
      }
    })
  })

  it('surfaces malformed mcp.json instead of overwriting it as empty', async () => {
    await mkdir(TMP_DIR, { recursive: true })
    await writeFile(join(TMP_DIR, 'mcp.json'), '{not-json', 'utf8')

    const store = new McpConfigStore()
    await expect(store.list()).rejects.toThrow()
  })

  it('discovers external MCP configs after approval', async () => {
    await mkdir(join(HOME_DIR, '.claude'), { recursive: true })
    await writeFile(join(HOME_DIR, '.claude', 'mcp.json'), JSON.stringify({
      mcpServers: {
        github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] }
      }
    }), 'utf8')

    const result = await discoverExternalMcpServers()
    expect(result.warnings).toEqual([])
    expect(result.servers).toMatchObject([
      {
        name: 'github',
        command: 'npx',
        source: 'claude',
        sourcePath: join(HOME_DIR, '.claude', 'mcp.json')
      }
    ])
  })

  it('extracts Codex MCP servers from config.toml', () => {
    expect(parseCodexMcpServersToml(`
[mcp_servers.github]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
env = { GITHUB_TOKEN = "token-value" }

[mcp_servers.local.env]
TOKEN = "local-token"

[mcp_servers.local]
command = "python"
args = ["server.py"]
disabled = true
    `)).toEqual({
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'token-value' }
        },
        local: {
          command: 'python',
          args: ['server.py'],
          disabled: true,
          env: { TOKEN: 'local-token' }
        }
      }
    })
  })

  it('discovers Codex config.toml MCP servers', async () => {
    await mkdir(join(HOME_DIR, '.codex'), { recursive: true })
    await writeFile(join(HOME_DIR, '.codex', 'config.toml'), [
      '[mcp_servers.codex_files]',
      'command = "node"',
      'args = ["codex-files.js"]'
    ].join('\n'), 'utf8')

    const result = await discoverExternalMcpServers()

    expect(result.warnings).toEqual([])
    expect(result.servers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'codex_files',
        source: 'codex',
        sourcePath: join(HOME_DIR, '.codex', 'config.toml')
      })
    ]))
  })

  it('discovers VS Code Copilot MCP configs from user and workspace paths', async () => {
    await mkdir(join(HOME_DIR, 'Library/Application Support/Code/User'), { recursive: true })
    await mkdir(join(HOME_DIR, 'PhpstormProjects/demo-app/.vscode'), { recursive: true })
    await mkdir(join(HOME_DIR, 'PhpstormProjects/acme/nested-app/.vscode'), { recursive: true })
    await writeFile(join(HOME_DIR, 'Library/Application Support/Code/User', 'mcp.json'), JSON.stringify({
      mcpServers: {
        vscode_user: { command: 'node', args: ['vscode-user.js'] }
      }
    }), 'utf8')
    await writeFile(join(HOME_DIR, 'PhpstormProjects/demo-app/.vscode', 'mcp.json'), JSON.stringify({
      mcpServers: {
        vscode_workspace: { command: 'npx', args: ['workspace-mcp'] }
      }
    }), 'utf8')
    await writeFile(join(HOME_DIR, 'PhpstormProjects/acme/nested-app/.vscode', 'mcp.json'), JSON.stringify({
      mcpServers: {
        vscode_nested_workspace: { command: 'uvx', args: ['nested-workspace-mcp'] }
      }
    }), 'utf8')

    const result = await discoverExternalMcpServers()

    expect(result.warnings).toEqual([])
    expect(result.servers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'vscode_user',
        source: 'copilot',
        sourcePath: join(HOME_DIR, 'Library/Application Support/Code/User', 'mcp.json')
      }),
      expect.objectContaining({
        name: 'vscode_workspace',
        source: 'copilot',
        sourcePath: join(HOME_DIR, 'PhpstormProjects/demo-app/.vscode', 'mcp.json')
      }),
      expect.objectContaining({
        name: 'vscode_nested_workspace',
        source: 'copilot',
        sourcePath: join(HOME_DIR, 'PhpstormProjects/acme/nested-app/.vscode', 'mcp.json')
      })
    ]))
  })

  it('discovers local model MCP host configs', async () => {
    await mkdir(join(HOME_DIR, 'Library/Application Support/LM Studio'), { recursive: true })
    await mkdir(join(HOME_DIR, '.config/ollama-mcp-bridge'), { recursive: true })
    await mkdir(join(HOME_DIR, '.cursor'), { recursive: true })
    await mkdir(join(HOME_DIR, '.codeium/windsurf'), { recursive: true })
    await writeFile(join(HOME_DIR, 'Library/Application Support/LM Studio', 'mcp.json'), JSON.stringify({
      mcpServers: {
        lmstudio_search: { command: 'node', args: ['lmstudio-search.js'] }
      }
    }), 'utf8')
    await writeFile(join(HOME_DIR, '.config/ollama-mcp-bridge', 'mcp-config.json'), JSON.stringify({
      mcpServers: {
        ollama_bridge_search: { command: 'uvx', args: ['ollama-search'] }
      }
    }), 'utf8')
    await writeFile(join(HOME_DIR, '.cursor', 'mcp.json'), JSON.stringify({
      mcpServers: {
        cursor_files: { command: 'npx', args: ['cursor-files'] }
      }
    }), 'utf8')
    await writeFile(join(HOME_DIR, '.codeium/windsurf', 'mcp_config.json'), JSON.stringify({
      mcpServers: {
        windsurf_docs: { command: 'python', args: ['windsurf-docs.py'] }
      }
    }), 'utf8')

    const result = await discoverExternalMcpServers()

    expect(result.warnings).toEqual([])
    expect(result.servers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'lmstudio_search',
        source: 'lmstudio',
        sourcePath: join(HOME_DIR, 'Library/Application Support/LM Studio', 'mcp.json')
      }),
      expect.objectContaining({
        name: 'ollama_bridge_search',
        source: 'ollama',
        sourcePath: join(HOME_DIR, '.config/ollama-mcp-bridge', 'mcp-config.json')
      }),
      expect.objectContaining({
        name: 'cursor_files',
        source: 'cursor',
        sourcePath: join(HOME_DIR, '.cursor', 'mcp.json')
      }),
      expect.objectContaining({
        name: 'windsurf_docs',
        source: 'windsurf',
        sourcePath: join(HOME_DIR, '.codeium/windsurf', 'mcp_config.json')
      })
    ]))
  })
})
