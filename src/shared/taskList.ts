/**
 * Task list / step-by-step planning support (issue #71).
 *
 * The task list is *derived state*: the assistant emits a fenced ```tasklist
 * block and the app parses it out of the message stream. The detailed plan is
 * an optional ```taskplan block saved to a temp file. Neither language is a
 * shell language, so these blocks never collide with agent-mode command
 * auto-run (which keys off a `выполню:` / `i will run:` marker + a shell fence).
 */

export type TaskStatus = 'pending' | 'active' | 'done'

export interface TaskListItem {
  text: string
  status: TaskStatus
}

export interface TaskList {
  items: TaskListItem[]
}

export const TASK_LIST_FENCE_LANG = 'tasklist'
export const TASK_PLAN_FENCE_LANG = 'taskplan'

const FENCE_RE = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
// - [ ] pending · - [x]/[X] done · - [-]/[~]/[>]/[*] active (in progress)
const CHECKLIST_LINE_RE = /^\s*[-*]\s*\[([ xX~>*-])\]\s*(.*\S)?\s*$/

function statusFromMark(mark: string): TaskStatus {
  const normalized = mark.toLowerCase()
  if (normalized === 'x') return 'done'
  if (normalized === ' ') return 'pending'
  return 'active'
}

/** Parse the checklist lines inside a single `tasklist` block body. */
export function parseTaskListBlock(body: string): TaskListItem[] {
  const items: TaskListItem[] = []
  for (const line of body.split(/\r?\n/)) {
    const match = CHECKLIST_LINE_RE.exec(line)
    if (!match) continue
    const text = (match[2] ?? '').trim()
    if (!text) continue
    items.push({ text, status: statusFromMark(match[1]) })
  }
  return items
}

/** Extract the last fenced block of `lang` from a single message's text. */
export function extractLastFencedBlock(text: string, lang: string): string | undefined {
  let body: string | undefined
  for (const match of text.matchAll(FENCE_RE)) {
    if (match[1].toLowerCase() === lang) body = match[2]
  }
  return body
}

/**
 * Resolve the active task list from a conversation. The assistant re-emits the
 * full list each turn to update progress, so the most recent `tasklist` block
 * wins. Returns null when planning produced no usable list.
 */
export function parseTaskListFromMessages(
  messages: Array<{ role: string; content: string }>
): TaskList | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant' || !message.content) continue
    const block = extractLastFencedBlock(message.content, TASK_LIST_FENCE_LANG)
    if (block === undefined) continue
    const items = parseTaskListBlock(block)
    if (items.length > 0) return { items }
  }
  return null
}

/** Most recent detailed-plan (`taskplan`) block across the conversation. */
export function parseTaskPlanFromMessages(
  messages: Array<{ role: string; content: string }>
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant' || !message.content) continue
    const block = extractLastFencedBlock(message.content, TASK_PLAN_FENCE_LANG)
    if (block !== undefined && block.trim()) return block.trim()
  }
  return null
}

export interface TaskListProgress {
  total: number
  done: number
  active: number
}

export function summarizeTaskList(list: TaskList | null): TaskListProgress {
  if (!list) return { total: 0, done: 0, active: 0 }
  let done = 0
  let active = 0
  for (const item of list.items) {
    if (item.status === 'done') done += 1
    else if (item.status === 'active') active += 1
  }
  return { total: list.items.length, done, active }
}
