// SPDX-License-Identifier: MPL-2.0
import { app, dialog, nativeImage } from 'electron'
import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DiscoveredMcpServer, McpDiscoveryResult, McpServerConfig, McpServerSource, McpToolConfig } from '@shared/types'

const MCP_CONFIG_FILE = 'mcp.json'
const DISCOVERY_DIALOG_ICON_SIZE = 64
const DISCOVERY_SOURCES: Array<{
  source: Exclude<McpServerSource, 'manual'>
  label: string
  paths: string[]
}> = [
  {
    source: 'claude',
    label: 'Claude',
    paths: [
      '.claude/mcp.json',
      '.claude/settings.json',
      'Library/Application Support/Claude/claude_desktop_config.json'
    ]
  },
  {
    source: 'copilot',
    label: 'Copilot',
    paths: [
      '.config/github-copilot/mcp.json',
      '.github/copilot/mcp.json',
      'Library/Application Support/Code/User/mcp.json',
      'Library/Application Support/Code - Insiders/User/mcp.json',
      'Library/Application Support/VSCodium/User/mcp.json',
      'PhpstormProjects/*/.vscode/mcp.json',
      'PhpstormProjects/*/*/.vscode/mcp.json',
      'Documents/*/.vscode/mcp.json',
      'Projects/*/.vscode/mcp.json'
    ]
  },
  {
    source: 'codex',
    label: 'Codex',
    paths: [
      '.codex/mcp.json',
      '.codex/config.json',
      '.codex/config.toml'
    ]
  },
  {
    source: 'opencode',
    label: 'OpenCode',
    paths: [
      '.opencode/mcp.json',
      '.config/opencode/mcp.json'
    ]
  },
  {
    source: 'lmstudio',
    label: 'LM Studio',
    paths: [
      'Library/Application Support/LM Studio/mcp.json',
      '.lmstudio/mcp.json',
      '.config/lmstudio/mcp.json'
    ]
  },
  {
    source: 'ollama',
    label: 'Ollama bridge',
    paths: [
      '.mcphost.json',
      '.config/mcphost/config.json',
      '.config/mcphost/mcp.json',
      '.config/mcphost/mcp-servers.json',
      '.config/ollama-mcp-bridge/mcp-config.json',
      '.ollama/mcp-config.json'
    ]
  },
  {
    source: 'cursor',
    label: 'Cursor',
    paths: [
      '.cursor/mcp.json',
      'Library/Application Support/Cursor/User/mcp.json'
    ]
  },
  {
    source: 'windsurf',
    label: 'Windsurf',
    paths: [
      '.codeium/windsurf/mcp_config.json',
      '.config/windsurf/mcp_config.json',
      'Library/Application Support/Windsurf/User/mcp_config.json'
    ]
  }
]

type McpServerDefinition = {
  id?: unknown
  name?: unknown
  command?: unknown
  args?: unknown
  env?: unknown
  tools?: unknown
  enabled?: unknown
  disabled?: unknown
  source?: unknown
  importedFrom?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export class McpConfigStore {
  private readonly path = join(app.getPath('userData'), MCP_CONFIG_FILE)
  private writeQueue: Promise<void> = Promise.resolve()

  async list(): Promise<McpServerConfig[]> {
    try {
      return await readMcpServersFromFile(this.path, 'manual')
    } catch (error: unknown) {
      if (isNodeFileNotFoundError(error)) return []
      throw error
    }
  }

  async saveAll(servers: McpServerConfig[]): Promise<McpServerConfig[]> {
    let nextServers: McpServerConfig[] | undefined
    const write = this.writeQueue.then(async () => {
      nextServers = normalizeMcpServers(servers)
      await this.writeAll(nextServers)
    })
    this.writeQueue = write.catch(() => undefined)
    await write
    return nextServers ?? []
  }

  async upsert(server: McpServerConfig): Promise<McpServerConfig[]> {
    return this.update((servers) => {
      const normalized = normalizeMcpServer(server)
      if (!normalized) return servers
      const index = servers.findIndex((candidate) => candidate.id === normalized.id)
      return index === -1
        ? [...servers, normalized]
        : servers.map((candidate, candidateIndex) => candidateIndex === index ? normalized : candidate)
    })
  }

  async delete(id: string): Promise<McpServerConfig[]> {
    return this.update((servers) => servers.filter((server) => server.id !== id))
  }

  async saveTools(serverId: string, tools: McpToolConfig[]): Promise<McpServerConfig[]> {
    return this.update((servers) => servers.map((server) => {
      if (server.id !== serverId) return server
      const existing = new Map((server.tools ?? []).map((tool) => [tool.name, tool.enabled]))
      return {
        ...server,
        tools: normalizeMcpTools(tools).map((tool) => ({
          ...tool,
          enabled: existing.get(tool.name) ?? tool.enabled
        })),
        updatedAt: new Date().toISOString()
      }
    }))
  }

  async setToolEnabled(serverId: string, toolName: string, enabled: boolean): Promise<McpServerConfig[]> {
    return this.update((servers) => servers.map((server) => {
      if (server.id !== serverId) return server
      return {
        ...server,
        tools: (server.tools ?? []).map((tool) => tool.name === toolName ? { ...tool, enabled } : tool),
        updatedAt: new Date().toISOString()
      }
    }))
  }

  async importDiscovered(servers: DiscoveredMcpServer[]): Promise<{ servers: McpServerConfig[]; imported: number; skipped: number }> {
    let imported = 0
    let skipped = 0
    const nextServers = await this.update((currentServers) => {
      const existingKeys = new Set(currentServers.map(getMcpServerKey))
      const importedServers: McpServerConfig[] = []
      for (const server of servers) {
        const normalized = normalizeMcpServer({
          ...server,
          id: randomUUID(),
          importedFrom: server.sourcePath,
          updatedAt: new Date().toISOString()
        })
        if (!normalized || existingKeys.has(getMcpServerKey(normalized))) {
          skipped += 1
          continue
        }
        existingKeys.add(getMcpServerKey(normalized))
        importedServers.push(normalized)
        imported += 1
      }
      return [...currentServers, ...importedServers]
    })

    return { servers: nextServers, imported, skipped }
  }

  private async update(mutator: (servers: McpServerConfig[]) => McpServerConfig[]): Promise<McpServerConfig[]> {
    let nextServers: McpServerConfig[] | undefined
    const write = this.writeQueue.then(async () => {
      const servers = await this.list()
      nextServers = normalizeMcpServers(mutator(servers))
      await this.writeAll(nextServers)
    })
    this.writeQueue = write.catch(() => undefined)
    await write
    return nextServers ?? []
  }

  private async writeAll(servers: McpServerConfig[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const tmpPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(tmpPath, JSON.stringify(toMcpJson(servers), null, 2), 'utf8')
    await rename(tmpPath, this.path)
  }
}

export async function discoverExternalMcpServers(): Promise<McpDiscoveryResult> {
  const icon = getDiscoveryDialogIcon()
  const approval = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Scan', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message: 'Discover MCP servers',
    detail: 'Taviraq can read known local MCP configuration files for Claude, VS Code Copilot, Codex, OpenCode, LM Studio, Ollama bridges, Cursor, and Windsurf. Review found servers before importing anything.',
    ...(icon && !icon.isEmpty() ? { icon } : {})
  })
  if (approval.response !== 0) return { servers: [], warnings: [] }

  const home = app.getPath('home')
  const servers: DiscoveredMcpServer[] = []
  const warnings: string[] = []
  const seen = new Set<string>()

  for (const source of DISCOVERY_SOURCES) {
    for (const relativePath of source.paths) {
      for (const sourcePath of await expandDiscoveryPaths(home, relativePath)) {
        if (!await exists(sourcePath)) continue
        try {
          const found = await readMcpServersFromFile(sourcePath, source.source)
          for (const server of found) {
            const discovered: DiscoveredMcpServer = {
              ...server,
              source: source.source,
              sourcePath
            }
            const key = `${source.source}:${sourcePath}:${getMcpServerKey(discovered)}`
            if (seen.has(key)) continue
            seen.add(key)
            servers.push(discovered)
          }
        } catch (error: unknown) {
          warnings.push(`${source.label}: ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }

  return { servers, warnings }
}

async function expandDiscoveryPaths(home: string, relativePath: string): Promise<string[]> {
  const segments = relativePath.split('/')
  const paths = await expandPathSegments(home, segments)
  return paths
}

async function expandPathSegments(base: string, segments: string[]): Promise<string[]> {
  const [segment, ...rest] = segments
  if (!segment) return [base]
  if (segment !== '*') {
    return expandPathSegments(join(base, segment), rest)
  }

  let entries: Array<{ name: string; isDirectory: () => boolean }>
  try {
    entries = await readdir(base, { withFileTypes: true })
  } catch {
    return []
  }

  const expanded = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => expandPathSegments(join(base, entry.name), rest))
  )
  return expanded.flat()
}

function getDiscoveryDialogIcon(): Electron.NativeImage | undefined {
  if (!nativeImage || typeof nativeImage.createFromPath !== 'function') {
    return undefined
  }

  const appPath = typeof app.getAppPath === 'function'
    ? app.getAppPath()
    : process.cwd()
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(appPath, 'build', 'icon.png')

  const icon = nativeImage.createFromPath(iconPath)
  return icon.isEmpty()
    ? icon
    : icon.resize({ width: DISCOVERY_DIALOG_ICON_SIZE, height: DISCOVERY_DIALOG_ICON_SIZE, quality: 'best' })
}

export async function readMcpServersFromFile(path: string, source: McpServerSource): Promise<McpServerConfig[]> {
  const raw = await readFile(path, 'utf8')
  if (path.endsWith('.toml')) {
    return extractMcpServers(parseCodexMcpServersToml(raw), source, path)
  }
  const payload = JSON.parse(raw) as unknown
  return extractMcpServers(payload, source, path)
}

export function parseCodexMcpServersToml(raw: string): { mcpServers: Record<string, unknown> } {
  const servers: Record<string, Record<string, unknown>> = {}
  let currentServer: string | undefined
  let currentEnvServer: string | undefined

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim()
    if (!line) continue

    const section = line.match(/^\[([^\]]+)]$/)?.[1]
    if (section) {
      const path = section.split('.').map((part) => part.trim().replace(/^"|"$/g, ''))
      currentServer = path.length === 2 && path[0] === 'mcp_servers' ? path[1] : undefined
      currentEnvServer = path.length === 3 && path[0] === 'mcp_servers' && path[2] === 'env' ? path[1] : undefined
      if (currentServer) servers[currentServer] ??= {}
      if (currentEnvServer) {
        servers[currentEnvServer] ??= {}
        servers[currentEnvServer].env ??= {}
      }
      continue
    }

    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
    if (!assignment) continue
    const [, key, rawValue] = assignment

    if (currentEnvServer) {
      const value = parseTomlString(rawValue)
      const env = servers[currentEnvServer].env
      if (value !== undefined && isRecord(env)) {
        env[key] = value
      }
      continue
    }

    if (!currentServer) continue
    if (key === 'command') {
      const value = parseTomlString(rawValue)
      if (value !== undefined) servers[currentServer].command = value
    } else if (key === 'args') {
      const value = parseTomlStringArray(rawValue)
      if (value) servers[currentServer].args = value
    } else if (key === 'env') {
      const value = parseTomlInlineStringTable(rawValue)
      if (value) servers[currentServer].env = value
    } else if (key === 'disabled') {
      const value = parseTomlBoolean(rawValue)
      if (value !== undefined) servers[currentServer].disabled = value
    }
  }

  return { mcpServers: servers }
}

export function extractMcpServers(payload: unknown, source: McpServerSource = 'manual', importedFrom?: string): McpServerConfig[] {
  const container = readServerContainer(payload)
  if (!container) return []

  const servers: McpServerConfig[] = []
  if (Array.isArray(container)) {
    for (const entry of container) {
      if (!isRecord(entry)) continue
      const name = typeof entry.name === 'string' ? entry.name : ''
      const server = normalizeMcpServer(withSourceMetadata(entry, name, source, importedFrom))
      if (server) servers.push(server)
    }
    return dedupeMcpServers(servers)
  }

  if (!isRecord(container)) return []
  for (const [name, definition] of Object.entries(container)) {
    if (!isRecord(definition)) continue
    const server = normalizeMcpServer(withSourceMetadata(definition, name, source, importedFrom))
    if (server) servers.push(server)
  }
  return dedupeMcpServers(servers)
}

function withSourceMetadata(
  definition: Record<string, unknown>,
  name: string,
  source: McpServerSource,
  importedFrom?: string
): McpServerDefinition {
  if (source !== 'manual') {
    return { ...definition, name, source, importedFrom }
  }

  return {
    ...definition,
    name,
    source: isMcpServerSource(definition.source) ? definition.source : 'manual',
    importedFrom: typeof definition.importedFrom === 'string' ? definition.importedFrom : undefined
  }
}

export function normalizeMcpServer(server: McpServerDefinition): McpServerConfig | undefined {
  const name = typeof server.name === 'string' ? server.name.trim() : ''
  const command = typeof server.command === 'string' ? server.command.trim() : ''
  if (!name || !command) return undefined

  const now = new Date().toISOString()
  const args = Array.isArray(server.args)
    ? server.args.filter((arg): arg is string => typeof arg === 'string')
    : []
  const env = isRecord(server.env)
    ? Object.fromEntries(
      Object.entries(server.env)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[0].trim().length > 0)
        .map(([key, value]) => [key.trim(), value])
    )
    : {}
  const tools = Array.isArray(server.tools) ? normalizeMcpTools(server.tools) : []
  const id = typeof server.id === 'string' && server.id.trim() ? server.id.trim() : randomUUID()
  const source = isMcpServerSource(server.source) ? server.source : 'manual'
  const enabled = typeof server.enabled === 'boolean'
    ? server.enabled
    : typeof server.disabled === 'boolean'
      ? !server.disabled
      : source === 'manual'
  const importedFrom = typeof server.importedFrom === 'string' && server.importedFrom.trim()
    ? server.importedFrom.trim()
    : undefined

  return {
    id,
    name,
    command,
    ...(args.length > 0 ? { args } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    enabled,
    source,
    ...(importedFrom ? { importedFrom } : {}),
    createdAt: typeof server.createdAt === 'string' && server.createdAt.trim() ? server.createdAt : now,
    updatedAt: typeof server.updatedAt === 'string' && server.updatedAt.trim() ? server.updatedAt : now
  }
}

function normalizeMcpTools(tools: unknown[]): McpToolConfig[] {
  const seen = new Set<string>()
  const normalized: McpToolConfig[] = []
  for (const tool of tools) {
    if (!isRecord(tool)) continue
    const name = typeof tool.name === 'string' ? tool.name.trim() : ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    const description = typeof tool.description === 'string' && tool.description.trim()
      ? tool.description.trim()
      : undefined
    normalized.push({
      name,
      ...(description ? { description } : {}),
      ...(isRecord(tool.inputSchema) ? { inputSchema: tool.inputSchema } : {}),
      enabled: typeof tool.enabled === 'boolean' ? tool.enabled : true
    })
  }
  return normalized
}

function normalizeMcpServers(servers: McpServerConfig[]): McpServerConfig[] {
  return dedupeMcpServers(servers.flatMap((server) => {
    const normalized = normalizeMcpServer(server)
    return normalized ? [normalized] : []
  }))
}

function dedupeMcpServers(servers: McpServerConfig[]): McpServerConfig[] {
  const seen = new Set<string>()
  const deduped: McpServerConfig[] = []
  for (const server of servers) {
    const key = getMcpServerKey(server)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(server)
  }
  return deduped
}

function toMcpJson(servers: McpServerConfig[]): { mcpServers: Record<string, unknown> } {
  return {
    mcpServers: Object.fromEntries(servers.map((server) => [
      server.name,
      {
        id: server.id,
        command: server.command,
        ...(server.args && server.args.length > 0 ? { args: server.args } : {}),
        ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
        ...(server.tools && server.tools.length > 0 ? { tools: server.tools } : {}),
        ...(server.enabled ? {} : { disabled: true }),
        source: server.source ?? 'manual',
        ...(server.importedFrom ? { importedFrom: server.importedFrom } : {}),
        createdAt: server.createdAt,
        updatedAt: server.updatedAt
      }
    ]))
  }
}

function readServerContainer(payload: unknown): unknown {
  if (!isRecord(payload)) return undefined
  if ('mcpServers' in payload) return payload.mcpServers
  if ('servers' in payload) return payload.servers
  if (isRecord(payload.mcp) && 'servers' in payload.mcp) return payload.mcp.servers
  return undefined
}

function getMcpServerKey(server: Pick<McpServerConfig, 'name'>): string {
  return server.name.trim().toLowerCase()
}

function isMcpServerSource(source: unknown): source is McpServerSource {
  return source === 'manual' ||
    source === 'claude' ||
    source === 'copilot' ||
    source === 'codex' ||
    source === 'opencode' ||
    source === 'lmstudio' ||
    source === 'ollama' ||
    source === 'cursor' ||
    source === 'windsurf'
}

function stripTomlComment(line: string): string {
  let quote: '"' | "'" | undefined
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? undefined : quote ?? char
    }
    if (char === '#' && !quote) return line.slice(0, index)
  }
  return line
}

function parseTomlString(value: string): string | undefined {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if ((quote !== '"' && quote !== "'") || trimmed.at(-1) !== quote) return undefined
  const inner = trimmed.slice(1, -1)
  return quote === '"'
    ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    : inner
}

function parseTomlStringArray(value: string): string[] | undefined {
  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return undefined
  const items: string[] = []
  const matcher = /"((?:\\"|[^"])*)"|'([^']*)'/g
  for (const match of trimmed.slice(1, -1).matchAll(matcher)) {
    const item = match[1] !== undefined
      ? match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : match[2]
    items.push(item)
  }
  return items
}

function parseTomlInlineStringTable(value: string): Record<string, string> | undefined {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return undefined
  const env: Record<string, string> = {}
  const matcher = /([A-Za-z0-9_-]+)\s*=\s*("((?:\\"|[^"])*)"|'([^']*)')/g
  for (const match of trimmed.slice(1, -1).matchAll(matcher)) {
    env[match[1]] = match[3] !== undefined
      ? match[3].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : match[4]
  }
  return env
}

function parseTomlBoolean(value: string): boolean | undefined {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return undefined
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function isNodeFileNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
