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

function isWhitespace(value: string): boolean {
  return value.trim() === ''
}

function isCommandBoundaryBefore(value: string | undefined): boolean {
  return value === undefined || isWhitespace(value) || '>$#%❯➜'.includes(value)
}

function isCommandBoundaryAfter(value: string, start: number): boolean {
  for (let index = start; index < value.length; index += 1) {
    const char = value[index]
    if (char === '\n' || char === '\r') return true
    if (!isWhitespace(char)) return false
  }

  return true
}

function candidateMatchesAtLineEnd(value: string, candidate: string, index: number): boolean {
  if (index < 0) return false

  return isCommandBoundaryBefore(value[index - 1]) &&
    isCommandBoundaryAfter(value, index + candidate.length)
}

function candidateIndex(value: string, candidate: string, preference: CommandStartPreference): number {
  if (!candidate) return -1

  if (preference === 'first') {
    for (let index = value.indexOf(candidate); index !== -1; index = value.indexOf(candidate, index + 1)) {
      if (candidateMatchesAtLineEnd(value, candidate, index)) return index
    }

    return -1
  }

  let index = value.lastIndexOf(candidate)
  while (index !== -1) {
    if (candidateMatchesAtLineEnd(value, candidate, index)) return index
    if (index === 0) break
    index = value.lastIndexOf(candidate, index - 1)
  }

  return -1
}

function lineEndsWithCommandCandidate(line: string, candidate: string): boolean {
  const value = line.trimEnd()
  if (!candidate || !value.endsWith(candidate)) return false

  return isCommandBoundaryBefore(value[value.length - candidate.length - 1])
}

function lineMatchesEchoCandidate(line: string, candidate: string): boolean {
  return lineEndsWithCommandCandidate(line, candidate)
}

function lineMatchesBlankEcho(line: string): boolean {
  if (line === '') return true

  const promptEnd = line.indexOf('>')
  return promptEnd !== -1 &&
    ![...line.slice(0, promptEnd)].some(isWhitespace) &&
    line.slice(promptEnd + 1).trim() === ''
}

export function commandLineCandidates(command: string): string[] {
  const candidates = new Set<string>()
  const normalized = normalizeCommand(command)
  if (!normalized) return []

  if (!normalized.includes('\n')) {
    return candidatesForLine(normalized)
  }

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
  return commandLineCandidates(command).some((candidate) => lineEndsWithCommandCandidate(line, candidate))
}

export function lineMatchesCommandStart(line: string, command: string): boolean {
  return commandStartLineCandidates(command).some((candidate) => lineEndsWithCommandCandidate(line, candidate))
}

export function terminalTailStartOffset(output: string, lineLimit: number): number {
  let start = output.endsWith('\n') ? output.length - 1 : output.length

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
  const candidates = commandStartLineCandidates(command)
  let matchedIndex: number | undefined

  for (const candidate of candidates) {
    const index = candidateIndex(searchableOutput, candidate, preference)
    if (index === -1) continue

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

  for (const commandLine of commandLines) {
    const line = lines[index]
    if (line === undefined) return text

    const trimmedLine = line.trim()
    if (!commandLine.trim()) {
      if (!lineMatchesBlankEcho(trimmedLine)) return text
      index += 1
      continue
    }

    const matches = candidatesForLine(commandLine).some((candidate) =>
      lineMatchesEchoCandidate(trimmedLine, candidate)
    )
    if (!matches) return text

    index += 1
  }

  return lines.slice(index).join('\n').trim()
}
