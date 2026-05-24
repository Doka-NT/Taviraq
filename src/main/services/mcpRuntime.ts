import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { McpServerConfig, McpToolConfig } from '@shared/types'

const MCP_PROTOCOL_VERSION = '2024-11-05'
const MCP_REQUEST_TIMEOUT_MS = 20_000

interface JsonRpcResponse {
  id?: unknown
  result?: unknown
  error?: { message?: unknown }
}

export interface McpRuntimeTool {
  server: McpServerConfig
  tool: McpToolConfig
}

export function getEnabledMcpTools(servers: McpServerConfig[]): McpRuntimeTool[] {
  return servers.flatMap((server) => {
    if (!server.enabled) return []
    return (server.tools ?? [])
      .filter((tool) => tool.enabled)
      .map((tool) => ({ server, tool }))
  })
}

export async function listMcpServerTools(server: McpServerConfig, signal?: AbortSignal): Promise<McpToolConfig[]> {
  return withMcpSession(server, signal, async (session) => {
    const result = await session.request('tools/list', {})
    if (!isRecord(result) || !Array.isArray(result.tools)) return []
    return result.tools.flatMap((tool): McpToolConfig[] => {
      if (!isRecord(tool) || typeof tool.name !== 'string' || !tool.name.trim()) return []
      return [{
        name: tool.name.trim(),
        ...(typeof tool.description === 'string' && tool.description.trim() ? { description: tool.description.trim() } : {}),
        ...(isRecord(tool.inputSchema) ? { inputSchema: tool.inputSchema } : {}),
        enabled: true
      }]
    })
  })
}

export async function callMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<string> {
  return withMcpSession(server, signal, async (session) => {
    const result = await session.request('tools/call', {
      name: toolName,
      arguments: args
    })
    return formatToolResult(result)
  })
}

async function withMcpSession<T>(
  server: McpServerConfig,
  signal: AbortSignal | undefined,
  callback: (session: McpStdioSession) => Promise<T>
): Promise<T> {
  const session = new McpStdioSession(server)
  const abort = () => session.close()
  signal?.addEventListener('abort', abort)
  try {
    session.start()
    await session.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'Taviraq', version: '0.0.0' }
    })
    session.notify('notifications/initialized', {})
    return await callback(session)
  } finally {
    signal?.removeEventListener('abort', abort)
    session.close()
  }
}

class McpStdioSession {
  private child?: ChildProcessWithoutNullStreams
  private nextId = 1
  private buffer = Buffer.alloc(0)
  private pending = new Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()

  constructor(private readonly server: McpServerConfig) {}

  start(): void {
    const shell = process.env.SHELL || '/bin/zsh'
    this.child = spawn(shell, ['-lc', buildShellLaunchScript(this.server)], {
      env: { ...process.env, ...(this.server.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child.stdout.on('data', (chunk: Buffer) => this.receive(chunk))
    this.child.stderr.on('data', () => undefined)
    this.child.on('error', (error) => this.rejectAll(error))
    this.child.on('exit', (code) => this.rejectAll(new Error(`MCP server ${this.server.name} exited with code ${code ?? 'unknown'}.`)))
  }

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const child = this.child
    if (!child) return Promise.reject(new Error('MCP server is not running.'))
    const id = this.nextId++
    const payload = { jsonrpc: '2.0', id, method, params }
    child.stdin.write(`${JSON.stringify(payload)}\n`)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP request ${method} timed out for ${this.server.name}.`))
      }, MCP_REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timeout })
    })
  }

  notify(method: string, params: Record<string, unknown>): void {
    const child = this.child
    if (!child) return
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  close(): void {
    this.child?.kill()
    this.child = undefined
    this.rejectAll(new Error('MCP session closed.'))
  }

  private receive(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (true) {
      if (this.buffer.toString('utf8', 0, Math.min(this.buffer.length, 32)).startsWith('Content-Length:')) {
        if (!this.receiveContentLengthMessage()) return
        continue
      }

      const newline = this.buffer.indexOf('\n')
      if (newline === -1) return
      const line = this.buffer.slice(0, newline).toString('utf8').trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (line) this.handleMessage(line)
    }
  }

  private receiveContentLengthMessage(): boolean {
    const headerEnd = this.buffer.indexOf('\r\n\r\n')
    if (headerEnd === -1) return false
    const header = this.buffer.slice(0, headerEnd).toString('utf8')
    const length = header.match(/Content-Length:\s*(\d+)/i)?.[1]
    if (!length) {
      this.buffer = this.buffer.slice(headerEnd + 4)
      return true
    }
    const bodyLength = Number(length)
    const bodyStart = headerEnd + 4
    const bodyEnd = bodyStart + bodyLength
    if (this.buffer.length < bodyEnd) return false
    const body = this.buffer.slice(bodyStart, bodyEnd).toString('utf8')
    this.buffer = this.buffer.slice(bodyEnd)
    this.handleMessage(body)
    return true
  }

  private handleMessage(body: string): void {
    let message: JsonRpcResponse
    try {
      message = JSON.parse(body) as JsonRpcResponse
    } catch {
      return
    }
    if (typeof message.id !== 'number') return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    clearTimeout(pending.timeout)
    if (message.error) {
      pending.reject(new Error(typeof message.error.message === 'string' ? message.error.message : 'MCP request failed.'))
      return
    }
    pending.resolve(message.result)
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id)
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
  }
}

export function buildShellLaunchScript(server: Pick<McpServerConfig, 'command' | 'args'>): string {
  return [
    'exec 3>&1',
    'exec 1>&2',
    'if [ -n "${ZSH_VERSION:-}" ] && [ -r "${HOME}/.zshrc" ]; then source "${HOME}/.zshrc"; fi',
    'if [ -n "${BASH_VERSION:-}" ] && [ -r "${HOME}/.bashrc" ]; then source "${HOME}/.bashrc"; fi',
    'exec 1>&3',
    `eval ${shellQuote(buildShellCommand(server.command, server.args ?? []))}`
  ].join('\n')
}

function buildShellCommand(command: string, args: string[]): string {
  const executable = /^[A-Za-z0-9_.-]+$/.test(command) ? command : shellQuote(command)
  return [executable, ...args.map(shellQuote)].join(' ')
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function formatToolResult(result: unknown): string {
  if (!isRecord(result)) return JSON.stringify(result)
  const content = result.content
  if (Array.isArray(content)) {
    const text = content.map((part) => {
      if (!isRecord(part)) return ''
      if (typeof part.text === 'string') return part.text
      return JSON.stringify(part)
    }).filter(Boolean).join('\n')
    if (text) return text
  }
  return JSON.stringify(result)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
