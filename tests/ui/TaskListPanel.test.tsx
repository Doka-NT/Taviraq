// SPDX-License-Identifier: MPL-2.0
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TaskListPanel } from '@renderer/components/TaskListPanel'
import type { TaskList } from '@shared/taskList'
import type { LanguageContextValue } from '@renderer/i18n/language'

const t = ((key: string) => key) as unknown as LanguageContextValue['t']

const taskList: TaskList = {
  items: [
    { text: 'Step one', status: 'done' },
    { text: 'Step two', status: 'active' },
    { text: 'Step three', status: 'pending' }
  ]
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof TaskListPanel>> = {}) {
  return render(
    <TaskListPanel
      taskList={taskList}
      t={t}
      {...overrides}
    />
  )
}

describe('TaskListPanel', () => {
  it('is collapsed by default', () => {
    const { container } = renderPanel()
    const toggle = container.querySelector('.task-list-toggle') as HTMLButtonElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('ol')?.hasAttribute('hidden')).toBe(true)
  })

  it('shows the in-progress step and progress in the collapsed preview', () => {
    const { container } = renderPanel()
    const preview = container.querySelector('.task-list-current-step')
    expect(preview).not.toBeNull()
    expect(preview?.textContent).toContain('Step two')
    // progress line still rendered
    expect(container.querySelector('.task-list-panel-progress')?.textContent).toContain('taskList.progress')
  })

  it('expands on click and reveals the full step list without the hidden flag', () => {
    const { container } = renderPanel()
    const toggle = container.querySelector('.task-list-toggle') as HTMLButtonElement
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('ol')?.hasAttribute('hidden')).toBe(false)
    // the section itself gains the expanded modifier used for chevron rotation
    expect(container.querySelector('.task-list-panel')?.classList.contains('expanded')).toBe(true)
  })

  it('collapses again on a second click', () => {
    const { container } = renderPanel()
    const toggle = container.querySelector('.task-list-toggle') as HTMLButtonElement
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('ol')?.hasAttribute('hidden')).toBe(true)
  })

  it('marks the toggle as keyboard-focusable and wired to the step list', () => {
    const { container } = renderPanel()
    const toggle = container.querySelector('.task-list-toggle') as HTMLButtonElement
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.getAttribute('aria-controls')).toBe('task-list-items')
    expect(container.querySelector('ol')?.id).toBe('task-list-items')
  })

  it('resets to collapsed when remounted for a new task list (new request)', () => {
    // LlmPanel keys TaskListPanel on the last user-message index, so a new agent
    // request remounts the panel instead of swapping props in place — which would
    // otherwise let `expanded=true` leak from the previous checklist.
    const listA: TaskList = { items: [{ text: 'A1', status: 'active' }] }
    const listB: TaskList = {
      items: [{ text: 'B1', status: 'active' }, { text: 'B2', status: 'pending' }]
    }
    const { container, rerender } = render(<TaskListPanel taskList={listA} t={t} />)
    const toggle = container.querySelector('.task-list-toggle') as HTMLButtonElement
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    rerender(<TaskListPanel key="next-request" taskList={listB} t={t} />)
    const nextToggle = container.querySelector('.task-list-toggle') as HTMLButtonElement
    expect(nextToggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('ol')?.hasAttribute('hidden')).toBe(true)
  })
})
