function normalizeCommand(command: string): string {
  return command.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function candidatesForLine(line: string): string[] {
  const candidates = new Set<string>()
  const trimmed = line.trim()
  if (!trimmed) return []

  candidates.add(trimmed)

  const withoutContinuation = trimmed.replace(/\\\s*$/, '').trim()
  if (withoutContinuation) {
    candidates.add(withoutContinuation)
  }

  return [...candidates].sort((a, b) => b.length - a.length)
}

type CommandStartPreference = 'first' | 'last'

function candidateIndex(value: string, candidate: string, preference: CommandStartPreference): number {
  return preference === 'first' ? value.indexOf(candidate) : value.lastIndexOf(candidate)
}

function lineMatchesEchoCandidate(line: string, candidate: string, firstLine: boolean): boolean {
  if (line === candidate) return true
  if (firstLine) return line.endsWith(candidate)

  return line.endsWith(`> ${candidate}`)
}

function lineMatchesBlankEcho(line: string): boolean {
  return line === '' || /^\S*>\s*$/.test(line)
}

export function commandLineCandidates(command: string): string[] {
  const candidates = new Set<string>()
  const normalized = normalizeCommand(command)
  if (!normalized) return []

  if (!normalized.includes('\n') && !/\\\s*$/.test(normalized)) {
    return [normalized]
  }

  candidates.add(normalized)

  for (const line of normalized.split('\n')) {
    for (const candidate of candidatesForLine(line)) {
      candidates.add(candidate)
    }
  }

  return [...candidates].sort((a, b) => b.length - a.length)
}

export function commandStartLineCandidates(command: string): string[] {
  const firstLine = normalizeCommand(command)
    .split('\n')
    .find((line) => line.trim())

  return firstLine ? candidatesForLine(firstLine) : []
}

export function commandVisibleLineCount(command: string): number {
  const normalized = normalizeCommand(command)
  return normalized ? normalized.split('\n').length : 0
}

export function lineMatchesCommand(line: string, command: string): boolean {
  return commandLineCandidates(command).some((candidate) => line.includes(candidate))
}

export function lineMatchesCommandStart(line: string, command: string): boolean {
  return commandStartLineCandidates(command).some((candidate) => line.includes(candidate))
}

export function terminalTailStartOffset(output: string, lineLimit: number): number {
  let start = output.length

  for (let count = 0; count < lineLimit; count += 1) {
    const previousNewline = output.lastIndexOf('\n', start - 1)
    if (previousNewline === -1) return 0
    start = previousNewline
  }

  return start + 1
}

export function findBufferedCommandStartOffset(output: string, command: string): number {
  const visibleLineCount = commandVisibleLineCount(command)
  if (visibleLineCount === 0) return output.length

  return findCommandStartOffset(output, command, {
    searchStart: terminalTailStartOffset(output, visibleLineCount + 2),
    preference: 'last'
  })
}

export function findCommandStartOffset(
  output: string,
  command: string,
  options: {
    searchStart?: number
    searchEnd?: number
    preference?: CommandStartPreference
  } = {}
): number {
  const normalized = normalizeCommand(command)
  if (!normalized) return output.length

  const searchStart = Math.max(0, Math.min(output.length, options.searchStart ?? 0))
  const searchEnd = Math.max(searchStart, Math.min(output.length, options.searchEnd ?? output.length))
  const preference = options.preference ?? 'last'
  const searchableOutput = output.slice(searchStart, searchEnd)
  const candidates = [normalized, ...commandStartLineCandidates(command)]
  let matchedIndex: number | undefined

  for (const [candidatePosition, candidate] of candidates.entries()) {
    const index = candidateIndex(searchableOutput, candidate, preference)
    if (index === -1) continue

    if (candidatePosition === 0) {
      matchedIndex = index
      break
    }

    matchedIndex = matchedIndex === undefined
      ? index
      : preference === 'first'
        ? Math.min(matchedIndex, index)
        : Math.max(matchedIndex, index)
  }

  if (matchedIndex === undefined) return output.length

  const absoluteIndex = searchStart + matchedIndex
  const previousNewline = output.lastIndexOf('\n', absoluteIndex)
  return previousNewline === -1 ? 0 : previousNewline + 1
}

export function stripCommandEcho(command: string, text: string): string {
  const normalizedCommand = normalizeCommand(command)
  const commandLines = normalizedCommand ? normalizedCommand.split('\n') : []
  if (commandLines.length === 0) return text

  const lines = text.split('\n')
  let index = 0

  for (const [commandLineIndex, commandLine] of commandLines.entries()) {
    const line = lines[index]
    if (line === undefined) return text

    const trimmedLine = line.trim()
    if (!commandLine.trim()) {
      if (!lineMatchesBlankEcho(trimmedLine)) return text
      index += 1
      continue
    }

    const matches = candidatesForLine(commandLine).some((candidate) =>
      lineMatchesEchoCandidate(trimmedLine, candidate, commandLineIndex === 0)
    )
    if (!matches) return text

    index += 1
  }

  return lines.slice(index).join('\n').trim()
}
