import { useEffect, useRef } from 'react'
import { Brain, ChevronDown, Eye, FileText, ScrollText, ShieldCheck, ShieldOff, Zap } from 'lucide-react'
import type { AssistMode } from '@shared/types'
import type { LanguageContextValue } from '@renderer/i18n/language'

interface ComposerConfigControlProps {
  open: boolean
  assistMode: AssistMode
  modeLabel: string
  modelLabel: string
  contextLabel: string
  maskedSecretLabel: string
  maskedSecretCount: number
  t: LanguageContextValue['t']
  onOpenChange: (open: boolean) => void
  onAssistModeChange: (mode: AssistMode) => void
  onOpenModelSwitcher: () => void
  onOpenPromptLibrary: () => void
}

function AssistModeIcon({ mode, size = 12 }: { mode: AssistMode; size?: number }): JSX.Element {
  if (mode === 'agent') return <Zap size={size} aria-hidden />
  if (mode === 'read') return <Eye size={size} aria-hidden />
  return <ShieldOff size={size} aria-hidden />
}

export function ComposerConfigControl({
  open,
  assistMode,
  modeLabel,
  modelLabel,
  contextLabel,
  maskedSecretLabel,
  maskedSecretCount,
  t,
  onOpenChange,
  onAssistModeChange,
  onOpenModelSwitcher,
  onOpenPromptLibrary
}: ComposerConfigControlProps): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const title = `${modeLabel} · ${modelLabel}`

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return
      onOpenChange(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onOpenChange, open])

  const modeOptions: AssistMode[] = ['agent', 'read', 'off']

  return (
    <div ref={wrapperRef} className="composer-config-control">
      <button
        type="button"
        className={`composer-config-chip ${assistMode}`}
        onClick={() => onOpenChange(!open)}
        title={title}
        aria-label={t('chat.composer.controls')}
        aria-expanded={open}
      >
        <AssistModeIcon mode={assistMode} />
        <span>{modelLabel}</span>
        <ChevronDown size={11} aria-hidden />
      </button>

      {open ? (
        <section className="composer-config-popover" role="dialog" aria-label={t('chat.composer.controls')}>
          <div className="composer-config-row">
            <span>
              <ScrollText size={12} aria-hidden />
              {t('chat.composer.contextLabel')}
            </span>
            <strong>{contextLabel}</strong>
          </div>
          {maskedSecretCount > 0 ? (
            <div className="composer-config-row">
              <span>
                <ShieldCheck size={12} aria-hidden />
                {t('chat.composer.maskedLabel')}
              </span>
              <strong>{maskedSecretLabel}</strong>
            </div>
          ) : null}

          <div className="composer-config-section">
            <span className="composer-config-section-label">{t('chat.composer.modeLabel')}</span>
            <div className="composer-mode-segment" role="group" aria-label={t('chat.composer.modeLabel')}>
              {modeOptions.map((mode) => {
                const label = mode === 'agent'
                  ? t('chat.composer.mode.agent')
                  : mode === 'read'
                    ? t('chat.composer.mode.read')
                    : t('chat.composer.mode.off')
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`composer-mode-option ${mode} ${assistMode === mode ? 'active' : ''}`}
                    aria-pressed={assistMode === mode}
                    onClick={() => {
                      onAssistModeChange(mode)
                      onOpenChange(false)
                    }}
                  >
                    <AssistModeIcon mode={mode} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="composer-config-actions">
            <button type="button" onClick={onOpenModelSwitcher}>
              <Brain size={13} aria-hidden />
              <span>{t('model.switch.title')}</span>
            </button>
            <button
              type="button"
              onClick={onOpenPromptLibrary}
              title={t('panel.promptLibrary')}
              aria-label={t('panel.promptLibrary')}
            >
              <FileText size={13} aria-hidden />
              <span>{t('commandPalette.prompts')}</span>
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
