// SPDX-License-Identifier: MPL-2.0
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ComposerConfigControl } from '@renderer/components/ComposerConfigControl'
import type { LanguageContextValue } from '@renderer/i18n/language'
import type { Translations } from '@renderer/i18n/translations'

const labels: Record<string, string> = {
  'chat.composer.contextLabel': 'Context',
  'chat.composer.controls': 'Assistant controls',
  'chat.composer.maskedLabel': 'Masked',
  'chat.composer.mode.agent': 'Agent',
  'chat.composer.mode.read': 'Read',
  'chat.composer.mode.off': 'Off',
  'chat.composer.modeLabel': 'Mode',
  'model.switch.title': 'Switch model',
  'panel.promptLibrary': 'Prompt library'
}

const t: LanguageContextValue['t'] = (key: keyof Translations) => labels[key] ?? key

function renderControl(overrides: Partial<ComponentProps<typeof ComposerConfigControl>> = {}) {
  const props: ComponentProps<typeof ComposerConfigControl> = {
    open: true,
    assistMode: 'agent',
    modeLabel: 'Agent',
    modelLabel: 'Claude Opus 4.6',
    contextLabel: 'Context ~12k tokens',
    maskedSecretLabel: '2 masked',
    maskedSecretCount: 2,
    t,
    onOpenChange: vi.fn(),
    onAssistModeChange: vi.fn(),
    onOpenModelSwitcher: vi.fn(),
    onOpenPromptLibrary: vi.fn(),
    ...overrides
  }

  render(<ComposerConfigControl {...props} />)

  return props
}

describe('ComposerConfigControl', () => {
  it('keeps the footer trigger compact while moving context into the popover', () => {
    renderControl()

    const trigger = screen.getByRole('button', { name: 'Assistant controls' })
    expect(trigger).toHaveClass('composer-config-chip', 'agent')
    expect(trigger).toHaveTextContent('Claude Opus 4.6')
    expect(trigger).not.toHaveTextContent('Context ~12k tokens')

    expect(screen.getByRole('dialog', { name: 'Assistant controls' })).toBeInTheDocument()
    expect(screen.getByText('Context ~12k tokens')).toBeInTheDocument()
    expect(screen.getByText('2 masked')).toBeInTheDocument()
  })

  it('exposes mode, model, and prompt actions from the popover', () => {
    const props = renderControl()

    fireEvent.click(screen.getByRole('button', { name: 'Read' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch model' }))
    fireEvent.click(screen.getByRole('button', { name: 'Prompt library' }))

    expect(props.onAssistModeChange).toHaveBeenCalledWith('read')
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    expect(props.onOpenModelSwitcher).toHaveBeenCalledTimes(1)
    expect(props.onOpenPromptLibrary).toHaveBeenCalledTimes(1)
  })
})
