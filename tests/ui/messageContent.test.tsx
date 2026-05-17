import { render, screen, within } from '@testing-library/react'
import { MessageContent } from '@renderer/components/MessageContent'

describe('MessageContent', () => {
  it('renders markdown headings without the leading hashes', () => {
    render(
      <MessageContent
        content={[
          '# Main title',
          '',
          'Intro text.',
          '',
          '### Smaller **section**'
        ].join('\n')}
      />
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Main title' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Smaller section' })).toBeInTheDocument()
    expect(screen.queryByText('# Main title')).not.toBeInTheDocument()
  })

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

  it('adds a visual mini-bar summary for numeric tables', () => {
    render(
      <MessageContent
        content={[
          '| Resource | Reclaimable |',
          '|----------|-------------|',
          '| Images | `1.918 GB` |',
          '| Volumes | `890 MB` |'
        ].join('\n')}
      />
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Images')).toHaveLength(2)
    expect(screen.getAllByText('1.918 GB')).toHaveLength(2)
  })

  it('renders fenced shell commands as compact runnable action pills', () => {
    const onRun = vi.fn()

    render(
      <MessageContent
        content={'```bash\nnpm run typecheck\n```'}
        onRun={onRun}
      />
    )

    screen.getByRole('button', { name: 'Run in terminal' }).click()

    expect(screen.getByText('npm run typecheck')).toBeInTheDocument()
    expect(onRun).toHaveBeenCalledWith('npm run typecheck')
  })

  it('redacts displayed shell commands without changing the runnable command', () => {
    const onRun = vi.fn()
    const command = 'echo "[[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]"'

    render(
      <MessageContent
        content={`\`\`\`bash\n${command}\n\`\`\``}
        onRun={onRun}
        redactContent={(value) => value.replace(/\[\[TAVIRAQ_SECRET_\d+_[A-Z0-9_]+\]\]/g, '[secret]')}
      />
    )

    screen.getByRole('button', { name: 'Run in terminal' }).click()

    expect(screen.getByText('echo "[secret]"')).toBeInTheDocument()
    expect(screen.queryByText(command)).not.toBeInTheDocument()
    expect(onRun).toHaveBeenCalledWith(command)
  })
})
