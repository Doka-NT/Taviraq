// SPDX-License-Identifier: MPL-2.0
import { useState } from 'react'
import { Check, ChevronDown, Circle, ListChecks, Loader2 } from 'lucide-react'
import type { TaskList } from '@shared/taskList'
import { summarizeTaskList } from '@shared/taskList'
import type { LanguageContextValue } from '@renderer/i18n/language'

interface TaskListPanelProps {
  taskList: TaskList
  t: LanguageContextValue['t']
}

export function TaskListPanel({
  taskList,
  t
}: TaskListPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const progress = summarizeTaskList(taskList)
  const activeStep = taskList.items.find((item) => item.status === 'active')

  const toggleLabel = expanded
    ? t('taskList.hideSteps')
    : t('taskList.showSteps')
        .replace('{done}', String(progress.done))
        .replace('{total}', String(progress.total))

  return (
    <section
      className={`task-list-panel${expanded ? ' expanded' : ''}`}
      aria-label={t('taskList.title')}
    >
      <button
        type="button"
        className="task-list-toggle"
        aria-expanded={expanded}
        aria-controls="task-list-items"
        aria-label={toggleLabel}
        onClick={() => { setExpanded((v) => !v) }}
      >
        <span className="task-list-panel-title">
          <ListChecks size={13} aria-hidden />
          <strong>{t('taskList.title')}</strong>
        </span>
        <span className="task-list-panel-progress">
          {t('taskList.progress')
            .replace('{done}', String(progress.done))
            .replace('{total}', String(progress.total))}
        </span>
        <ChevronDown size={12} className="task-list-chevron" aria-hidden />
      </button>

      {activeStep && !expanded ? (
        <div className="task-list-current-step">
          <span className="task-list-item-icon">
            <Loader2 size={13} className="task-list-spin" />
          </span>
          <span className="task-list-item-text">{activeStep.text}</span>
        </div>
      ) : null}

      <ol id="task-list-items" className="task-list-items" hidden={!expanded}>
        {taskList.items.map((item, index) => (
          <li key={`${index}-${item.text}`} className={`task-list-item ${item.status}`}>
            <span className="task-list-item-icon" aria-hidden>
              {item.status === 'done'
                ? <Check size={13} />
                : item.status === 'active'
                  ? <Loader2 size={13} className="task-list-spin" />
                  : <Circle size={11} />}
            </span>
            <span className="task-list-item-text">{item.text}</span>
          </li>
        ))}
      </ol>

    </section>
  )
}
