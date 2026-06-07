// SPDX-License-Identifier: MPL-2.0
import { app, shell } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

/**
 * Persists the assistant's detailed task plan (issue #71) to a temp file and
 * reveals it in the OS file manager.
 *
 * Security (issue #71 notes): the file path is derived entirely inside the app
 * from a hash of the session id — never from the LLM or user text — so a
 * malicious plan body cannot redirect the write or the reveal. Plans live under
 * a single app-owned temp dir and are overwritten per session, so nothing
 * lingers beyond the latest plan.
 */
export class TaskPlanStore {
  private readonly dir = join(app.getPath('temp'), 'taviraq-task-plans')

  private fileNameFor(sessionId: string): string {
    const safe = createHash('sha256').update(sessionId).digest('hex').slice(0, 16)
    return `plan-${safe}.md`
  }

  /** Write the plan for a session and return the absolute file path. */
  async writePlan(sessionId: string, plan: string): Promise<string> {
    await mkdir(this.dir, { recursive: true })
    const filePath = join(this.dir, this.fileNameFor(sessionId))
    await writeFile(filePath, plan, 'utf8')
    return filePath
  }

  /** Reveal an existing plan file in the OS file manager (Finder on macOS). */
  async revealPlan(sessionId: string, plan: string): Promise<void> {
    const filePath = await this.writePlan(sessionId, plan)
    shell.showItemInFolder(filePath)
  }
}
