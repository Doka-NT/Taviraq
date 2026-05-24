import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          source: 'manual'
        }
      }
    })
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
