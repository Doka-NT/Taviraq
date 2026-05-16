import { describe, expect, it } from 'vitest'
import { commandLineCandidates, lineMatchesCommand } from '../../src/renderer/src/utils/terminalBlocks'

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
  })

  it('keeps the full command as a candidate for single-line commands', () => {
    expect(commandLineCandidates('git status')).toEqual(['git status'])
    expect(lineMatchesCommand('➜  project git status', 'git status')).toBe(true)
  })
})
