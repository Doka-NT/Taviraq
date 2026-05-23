import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, vi } from 'vitest'
import { CommandPalette, type CommandPaletteAction } from '@renderer/components/CommandPalette'

const labels = {
  title: 'Command palette',
  search: 'Search actions',
  recent: 'Recent',
  all: 'All actions',
  noMatch: 'No matching actions.',
  enterRuns: 'Enter runs',
  escapeCloses: 'Esc closes'
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function renderPalette(actions: CommandPaletteAction[], onRun = vi.fn()) {
  render(
    <CommandPalette
      actions={actions}
      recentActionIds={[]}
      labels={labels}
      onClose={vi.fn()}
      onRun={onRun}
    />
  )
  return onRun
}

describe('CommandPalette', () => {
  it('filters and runs the switch model action', async () => {
    const user = userEvent.setup()
    const switchModelAction: CommandPaletteAction = {
      id: 'assistant:switch-model',
      title: 'Switch model',
      description: 'Choose a chat model for the current provider.',
      category: 'Assistant',
      keywords: ['assistant', 'model', 'provider', 'llm', 'switch']
    }
    const onRun = renderPalette([
      {
        id: 'terminal:clear',
        title: 'Clear terminal',
        description: 'Clear the active terminal output.',
        category: 'Terminal'
      },
      switchModelAction
    ])

    await user.type(screen.getByPlaceholderText('Search actions'), 'model')
    expect(screen.getByText('Switch model')).toBeInTheDocument()
    expect(screen.queryByText('Clear terminal')).not.toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(onRun).toHaveBeenCalledWith(switchModelAction)
  })
})
