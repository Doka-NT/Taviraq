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
  }
}))

import { discoverExternalMcpServers, extractMcpServers, McpConfigStore } from '@main/services/mcpConfigStore'

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
})
