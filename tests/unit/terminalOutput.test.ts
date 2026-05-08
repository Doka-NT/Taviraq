import { describe, expect, it } from 'vitest'
import { outputWithVisibleCursor } from '../../src/renderer/src/utils/terminalOutput'

describe('outputWithVisibleCursor', () => {
  it('restores cursor visibility after replaying buffered TUI output', () => {
    expect(outputWithVisibleCursor('vim\x1b[?25l')).toBe('vim\x1b[?25l\x1b[?25h')
  })

  it('leaves empty buffers empty', () => {
    expect(outputWithVisibleCursor('')).toBe('')
  })
})
