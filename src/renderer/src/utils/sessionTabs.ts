import type { TerminalSessionInfo } from '@shared/types'

export type SessionTabStatus = 'running' | 'idle' | 'exited' | 'disconnected' | 'reconnecting'

export interface SessionTabInfo extends TerminalSessionInfo {
  status: SessionTabStatus
}

export interface SessionTabStatusMeta {
  label: string
  className: string
}

const STATUS_META: Record<SessionTabStatus, SessionTabStatusMeta> = {
  running: { label: 'Running', className: 'running' },
  idle: { label: 'Idle', className: 'idle' },
  exited: { label: 'Exited', className: 'exited' },
  disconnected: { label: 'Disconnected', className: 'disconnected' },
  reconnecting: { label: 'Reconnecting', className: 'reconnecting' }
}

export function getTabLabel(session: TerminalSessionInfo): string {
  if (session.kind !== 'ssh') {
    return session.label
  }

  const remoteTarget = session.remoteTarget?.trim()
  if (!remoteTarget) {
    return session.label
  }

  return session.label && session.label !== remoteTarget
    ? `${session.label} · ${remoteTarget}`
    : remoteTarget
}

export function getCwdBasename(cwd: string | undefined): string | undefined {
  if (!cwd) return undefined

  const normalized = cwd.replace(/\/+$/, '')
  if (!normalized || normalized === '/') return '/'

  return normalized.split('/').at(-1)
}

export function getSessionCommandTarget(session: TerminalSessionInfo): string {
  if (session.kind === 'ssh') {
    return session.remoteTarget || session.label || session.remoteHost || 'SSH session'
  }

  return getCwdBasename(session.cwd) || session.cwd || session.label || 'local shell'
}

export function getSessionStatusMeta(status: SessionTabStatus): SessionTabStatusMeta {
  return STATUS_META[status]
}

export function formatSessionUptime(createdAt: number, now = Date.now()): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 'unknown'

  const elapsedSeconds = Math.max(0, Math.floor((now - createdAt) / 1000))
  if (elapsedSeconds < 60) return '<1m'

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60
  if (elapsedHours < 24) return minutes ? `${elapsedHours}h ${minutes}m` : `${elapsedHours}h`

  const days = Math.floor(elapsedHours / 24)
  const hours = elapsedHours % 24
  return hours ? `${days}d ${hours}h` : `${days}d`
}

export function getSessionTooltip(session: SessionTabInfo, now = Date.now()): string {
  const status = getSessionStatusMeta(session.status).label
  const lines = [
    `${getTabLabel(session)} (${status})`,
    `Target: ${getSessionCommandTarget(session)}`
  ]

  if (session.remoteTarget) lines.push(`Remote: ${session.remoteTarget}`)
  if (session.cwd) lines.push(`CWD: ${session.cwd}`)
  lines.push(`Uptime: ${formatSessionUptime(session.createdAt, now)}`)
  if (session.reconnectCommand) lines.push(`Reconnect: ${session.reconnectCommand}`)

  return lines.join('\n')
}
