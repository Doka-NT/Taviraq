import { describe, expect, it } from 'vitest'
import {
  commandLineCandidates,
  commandStartLineCandidates,
  commandVisibleLineCount,
  findBufferedCommandStartOffset,
  findCommandStartOffset,
  lineMatchesCommand,
  lineMatchesCommandStart,
  stripCommandEcho,
  terminalTailStartOffset
} from '../../src/renderer/src/utils/terminalBlocks'

describe('terminal block command matching', () => {
  it('handles empty and whitespace-only commands', () => {
    expect(commandLineCandidates('')).toEqual([])
    expect(commandLineCandidates('   \n\t')).toEqual([])
    expect(commandStartLineCandidates('')).toEqual([])
    expect(commandVisibleLineCount('   ')).toBe(0)
    expect(lineMatchesCommand('anything', '')).toBe(false)
    expect(lineMatchesCommandStart('anything', '   ')).toBe(false)
    expect(stripCommandEcho('', 'output')).toBe('output')
  })

  it('matches multiline commands by their visible command lines', () => {
    const command = [
      'xmlstarlet sel -t \\',
      '  -m \'//*[local-name()="error" or local-name()="warning" or local-name()="failure"]\' \\',
      '  -v \'concat(@line, ":", @column, " ", @message, " ", @source)\' \\',
      '  -n phpcs-report.xml'
    ].join('\n')

    expect(lineMatchesCommand('➜  artifacts (2) xmlstarlet sel -t \\', command)).toBe(true)
    expect(lineMatchesCommand('  -n phpcs-report.xml', command)).toBe(true)
    expect(lineMatchesCommandStart('➜  artifacts (2) xmlstarlet sel -t \\', command)).toBe(true)
    expect(lineMatchesCommandStart('  -n phpcs-report.xml', command)).toBe(false)
    expect(commandVisibleLineCount(command)).toBe(4)
    expect(commandLineCandidates(command)).not.toContain(command)
    expect(commandStartLineCandidates(command)).toEqual(['xmlstarlet sel -t \\', 'xmlstarlet sel -t'])

    expect(stripCommandEcho(command, [
      '➜  artifacts (2) xmlstarlet sel -t \\',
      '  -m \'//*[local-name()="error" or local-name()="warning" or local-name()="failure"]\' \\',
      '  -v \'concat(@line, ":", @column, " ", @message, " ", @source)\' \\',
      '  -n phpcs-report.xml',
      ': Visibility must be declared on all constants'
    ].join('\n'))).toBe(': Visibility must be declared on all constants')

    expect(stripCommandEcho(command, [
      '➜  artifacts (2) xmlstarlet sel -t \\',
      '>   -m \'//*[local-name()="error" or local-name()="warning" or local-name()="failure"]\' \\',
      'quote>   -v \'concat(@line, ":", @column, " ", @message, " ", @source)\' \\',
      '>   -n phpcs-report.xml',
      ': Visibility must be declared on all constants'
    ].join('\n'))).toBe(': Visibility must be declared on all constants')
  })

  it('strips echoed blank rows from multiline commands', () => {
    const command = 'cat <<EOF\nalpha\n\nomega\nEOF'

    expect(commandVisibleLineCount(command)).toBe(5)
    expect(stripCommandEcho(command, [
      '➜  project cat <<EOF',
      '> alpha',
      '>',
      '> omega',
      '> EOF',
      'alpha',
      '',
      'omega'
    ].join('\n'))).toBe('alpha\n\nomega')
  })

  it('keeps the full command as a candidate for single-line commands', () => {
    expect(commandLineCandidates('git status')).toEqual(['git status'])
    expect(lineMatchesCommand('➜  project git status', 'git status')).toBe(true)
    expect(lineMatchesCommand('prefix git status suffix', 'git status')).toBe(false)
    expect(lineMatchesCommand('false', 'ls')).toBe(false)
    expect(lineMatchesCommandStart('false', 'ls')).toBe(false)
    expect(findCommandStartOffset('false\n', 'ls')).toBe('false\n'.length)
    expect(stripCommandEcho('git status', '➜  project git status\nOn branch main')).toBe('On branch main')
    expect(stripCommandEcho('git status', 'On branch main')).toBe('On branch main')
    expect(stripCommandEcho('git status', 'prefix git status suffix\nOn branch main')).toBe('prefix git status suffix\nOn branch main')
  })

  it('normalizes CRLF commands', () => {
    const command = 'printf one \\\r\n  && printf two'

    expect(commandVisibleLineCount(command)).toBe(2)
    expect(lineMatchesCommandStart('➜  project printf one \\', command)).toBe(true)
    expect(stripCommandEcho(command, '➜  project printf one \\\n  && printf two\none two')).toBe('one two')
  })

  it('keeps command start matching scoped to the current terminal block', () => {
    const command = 'xmlstarlet sel -t \\\n  -n phpcs-report.xml'
    const previousRun = [
      '➜  artifacts (2) xmlstarlet sel -t \\',
      '  -n phpcs-report.xml',
      'old output'
    ].join('\n')
    const beforeCurrentEcho = `${previousRun}\n➜  artifacts (2) `
    const currentEcho = [
      'xmlstarlet sel -t \\',
      '  -n phpcs-report.xml'
    ].join('\n')
    const output = `${beforeCurrentEcho}${currentEcho}\nnew output\nxmlstarlet sel -t \\`

    expect(findCommandStartOffset(beforeCurrentEcho, command, {
      searchStart: terminalTailStartOffset(beforeCurrentEcho, 1)
    })).toBe(beforeCurrentEcho.length)

    expect(findCommandStartOffset(output, command, {
      searchStart: previousRun.length + 1,
      preference: 'first'
    })).toBe(previousRun.length + 1)

    expect(findCommandStartOffset(output, command, { searchStart: output.length + 100 })).toBe(output.length)
  })

  it('finds an already-buffered command echo at the terminal tail', () => {
    const command = 'xmlstarlet sel -t \\\n  -n phpcs-report.xml'
    const previousRun = [
      '➜  artifacts (2) xmlstarlet sel -t \\',
      '> -n phpcs-report.xml',
      'old output'
    ].join('\n')
    const currentRunLineStart = previousRun.length + 1
    const output = [
      previousRun,
      '➜  artifacts (2) xmlstarlet sel -t \\',
      '> -n phpcs-report.xml'
    ].join('\n')

    expect(findBufferedCommandStartOffset(output, command)).toBe(currentRunLineStart)
    expect(findBufferedCommandStartOffset('old output\n➜  artifacts (2) ', command)).toBe('old output\n➜  artifacts (2) '.length)
  })

  it('can include the first row of long multiline commands in tail searches', () => {
    const command = Array.from({ length: 24 }, (_, index) => `echo line-${index} \\`).join('\n')
    const output = `➜  project ${command}\n`
    const fixedTailStart = terminalTailStartOffset(output, 20)
    const commandAwareTailStart = terminalTailStartOffset(output, commandVisibleLineCount(command) + 2)

    expect(findCommandStartOffset(output, command, { searchStart: fixedTailStart })).toBe(output.length)
    expect(findCommandStartOffset(output, command, { searchStart: commandAwareTailStart })).toBe(0)
    expect(terminalTailStartOffset('one\ntwo\n', 1)).toBe('one\n'.length)
    expect(terminalTailStartOffset('one\ntwo', 1)).toBe('one\n'.length)
  })
})
