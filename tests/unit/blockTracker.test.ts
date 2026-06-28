// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it, vi } from 'vitest'
import type { IMarker, Terminal } from '@xterm/xterm'
import { BlockTracker, type BlockTrackerActivity } from '../../src/renderer/src/utils/blockTracker'

function createTracker(): {
  tracker: BlockTracker
  handlers: Map<number, (data: string) => boolean>
  activities: BlockTrackerActivity[]
  onChange: ReturnType<typeof vi.fn>
} {
  const handlers = new Map<number, (data: string) => boolean>()
  const activities: BlockTrackerActivity[] = []
  const onChange = vi.fn()
  let line = 0
  const terminal = {
    parser: {
      registerOscHandler: (code: number, handler: (data: string) => boolean) => {
        handlers.set(code, handler)
        return { dispose: vi.fn() }
      }
    },
    registerMarker: () => {
      const marker = {
        line: line++,
        isDisposed: false,
        dispose() { this.isDisposed = true }
      }
      return marker as unknown as IMarker
    },
    buffer: {
      active: {
        length: 10,
        getLine: () => undefined
      }
    }
  } as unknown as Terminal

  const tracker = new BlockTracker(
    terminal,
    'session-1',
    'nonce',
    onChange,
    (activity) => activities.push(activity)
  )
  return { tracker, handlers, activities, onChange }
}

describe('BlockTracker activity', () => {
  it('reports idle at a prompt and running while a command produces output', () => {
    const { handlers, activities, onChange } = createTracker()
    const handle133 = handlers.get(133)

    expect(handle133?.('A')).toBe(true)
    expect(handle133?.('B')).toBe(true)
    expect(handle133?.('C')).toBe(true)
    expect(handle133?.('D;0')).toBe(true)

    expect(activities).toEqual(['idle', 'running', 'idle'])
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('returns to idle when a new prompt finalizes a block without D', () => {
    const { handlers, activities, onChange, tracker } = createTracker()
    const handle133 = handlers.get(133)

    handle133?.('A')
    handle133?.('C')
    handle133?.('A')

    expect(activities).toEqual(['idle', 'running', 'idle'])
    expect(onChange).toHaveBeenCalledOnce()
    expect(tracker.getBlocks()).toHaveLength(1)
  })
})
