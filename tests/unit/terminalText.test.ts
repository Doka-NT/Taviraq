// SPDX-License-Identifier: MPL-2.0
import { decodeShellIntegrationCommand, stripAnsi } from '@shared/terminalText'

describe('stripAnsi', () => {
  it('removes full OSC sequences terminated by BEL, including shell-integration markers', () => {
    expect(stripAnsi('before\x1b]633;E;echo hi;nonce-value\x07after')).toBe('beforeafter')
    expect(stripAnsi('before\x1b]133;A\x07after')).toBe('beforeafter')
  })

  it('removes OSC sequences terminated by ST (ESC \\\\)', () => {
    expect(stripAnsi('before\x1b]633;P;Cwd=/tmp\x1b\\after')).toBe('beforeafter')
  })

  it('removes CSI sequences without touching plain text', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m text')).toBe('red text')
  })

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain output\nwith lines')).toBe('plain output\nwith lines')
  })
})

describe('decodeShellIntegrationCommand', () => {
  it('decodes escaped delimiters', () => {
    expect(decodeShellIntegrationCommand('a\\x3bb')).toBe('a;b')
    expect(decodeShellIntegrationCommand('a\\x0ab')).toBe('a\nb')
    expect(decodeShellIntegrationCommand('a\\x0db')).toBe('a\rb')
  })

  it('decodes an escaped literal backslash', () => {
    expect(decodeShellIntegrationCommand('a\\\\b')).toBe('a\\b')
  })

  it('round-trips a command whose literal text looks like a delimiter escape', () => {
    // Real command: printf '\x3b' — the shell hook escapes the literal backslash
    // first (\ -> \\), so the wire payload is `printf '\\x3b'` (two backslashes).
    // A naive decoder that resolves \x3b before \\ would corrupt this to `printf '\;'`.
    expect(decodeShellIntegrationCommand("printf '\\\\x3b'")).toBe("printf '\\x3b'")
  })

  it('round-trips a trailing literal backslash', () => {
    expect(decodeShellIntegrationCommand('echo foo\\\\')).toBe('echo foo\\')
  })

  it('leaves an unrecognized backslash sequence untouched', () => {
    expect(decodeShellIntegrationCommand('a\\zb')).toBe('a\\zb')
  })
})
