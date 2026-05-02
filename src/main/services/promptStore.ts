import { app } from 'electron'
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { PromptTemplate } from '@shared/types'

const PROMPTS_DIR_NAME = 'prompts'
const FILE_EXTENSION = '.md'

/**
 * Parse a prompt .md file with optional JSON frontmatter.
 *
 * Supported formats:
 *
 * 1. Plain markdown (name = filename without extension):
 *    ```
 *    Explain this error
 *    ```
 *
 * 2. JSON frontmatter:
 *    ```
 *    ---json
 *    {"name":"Explain this error","createdAt":"2026-01-01T00:00:00.000Z"}
 *    ---
 *    Content goes here
 *    ```
 */
function parsePromptFile(fileName: string, raw: string): PromptTemplate | null {
  const id = fileName.replace(/\.md$/i, '')
  let name = id
  let content = raw
  let createdAt: string

  const frontmatterMatch = raw.match(/^---json\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (frontmatterMatch) {
    try {
      const parsed: unknown = JSON.parse(frontmatterMatch[1])
      const meta = (typeof parsed === 'object' && parsed !== null) ? parsed as Record<string, unknown> : {}
      if (typeof meta.name === 'string') name = meta.name
      createdAt = typeof meta.createdAt === 'string' ? meta.createdAt : new Date().toISOString()
    } catch {
      createdAt = new Date().toISOString()
    }
    content = frontmatterMatch[2]
  } else {
    createdAt = new Date().toISOString()
  }

  if (!content.trim()) return null

  return { id, name, content: content.trim(), createdAt }
}

function serializePromptFile(prompt: PromptTemplate): string {
  const meta = JSON.stringify({ name: prompt.name, createdAt: prompt.createdAt })
  return `---json\n${meta}\n---\n${prompt.content}\n`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'prompt'
}

export class PromptStore {
  private readonly dir: string

  constructor() {
    this.dir = join(app.getPath('userData'), PROMPTS_DIR_NAME)
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true })
  }

  async list(): Promise<PromptTemplate[]> {
    await this.ensureDir()
    const files = await readdir(this.dir)
    const prompts: PromptTemplate[] = []

    for (const file of files) {
      if (!file.endsWith(FILE_EXTENSION)) continue
      try {
        const raw = await readFile(join(this.dir, file), 'utf-8')
        const prompt = parsePromptFile(file, raw)
        if (prompt) prompts.push(prompt)
      } catch {
        // skip unreadable files
      }
    }

    return prompts
  }

  async save(prompt: PromptTemplate): Promise<PromptTemplate> {
    await this.ensureDir()

    const isNew = !prompt.id
    const id = prompt.id || `${Date.now()}-${slugify(prompt.name)}`
    const createdAt = prompt.createdAt || new Date().toISOString()

    const result: PromptTemplate = {
      id,
      name: prompt.name,
      content: prompt.content,
      createdAt
    }

    const fileName = `${id}${FILE_EXTENSION}`
    await writeFile(join(this.dir, fileName), serializePromptFile(result), 'utf-8')

    // If renamed (old file exists with different name), clean up old file
    if (!isNew && prompt.id) {
      // The file is overwritten in place since id stays the same
    }

    return result
  }

  async delete(id: string): Promise<void> {
    await this.ensureDir()
    const fileName = `${id}${FILE_EXTENSION}`
    try {
      await unlink(join(this.dir, fileName))
    } catch {
      // File may not exist, ignore
    }
  }

  async importFromFile(filePath: string): Promise<PromptTemplate> {
    const raw = await readFile(filePath, 'utf-8')
    const baseName = filePath.split('/').pop()?.replace(/\.md$/i, '') || 'imported'
    const id = `${Date.now()}-${slugify(baseName)}`

    const prompt = parsePromptFile(`${id}.md`, raw)
    if (prompt) {
      // Use the filename as the name when there is no frontmatter
      if (!raw.startsWith('---json')) {
        prompt.name = baseName
      }
      prompt.id = id
      await this.ensureDir()
      await writeFile(join(this.dir, `${id}${FILE_EXTENSION}`), serializePromptFile(prompt), 'utf-8')
      return prompt
    }

    // Fallback: treat entire file as content
    const result: PromptTemplate = {
      id,
      name: baseName,
      content: raw.trim(),
      createdAt: new Date().toISOString()
    }
    await this.ensureDir()
    await writeFile(join(this.dir, `${id}${FILE_EXTENSION}`), serializePromptFile(result), 'utf-8')
    return result
  }
}
