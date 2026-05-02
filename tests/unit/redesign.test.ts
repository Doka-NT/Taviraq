import {
  buildActionChips,
  buildSuggestionChips,
  detectMiniBarRows,
  formatModelLabel,
  statusToInlineStatus
} from '@renderer/utils/redesign'

describe('redesign helpers', () => {
  it('formats provider model IDs into friendly labels', () => {
    expect(formatModelLabel('x-ai/grok-4.1-fast')).toEqual({ name: 'Grok', version: '4.1 fast' })
    expect(formatModelLabel('anthropic/claude-opus-4-6')).toEqual({ name: 'Claude', version: 'Opus 4.6' })
    expect(formatModelLabel('openai/gpt-4o')).toEqual({ name: 'GPT-4o', version: '' })
    expect(formatModelLabel('qwen/qwen-turbo')).toEqual({ name: 'Qwen Turbo', version: '' })
    expect(formatModelLabel('')).toEqual({ name: 'Assistant', version: 'Choose a model' })
  })

  it('builds contextual empty-state suggestions', () => {
    const suggestions = buildSuggestionChips({
      cwd: '/repo/project',
      terminalOutput: 'On branch main\nDockerfile\nerror.log\n5.2G node_modules'
    })

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual(['git', 'docker', 'logs'])
  })

  it('detects numeric table data for mini bars', () => {
    const bars = detectMiniBarRows(
      ['Resource', 'Total', 'Reclaimable'],
      [
        ['Images', '31', '1.918 GB'],
        ['Containers', '34', '1.061 MB'],
        ['Volumes', '4', '890 MB']
      ]
    )

    expect(bars).toHaveLength(3)
    expect(bars[0]).toMatchObject({ label: 'Images', displayValue: '1.918 GB', ratio: 1 })
    expect(bars[1]?.ratio).toBeLessThan(1)
  })

  it('derives safe next-step action chips from assistant content', () => {
    expect(buildActionChips('docker system prune could clean unused images')).toEqual([
      { label: 'Plan cleanup', prompt: 'Create a safe Docker cleanup plan before running anything.' },
      { label: 'Show details', prompt: 'Show the detailed Docker resources behind this recommendation.' }
    ])
  })

  it('maps status strings to inline status tones', () => {
    expect(statusToInlineStatus('Safety check failed')).toMatchObject({ tone: 'danger' })
    expect(statusToInlineStatus('Checking command safety...')).toMatchObject({ tone: 'warning' })
    expect(statusToInlineStatus('Saved')).toMatchObject({ tone: 'success' })
  })
})
