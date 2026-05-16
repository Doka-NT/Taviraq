import { describe, expect, it } from 'vitest'
import {
  commandLineCandidates,
  commandStartLineCandidates,
  commandVisibleLineCount,
  findCommandStartOffset,
  lineMatchesCommand,
  lineMatchesCommandStart,
  stripCommandEcho,
  terminalTailStartOffset
} from '../../src/renderer/src/utils/terminalBlocks'

describe('terminal block command matching', () => {
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
    expect(commandStartLineCandidates(command)).toEqual(['xmlstarlet sel -t \\', 'xmlstarlet sel -t'])

    expect(stripCommandEcho(command, [
      '➜  artifacts (2) xmlstarlet sel -t \\',
      '  -m \'//*[local-name()="error" or local-name()="warning" or local-name()="failure"]\' \\',
      '  -v \'concat(@line, ":", @column, " ", @message, " ", @source)\' \\',
      '  -n phpcs-report.xml',
      ': Visibility must be declared on all constants'
    ].join('\n'))).toBe(': Visibility must be declared on all constants')
  })

  it('keeps the full command as a candidate for single-line commands', () => {
    expect(commandLineCandidates('git status')).toEqual(['git status'])
    expect(lineMatchesCommand('➜  project git status', 'git status')).toBe(true)
    expect(stripCommandEcho('git status', '➜  project git status\nOn branch main')).toBe('On branch main')
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
  })
})
