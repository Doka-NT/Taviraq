// SPDX-License-Identifier: MPL-2.0
import { Check, Circle, FolderOpen, ListChecks, Loader2 } from 'lucide-react'
import type { TaskList } from '@shared/taskList'
import { summarizeTaskList } from '@shared/taskList'
import type { LanguageContextValue } from '@renderer/i18n/language'

interface TaskListPanelProps {
  taskList: TaskList
  hasPlanFile: boolean
  revealing: boolean
  onRevealPlan: () => void
  t: LanguageContextValue['t']
}

export function TaskListPanel({
  taskList,
  hasPlanFile,
  revealing,
  onRevealPlan,
  t
}: TaskListPanelProps): JSX.Element {
  const progress = summarizeTaskList(taskList)

  return (
    <section className="task-list-panel" aria-label={t('taskList.title')}>
      <header className="task-list-panel-header">
        <span className="task-list-panel-title">
          <ListChecks size={13} aria-hidden />
          <strong>{t('taskList.title')}</strong>
        </span>
        <span className="task-list-panel-progress">
          {t('taskList.progress')
            .replace('{done}', String(progress.done))
            .replace('{total}', String(progress.total))}
        </span>
      </header>

      <ol className="task-list-items">
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

      {hasPlanFile ? (
        <div className="task-list-panel-actions">
          <button
            type="button"
            className="quiet-button"
            onClick={onRevealPlan}
            disabled={revealing}
            title={t('taskList.revealPlan')}
          >
            <FolderOpen size={12} aria-hidden />
            <span>{t('taskList.revealPlan')}</span>
          </button>
        </div>
      ) : null}
    </section>
  )
}
