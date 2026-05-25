import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, vi } from 'vitest'
import { CommandPalette, type CommandPaletteAction } from '@renderer/components/CommandPalette'

const labels = {
  title: 'Command palette',
  search: 'Search actions',
  recent: 'Recent',
  all: 'All actions',
  commands: 'Commands',
  snippets: 'Snippets',
  prompts: 'Prompts',
  noMatch: 'No matching actions.',
  enterSelects: 'Enter selects',
  escapeCloses: 'Esc closes'
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function renderPalette(actions: CommandPaletteAction[], onRun = vi.fn(), onClose = vi.fn()) {
  render(
    <CommandPalette
      actions={actions}
      recentActionIds={[]}
      labels={labels}
      onClose={onClose}
      onRun={onRun}
    />
  )
  return { onRun, onClose }
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
    const { onRun } = renderPalette([
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

  it('filters snippets and prompts with tabs and typed prefixes', async () => {
    const user = userEvent.setup()
    renderPalette([
      {
        id: 'terminal:clear',
        title: 'Clear terminal',
        description: 'Clear output.',
        category: 'Terminal',
        paletteCategory: 'commands'
      },
      {
        id: 'snippet:deploy:insert',
        title: 'Insert snippet: Deploy',
        description: 'npm run deploy',
        category: 'Snippets',
        paletteCategory: 'snippets',
        actionHint: 'Inserts'
      },
      {
        id: 'prompt:review',
        title: 'Insert prompt: Review',
        description: 'Review this diff.',
        category: 'Prompts',
        paletteCategory: 'prompts',
        actionHint: 'Inserts'
      }
    ])

    await user.click(screen.getByRole('tab', { name: 'Snippets' }))
    expect(screen.getByText('Insert snippet: Deploy')).toBeInTheDocument()
    expect(screen.queryByText('Insert prompt: Review')).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Search actions'))
    await user.type(screen.getByPlaceholderText('Search actions'), '@review')
    expect(screen.getByText('Insert prompt: Review')).toBeInTheDocument()
    expect(screen.queryByText('Insert snippet: Deploy')).not.toBeInTheDocument()
  })

  it('closes with Escape after focus moves to a category tab', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPalette([
      {
        id: 'snippet:deploy:insert',
        title: 'Insert snippet: Deploy',
        description: 'npm run deploy',
        category: 'Snippets',
        paletteCategory: 'snippets'
      }
    ], vi.fn(), onClose)

    await user.click(screen.getByRole('tab', { name: 'Snippets' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
