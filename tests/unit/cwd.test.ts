import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveExistingCwd } from '@main/utils/cwd'

const createdDirs: string[] = []

describe('resolveExistingCwd', () => {
  afterEach(async () => {
    for (const dir of createdDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('uses the requested cwd when it exists', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'ait-cwd-'))
    createdDirs.push(cwd)

    expect(resolveExistingCwd(cwd, '/fallback')).toBe(cwd)
  })

  it('falls back when the requested cwd is missing', () => {
    expect(resolveExistingCwd('/definitely/missing/ai-terminal-cwd', '/fallback')).toBe('/fallback')
  })
})
