// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it } from 'vitest'

import {
  parseTaskListBlock,
  parseTaskListFromMessages,
  summarizeTaskList,
  TASK_LIST_FENCE_LANG
} from '@shared/taskList'

function tasklist(body: string): string {
  return '```' + TASK_LIST_FENCE_LANG + '\n' + body + '\n```'
}

describe('parseTaskListBlock', () => {
  it('reads pending, active and done checkbox marks', () => {
    const items = parseTaskListBlock([
      '- [ ] first',
      '- [-] second',
      '- [x] third',
      '- [X] fourth'
    ].join('\n'))

    expect(items).toEqual([
      { text: 'first', status: 'pending' },
      { text: 'second', status: 'active' },
      { text: 'third', status: 'done' },
      { text: 'fourth', status: 'done' }
    ])
  })

  it('ignores non-checklist and empty lines', () => {
    const items = parseTaskListBlock([
      'Plan:',
      '- [ ] real step',
      '   ',
      'not a step'
    ].join('\n'))

    expect(items).toEqual([{ text: 'real step', status: 'pending' }])
  })
})

describe('parseTaskListFromMessages', () => {
  it('uses the most recent task list so progress reflects the latest turn', () => {
    const list = parseTaskListFromMessages([
      { role: 'assistant', content: tasklist('- [ ] a\n- [ ] b') },
      { role: 'user', content: 'go on' },
      { role: 'assistant', content: tasklist('- [x] a\n- [-] b') }
    ])

    expect(list).toEqual({
      items: [
        { text: 'a', status: 'done' },
        { text: 'b', status: 'active' }
      ]
    })
  })

  it('returns null when no assistant message carries a task list', () => {
    expect(parseTaskListFromMessages([
      { role: 'user', content: '- [ ] not from assistant' },
      { role: 'assistant', content: 'plain answer, no block' }
    ])).toBeNull()
  })

  it('does not treat a shell command block as a task list', () => {
    // Agent-mode auto-run uses a ```bash block; it must never become a checklist.
    const list = parseTaskListFromMessages([
      { role: 'assistant', content: 'Выполню:\n```bash\nrm -rf build\n```' }
    ])
    expect(list).toBeNull()
  })
})


describe('summarizeTaskList', () => {
  it('counts done and active items', () => {
    expect(summarizeTaskList({
      items: [
        { text: 'a', status: 'done' },
        { text: 'b', status: 'active' },
        { text: 'c', status: 'pending' }
      ]
    })).toEqual({ total: 3, done: 1, active: 1 })
  })

  it('is zeroed for a null list', () => {
    expect(summarizeTaskList(null)).toEqual({ total: 0, done: 0, active: 0 })
  })
})
