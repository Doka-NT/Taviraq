// SPDX-License-Identifier: MPL-2.0
import type { IMarker, Terminal } from '@xterm/xterm'
import { decodeShellIntegrationCommand } from '@shared/terminalText'

export interface CommandBlock {
  id: string
  sessionId: string
  promptStart: IMarker
  commandStart?: IMarker
  outputStart?: IMarker
  end?: IMarker
  command: string
  exitCode?: number
  cwd?: string
  quality: 'osc' | 'heuristic'
}

export type BlockTrackerActivity = 'running' | 'idle'

const OSC_633E_PREFIX = '\x1b]633;E;'

export function hasCommandText(block: Pick<CommandBlock, 'command'>): boolean {
  return block.command.trim().length > 0
}

export function remapRestored633ENonce(output: string, oldNonce: string | undefined, newNonce: string | undefined): string {
  if (!oldNonce || !newNonce || oldNonce === newNonce) return output

  let input = output
  let result = ''

  while (true) {
    const markerIndex = input.indexOf(OSC_633E_PREFIX)
    if (markerIndex === -1) return result + input

    result += input.slice(0, markerIndex)
    const marker = input.slice(markerIndex + OSC_633E_PREFIX.length)
    const belIndex = marker.indexOf('\x07')
    const stIndex = marker.indexOf('\x1b\\')
    const endIndex = belIndex === -1 ? stIndex : stIndex === -1 ? belIndex : Math.min(belIndex, stIndex)
    if (endIndex === -1) return result + OSC_633E_PREFIX + marker

    const terminator = marker[endIndex] === '\x07' ? '\x07' : '\x1b\\'
    const payload = marker.slice(0, endIndex)
    const nonceSeparator = payload.lastIndexOf(';')
    if (nonceSeparator !== -1 && payload.slice(nonceSeparator + 1) === oldNonce) {
      result += `${OSC_633E_PREFIX}${payload.slice(0, nonceSeparator + 1)}${newNonce}${terminator}`
    } else {
      result += `${OSC_633E_PREFIX}${payload}${terminator}`
    }
    input = marker.slice(endIndex + terminator.length)
  }
}

export class BlockTracker {
  private readonly blocks: CommandBlock[] = []
  private pending: { id: string; promptStart: IMarker; commandStart?: IMarker; outputStart?: IMarker; command: string; cwd?: string } | null = null
  private readonly disposeHandlers: Array<() => void> = []

  constructor(
    private readonly terminal: Terminal,
    private readonly sessionId: string,
    private readonly nonce: string,
    private readonly onChange: () => void,
    private readonly onActivityChange: (activity: BlockTrackerActivity) => void
  ) {
    const h133 = terminal.parser.registerOscHandler(133, (data) => this.handle133(data))
    const h633 = terminal.parser.registerOscHandler(633, (data) => this.handle633(data))
    this.disposeHandlers.push(() => h133.dispose(), () => h633.dispose())
  }

  hasBlocks(): boolean {
    return this.blocks.length > 0 || this.pending !== null
  }

  getBlocks(): CommandBlock[] {
    return this.blocks
  }

  blockAtRow(row: number): CommandBlock | undefined {
    const len = this.terminal.buffer.active.length
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const block = this.blocks[i]
      if (block.promptStart.isDisposed) continue
      const start = block.promptStart.line
      const end = block.end && !block.end.isDisposed ? block.end.line : len
      if (row >= start && row < end) return block
    }
    return undefined
  }

  blockRange(block: CommandBlock): { start: number; end: number } | undefined {
    if (block.promptStart.isDisposed) return undefined
    const outputStart = block.outputStart && !block.outputStart.isDisposed
      ? block.outputStart.line
      : block.commandStart && !block.commandStart.isDisposed
        ? block.commandStart.line
        : block.promptStart.line
    const endMarker = block.end && !block.end.isDisposed ? block.end : undefined
    const endLine = endMarker ? endMarker.line - 1 : this.terminal.buffer.active.length - 1
    // No Math.max clamp here: when a command produces no output, the D marker
    // lands on the same row as outputStart (endLine < outputStart). readLines
    // already treats from > to as empty, so clamping to outputStart would
    // instead pull in that row's content once the next prompt renders there.
    return { start: outputStart, end: endLine }
  }

  blockHighlightRange(block: CommandBlock): { start: number; end: number } | undefined {
    if (block.promptStart.isDisposed) return undefined
    const start = block.promptStart.line
    const endMarker = block.end && !block.end.isDisposed ? block.end : undefined
    const endLine = endMarker ? endMarker.line - 1 : this.terminal.buffer.active.length - 1
    return { start, end: Math.max(start, endLine) }
  }

  blockOutputText(block: CommandBlock): string {
    const range = this.blockRange(block)
    if (!range) return ''
    return this.readLines(range.start, range.end)
  }

  blockFullText(block: CommandBlock): string {
    const output = this.blockOutputText(block)
    const command = hasCommandText(block) ? `$ ${block.command}` : ''
    return [command, output].filter(Boolean).join('\n')
  }

  dispose(): void {
    for (const fn of this.disposeHandlers) fn()
    for (const block of this.blocks) {
      this.disposeBlockMarkers(block)
    }
    if (this.pending) {
      this.pending.promptStart.dispose()
      this.pending.commandStart?.dispose()
      this.pending.outputStart?.dispose()
    }
    this.blocks.length = 0
    this.pending = null
  }

  private handle133(data: string): boolean {
    const semi = data.indexOf(';')
    const code = semi === -1 ? data : data.slice(0, semi)
    const param = semi === -1 ? '' : data.slice(semi + 1)

    switch (code) {
      case 'A': {
        // Prompt start — finalize any open block (Ctrl-C / no D)
        if (this.pending) {
          this.finalizePending(undefined, undefined)
        }
        this.onActivityChange('idle')
        const marker = this.terminal.registerMarker(0)
        if (!marker) return true
        this.pending = {
          id: crypto.randomUUID(),
          promptStart: marker,
          command: ''
        }
        break
      }
      case 'B': {
        if (!this.pending) return true
        const marker = this.terminal.registerMarker(0)
        if (marker) this.pending.commandStart = marker
        break
      }
      case 'C': {
        if (!this.pending) return true
        const marker = this.terminal.registerMarker(0)
        if (marker) this.pending.outputStart = marker
        this.onActivityChange('running')
        break
      }
      case 'D': {
        const exitCode = param !== '' ? parseInt(param, 10) : undefined
        this.finalizePending(this.terminal.registerMarker(0) ?? undefined, exitCode)
        this.onActivityChange('idle')
        break
      }
    }
    return true
  }

  private handle633(data: string): boolean {
    if (data.startsWith('E;')) {
      // 633;E;<escaped-cmdline>;<nonce>
      const payload = data.slice(2)
      const lastSemi = payload.lastIndexOf(';')
      if (lastSemi === -1) return true
      const receivedNonce = payload.slice(lastSemi + 1)
      if (!this.nonce || receivedNonce !== this.nonce) return true
      const escapedCmd = payload.slice(0, lastSemi)
      if (this.pending) {
        this.pending.command = decodeShellIntegrationCommand(escapedCmd)
      }
    } else if (data.startsWith('P;Cwd=')) {
      const cwd = data.slice('P;Cwd='.length)
      if (this.pending) {
        this.pending.cwd = cwd
      } else if (this.blocks.length > 0) {
        this.blocks[this.blocks.length - 1].cwd = cwd
      }
    }
    return true
  }

  private finalizePending(endMarker: IMarker | undefined, exitCode: number | undefined): void {
    const p = this.pending
    this.pending = null
    if (!p) return

    const block: CommandBlock = {
      id: p.id,
      sessionId: this.sessionId,
      promptStart: p.promptStart,
      commandStart: p.commandStart,
      outputStart: p.outputStart,
      end: endMarker,
      command: p.command,
      exitCode,
      cwd: p.cwd,
      quality: 'osc'
    }
    this.blocks.push(block)
    this.onChange()
  }

  private readLines(startLine: number, endLine: number): string {
    const buf = this.terminal.buffer.active
    const len = buf.length
    const from = Math.max(0, startLine)
    const to = Math.min(len - 1, endLine)
    if (from > to) return ''

    const lines: string[] = []
    for (let i = from; i <= to; i++) {
      lines.push(buf.getLine(i)?.translateToString(true) ?? '')
    }
    return lines.join('\n').trim()
  }

  private disposeBlockMarkers(block: CommandBlock): void {
    if (!block.promptStart.isDisposed) block.promptStart.dispose()
    if (block.commandStart && !block.commandStart.isDisposed) block.commandStart.dispose()
    if (block.outputStart && !block.outputStart.isDisposed) block.outputStart.dispose()
    if (block.end && !block.end.isDisposed) block.end.dispose()
  }
}
