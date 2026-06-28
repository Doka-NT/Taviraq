// SPDX-License-Identifier: MPL-2.0
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MessageContent } from '@renderer/components/MessageContent'

describe('MessageContent', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
  })

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
        content={'```Bash\nnpm run typecheck\n```'}
        onRun={onRun}
      />
    )

    screen.getByRole('button', { name: 'Run in terminal' }).click()

    expect(screen.getByText('npm run typecheck')).toBeInTheDocument()
    expect(onRun).toHaveBeenCalledWith('npm run typecheck')
  })

  it('renders non-shell fenced code as a scrollable code block without run controls', () => {
    const onRun = vi.fn()
    const { container } = render(
      <MessageContent
        content={[
          '```json',
          '{',
          '  "script": "npm run typecheck",',
          '  "safe": true',
          '}',
          '```'
        ].join('\n')}
        onRun={onRun}
      />
    )

    const codeBlock = container.querySelector('.msg-code-block')

    expect(codeBlock).toBeInTheDocument()
    expect(within(codeBlock as HTMLElement).getByText('json')).toBeInTheDocument()
    expect(screen.getByText(/"script": "npm run typecheck"/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run in terminal' })).not.toBeInTheDocument()
  })

  it('treats unlabeled fenced blocks as code, not runnable commands', () => {
    const onRun = vi.fn()

    render(
      <MessageContent
        content={'```\nPlease send this support request.\nDo not run it.\n```'}
        onRun={onRun}
      />
    )

    expect(screen.getByText('code')).toBeInTheDocument()
    expect(screen.getByText(/Please send this support request/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run in terminal' })).not.toBeInTheDocument()
  })

  it('lets multiline shell commands expand while keeping the full runnable command', () => {
    const onRun = vi.fn()
    const command = [
      'docker compose \\',
      '  --project-name taviraq \\',
      '  --file docker-compose.yml \\',
      '  up --detach'
    ].join('\n')

    render(
      <MessageContent
        content={`\`\`\`bash\n${command}\n\`\`\``}
        onRun={onRun}
      />
    )

    const expandButton = screen.getByRole('button', { name: 'Show full command' })
    expect(expandButton.closest('.msg-action-pill')).toHaveClass('msg-action-pill--collapsed')

    fireEvent.click(expandButton)
    expect(screen.getByRole('button', { name: 'Collapse command' }).closest('.msg-action-pill')).not.toHaveClass(
      'msg-action-pill--collapsed'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run in terminal' }))
    expect(onRun).toHaveBeenCalledWith(command)
  })

  it('lets long single-line shell commands expand before running', () => {
    const onRun = vi.fn()
    const command = 'docker compose --project-name taviraq --file docker-compose.yml --profile demo up --detach --remove-orphans'

    render(
      <MessageContent
        content={`\`\`\`bash\n${command}\n\`\`\``}
        onRun={onRun}
      />
    )

    const expandButton = screen.getByRole('button', { name: 'Show full command' })
    expect(expandButton.closest('.msg-action-pill')).toHaveClass('msg-action-pill--collapsed')

    fireEvent.click(expandButton)
    expect(screen.getByRole('button', { name: 'Collapse command' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Run in terminal' }))
    expect(onRun).toHaveBeenCalledWith(command)
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

  it('copies non-shell fenced code blocks', async () => {
    render(
      <MessageContent
        content={[
          '```json',
          '{',
          '  "safe": true',
          '}',
          '```'
        ].join('\n')}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('{\n  "safe": true\n}')
    })
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('copies the displayed redacted shell command', async () => {
    const command = 'echo "[[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]"'

    render(
      <MessageContent
        content={`\`\`\`bash\n${command}\n\`\`\``}
        redactContent={(value) => value.replace(/\[\[TAVIRAQ_SECRET_\d+_[A-Z0-9_]+\]\]/g, '[secret]')}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('echo "[secret]"')
    })
  })

  it('renders an unclosed fenced block as code while still streaming (issue #176)', () => {
    const onRun = vi.fn()
    const { container } = render(
      <MessageContent
        content={[
          'Here is the script:',
          '',
          '```bash',
          'set -euo pipefail',
          'apt-get update'
        ].join('\n')}
        onRun={onRun}
      />
    )

    expect(screen.getByText('Here is the script:')).toBeInTheDocument()
    expect(screen.getByText(/set -euo pipefail/)).toBeInTheDocument()
    // The opening fence must not leak into the rendered text.
    expect(screen.queryByText(/```/)).not.toBeInTheDocument()
    // A still-streaming shell fence must be inert: no Run button on a possibly
    // truncated command, and it renders as a plain code block, not an action pill.
    expect(container.querySelector('.msg-code-block')).toBeInTheDocument()
    expect(container.querySelector('.msg-action-pill')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run in terminal' })).not.toBeInTheDocument()
  })

  it('keeps text before an unclosed fence on the text path, not inside the code block', () => {
    render(
      <MessageContent
        content={['Доступные шаги:', '', '```', 'partial output'].join('\n')}
      />
    )

    expect(screen.getByText('Доступные шаги:')).toBeInTheDocument()
    expect(screen.getByText(/partial output/)).toBeInTheDocument()
    expect(screen.queryByText(/```/)).not.toBeInTheDocument()
  })

  it('still closes and renders the fence once the stream completes', () => {
    render(
      <MessageContent
        content={['```bash', 'echo done', '```'].join('\n')}
        onRun={vi.fn()}
      />
    )

    expect(screen.getByText('echo done')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run in terminal' })).toBeInTheDocument()
  })

  const planningContent = [
    'Here is the plan.',
    '',
    '```tasklist',
    '- [ ] Read AGENTS.md',
    '```',
    '',
    '```taskplan',
    'Detailed steps go here.',
    '```',
    '',
    'Starting now.'
  ].join('\n')

  it('hides the tasklist fence when the panel is active but keeps taskplan visible', () => {
    const { container } = render(
      <MessageContent content={planningContent} hidePlanningFences />
    )

    expect(screen.getByText('Here is the plan.')).toBeInTheDocument()
    expect(screen.getByText('Starting now.')).toBeInTheDocument()
    // tasklist is rendered by TaskListPanel, so it is hidden from the body...
    expect(screen.queryByText('tasklist')).not.toBeInTheDocument()
    expect(screen.queryByText(/Read AGENTS\.md/)).not.toBeInTheDocument()
    // ...but taskplan now has no alternate rendering, so it stays as a code block.
    expect(container.querySelectorAll('.msg-code-block')).toHaveLength(1)
    expect(screen.getByText('taskplan')).toBeInTheDocument()
    expect(screen.getByText(/Detailed steps go here\./)).toBeInTheDocument()
  })

  it('keeps planning fences as code blocks when the task list panel is inactive', () => {
    const { container } = render(<MessageContent content={planningContent} />)

    expect(screen.getByText('Here is the plan.')).toBeInTheDocument()
    expect(screen.getByText('Starting now.')).toBeInTheDocument()
    expect(container.querySelectorAll('.msg-code-block')).toHaveLength(2)
    expect(screen.getByText('tasklist')).toBeInTheDocument()
    expect(screen.getByText('taskplan')).toBeInTheDocument()
    expect(screen.getByText(/Read AGENTS\.md/)).toBeInTheDocument()
    expect(screen.getByText(/Detailed steps go here\./)).toBeInTheDocument()
  })
})
