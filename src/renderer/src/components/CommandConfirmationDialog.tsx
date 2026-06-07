// SPDX-License-Identifier: MPL-2.0
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import type { CommandRiskLevel } from '@shared/types'
import type { LanguageContextValue } from '@renderer/i18n/language'

export interface CommandConfirmation {
  sessionId: string
  title: string
  reason: string
  command: string
  tone: 'danger' | 'warning'
  confirmLabel: string
  riskLevel?: CommandRiskLevel
  /** Unique id for each confirmation request — used to key the countdown timer. Generated automatically. */
  commandId?: string
}

interface CommandConfirmationDialogProps {
  commandConfirmation: CommandConfirmation
  confirmCountdown: number
  commandUsesLocalSecret: boolean
  visibleCommand: string
  t: LanguageContextValue['t']
  onCancel: (sessionId: string) => void
  onConfirm: (sessionId: string, command: string) => void
  onCommandChange: (sessionId: string, command: string) => void
}

export function CommandConfirmationDialog({
  commandConfirmation,
  confirmCountdown,
  commandUsesLocalSecret,
  visibleCommand,
  t,
  onCancel,
  onConfirm,
  onCommandChange
}: CommandConfirmationDialogProps): JSX.Element {
  return (
    <section
      className={`command-confirmation-card ${commandConfirmation.tone}`}
      role="dialog"
      aria-labelledby="command-confirmation-title"
    >
      <div className="command-confirmation-head">
        <div>
          {commandConfirmation.tone === 'danger' ? <ShieldAlert size={14} aria-hidden /> : <AlertTriangle size={12} aria-hidden />}
          <h2 id="command-confirmation-title">{commandConfirmation.title}</h2>
        </div>
        <span>{commandConfirmation.tone === 'danger' ? t('confirm.review') : t('confirm.warning')}</span>
      </div>
      <div className="command-confirmation-body">
        {commandConfirmation.tone === 'danger' && (
          <div className="command-confirmation-destructive-warning">
            <ShieldAlert size={14} aria-hidden />
            <span>{t('confirm.destructiveWarning')}</span>
          </div>
        )}
        <label className="command-confirmation-command">
          <span>{t('confirm.command')}</span>
          <textarea
            value={visibleCommand}
            onChange={(event) => {
              if (!commandUsesLocalSecret) {
                onCommandChange(commandConfirmation.sessionId, event.target.value)
              }
            }}
            readOnly={commandUsesLocalSecret}
            aria-readonly={commandUsesLocalSecret}
            spellCheck={false}
            rows={Math.min(5, Math.max(2, visibleCommand.split('\n').length))}
          />
        </label>
        <div className="command-confirmation-reason">
          <span>{t('confirm.reason')}</span>
          <p>{commandConfirmation.reason}</p>
        </div>
        <p className="command-confirmation-note">{t('confirm.agentPaused')}</p>
      </div>
      <footer>
        <button type="button" className="quiet-button" onClick={() => onCancel(commandConfirmation.sessionId)}>
          {t('confirm.cancel')}
        </button>
        <button
          type="button"
          className={`danger-button ${commandConfirmation.tone}`}
          disabled={!commandConfirmation.command.trim() || (commandConfirmation.tone === 'danger' && confirmCountdown > 0)}
          onClick={() => onConfirm(commandConfirmation.sessionId, commandConfirmation.command)}
        >
          {commandConfirmation.tone === 'danger' && confirmCountdown > 0
            ? t('confirm.confirmCountdown', { seconds: confirmCountdown })
            : commandConfirmation.confirmLabel}
        </button>
      </footer>
    </section>
  )
}
