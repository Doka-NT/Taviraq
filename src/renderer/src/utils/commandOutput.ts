import {
  SECRET_PLACEHOLDER_GLOBAL_RE,
  SECRET_PLACEHOLDER_RE
} from '@shared/secretPlaceholders'

const ANSI_ESCAPE = String.fromCharCode(27)
const OSC_RE = new RegExp(`${ANSI_ESCAPE}\\][^\\u0007]*(?:\\u0007|${ANSI_ESCAPE}\\\\)`, 'g')
const ANSI_RE = new RegExp(
  `${ANSI_ESCAPE}\\[[0-9;?]*[ -/]*[@-~]|${ANSI_ESCAPE}[@-_]|\\r(?!\\n)|[\\u0080-\\u009f]`,
  'g'
)

export const stripAnsi = (s: string): string => s.replace(OSC_RE, '').replace(ANSI_RE, '')

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeTerminalOutput(output: string): string {
  return stripAnsi(output)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function matchesResolvedSecretEcho(command: string, line: string): boolean {
  if (!SECRET_PLACEHOLDER_RE.test(command)) return false
  const pattern = command.split(SECRET_PLACEHOLDER_GLOBAL_RE).map(escapeRegExp).join('[^\\n]+')
  return new RegExp(`^${pattern}$`).test(line)
}

export function cleanCommandOutput(command: string, output: string): string {
  const normalizedCommand = command.trim()
  const normalizedOutput = normalizeTerminalOutput(output)
  const endedWithNewline = /[\r\n]$/.test(normalizedOutput)
  const lines = normalizedOutput.split('\n')
  const shouldDropTrailingPrompt = !endedWithNewline && lines.length > 1

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift()
  }

  const firstLine = lines[0]?.trim() ?? ''
  if (firstLine === normalizedCommand || matchesResolvedSecretEcho(normalizedCommand, firstLine)) {
    lines.shift()
  }

  if (shouldDropTrailingPrompt) {
    lines.pop()
  }

  while (lines.length > 0 && lines.at(-1)?.trim() === '') {
    lines.pop()
  }

  return lines.join('\n').trim()
}
