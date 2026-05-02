import { join } from 'node:path'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { vi, describe, it, expect, afterEach } from 'vitest'

// We test against a temp directory.  Since PromptStore reads
// `app.getPath('userData')` at construction time, we mock `electron`.
const TMP_DIR = join(__dirname, '__tmp_prompt_store__')

vi.mock('electron', () => ({
  app: {
    getPath: () => TMP_DIR
  },
  dialog: {}
}))

// Import AFTER mock
import { PromptStore } from '@main/services/promptStore'

const store = new PromptStore()

async function cleanTmp(): Promise<void> {
  if (existsSync(TMP_DIR)) {
    await rm(TMP_DIR, { recursive: true })
  }
}

describe('PromptStore', () => {
  afterEach(() => cleanTmp())

  describe('list()', () => {
    it('returns empty array when no prompts', async () => {
      const result = await store.list()
      expect(result).toEqual([])
    })

    it('parses a plain markdown file using filename as name', async () => {
      await mkdir(TMP_DIR, { recursive: true })
      await mkdir(join(TMP_DIR, 'prompts'), { recursive: true })
      await writeFile(join(TMP_DIR, 'prompts', 'my-prompt.md'), 'Hello world', 'utf-8')

      const result = await store.list()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('my-prompt')
      expect(result[0].name).toBe('my-prompt')
      expect(result[0].content).toBe('Hello world')
    })

    it('parses JSON frontmatter', async () => {
      await mkdir(join(TMP_DIR, 'prompts'), { recursive: true })
      const content = '---json\n{"name":"My Prompt","createdAt":"2025-01-01T00:00:00.000Z"}\n---\nSome content\n'
      await writeFile(join(TMP_DIR, 'prompts', 'abc.md'), content, 'utf-8')

      const result = await store.list()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My Prompt')
      expect(result[0].content).toBe('Some content')
      expect(result[0].createdAt).toBe('2025-01-01T00:00:00.000Z')
    })

    it('skips files with empty content', async () => {
      await mkdir(join(TMP_DIR, 'prompts'), { recursive: true })
      await writeFile(join(TMP_DIR, 'prompts', 'empty.md'), '   \n  \n', 'utf-8')

      const result = await store.list()
      expect(result).toEqual([])
    })

    it('ignores non-.md files', async () => {
      await mkdir(join(TMP_DIR, 'prompts'), { recursive: true })
      await writeFile(join(TMP_DIR, 'prompts', 'notes.txt'), 'Hello', 'utf-8')

      const result = await store.list()
      expect(result).toEqual([])
    })
  })

  describe('save()', () => {
    it('creates a new prompt with generated id', async () => {
      const result = await store.save({
        id: '',
        name: 'Test Prompt',
        content: 'Hello!',
        createdAt: ''
      })

      expect(result.id).toBeTruthy()
      expect(result.name).toBe('Test Prompt')
      expect(result.content).toBe('Hello!')
      expect(result.createdAt).toBeTruthy()

      // Verify file exists
      const fileContent = await readFile(join(TMP_DIR, 'prompts', `${result.id}.md`), 'utf-8')
      expect(fileContent).toContain('Test Prompt')
      expect(fileContent).toContain('Hello!')
    })

    it('updates an existing prompt', async () => {
      const created = await store.save({
        id: '',
        name: 'Original',
        content: 'Original content',
        createdAt: ''
      })

      const updated = await store.save({
        id: created.id,
        name: 'Updated',
        content: 'New content',
        createdAt: created.createdAt
      })

      expect(updated.id).toBe(created.id)
      expect(updated.name).toBe('Updated')
      expect(updated.content).toBe('New content')

      // Should be exactly one file
      const all = await store.list()
      const matching = all.filter((p) => p.id === created.id)
      expect(matching).toHaveLength(1)
      expect(matching[0].name).toBe('Updated')
    })
  })

  describe('delete()', () => {
    it('removes a prompt file', async () => {
      const created = await store.save({
        id: '',
        name: 'To Delete',
        content: 'bye',
        createdAt: ''
      })

      await store.delete(created.id)

      const all = await store.list()
      expect(all.find((p) => p.id === created.id)).toBeUndefined()
    })

    it('does not throw on missing file', async () => {
      await expect(store.delete('nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('importFromFile()', () => {
    it('imports a plain markdown file', async () => {
      const srcDir = join(TMP_DIR, 'import_src')
      await mkdir(srcDir, { recursive: true })
      const srcFile = join(srcDir, 'explain-error.md')
      await writeFile(srcFile, 'Explain the following error in detail', 'utf-8')

      const result = await store.importFromFile(srcFile)
      expect(result.name).toBe('explain-error')
      expect(result.content).toBe('Explain the following error in detail')
      expect(result.id).toContain('explain-error')

      // Should appear in list
      const all = await store.list()
      expect(all.find((p) => p.id === result.id)).toBeDefined()
    })
  })
})
