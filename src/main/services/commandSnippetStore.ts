import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CommandSnippet } from '@shared/types'

const FILE_NAME = 'command-snippets.json'

interface CommandSnippetFile {
  version: 1
  snippets: CommandSnippet[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'command'
}

function normalizeSnippet(snippet: Partial<CommandSnippet>): CommandSnippet | null {
  const name = typeof snippet.name === 'string' ? snippet.name.trim() : ''
  const command = typeof snippet.command === 'string' ? snippet.command.trim() : ''
  if (!name || !command) return null

  const now = new Date().toISOString()
  return {
    id: typeof snippet.id === 'string' && snippet.id ? snippet.id : `${Date.now()}-${slugify(name)}`,
    name,
    command,
    createdAt: typeof snippet.createdAt === 'string' && snippet.createdAt ? snippet.createdAt : now,
    updatedAt: typeof snippet.updatedAt === 'string' && snippet.updatedAt ? snippet.updatedAt : now
  }
}

export class CommandSnippetStore {
  private readonly path = join(app.getPath('userData'), FILE_NAME)

  async list(): Promise<CommandSnippet[]> {
    try {
      const raw = await readFile(this.path, 'utf8')
      const parsed = JSON.parse(raw) as Partial<CommandSnippetFile>
      const snippets = Array.isArray(parsed.snippets) ? parsed.snippets : []
      return snippets
        .map((snippet) => normalizeSnippet(snippet))
        .filter((snippet): snippet is CommandSnippet => Boolean(snippet))
    } catch {
      return []
    }
  }

  async save(snippet: CommandSnippet): Promise<CommandSnippet> {
    const snippets = await this.list()
    const now = new Date().toISOString()
    const normalized = normalizeSnippet({
      ...snippet,
      updatedAt: now,
      createdAt: snippet.createdAt || now
    })
    if (!normalized) {
      throw new Error('Snippet name and command are required')
    }

    const existingIndex = snippets.findIndex((candidate) => candidate.id === normalized.id)
    const next = existingIndex === -1
      ? [...snippets, normalized]
      : snippets.map((candidate, index) => index === existingIndex ? normalized : candidate)

    await this.write(next)
    return normalized
  }

  async importMany(incoming: CommandSnippet[]): Promise<number> {
    const snippets = await this.list()
    const existingIds = new Set(snippets.map((snippet) => snippet.id))
    const additions = incoming
      .map((snippet) => normalizeSnippet(snippet))
      .filter((snippet): snippet is CommandSnippet => Boolean(snippet))
      .filter((snippet) => !existingIds.has(snippet.id))

    if (additions.length > 0) {
      await this.write([...snippets, ...additions])
    }

    return additions.length
  }

  async delete(id: string): Promise<void> {
    const snippets = await this.list()
    await this.write(snippets.filter((snippet) => snippet.id !== id))
  }

  private async write(snippets: CommandSnippet[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const payload: CommandSnippetFile = { version: 1, snippets }
    await writeFile(this.path, JSON.stringify(payload, null, 2), 'utf8')
  }
}
