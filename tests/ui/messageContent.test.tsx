import { render, screen, within } from '@testing-library/react'
import { MessageContent } from '@renderer/components/MessageContent'

describe('MessageContent', () => {
  it('renders markdown tables as real tables', () => {
    render(
      <MessageContent
        content={[
          'Docker details:',
          '',
          '| Resource | Total | Active | Reclaimable |',
          '|----------|-------|--------|-------------|',
          '| Images | **31** | 22 | `1.918 GB` |',
          '| Containers | 34 | 29 | 1.061 MB |',
          '',
          'Done.'
        ].join('\n')}
      />
    )

    const table = screen.getByRole('table')

    expect(screen.getByText('Docker details:')).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Resource' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Reclaimable' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Images' })).toBeInTheDocument()
    expect(within(table).getByText('1.918 GB')).toHaveClass('inline-code')
    expect(screen.getByText('Done.')).toBeInTheDocument()
    expect(screen.queryByText('|----------|-------|--------|-------------|')).not.toBeInTheDocument()
  })
})
