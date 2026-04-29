import type { SSHProfile } from '@shared/types'

export interface SSHCommand {
  command: 'ssh'
  args: string[]
  label: string
}

export function buildSshCommand(profile: SSHProfile): SSHCommand {
  const host = profile.host.trim()
  if (!host) {
    throw new Error('SSH host is required.')
  }

  const args: string[] = []

  if (profile.port) {
    args.push('-p', String(profile.port))
  }

  if (profile.identityFile?.trim()) {
    args.push('-i', profile.identityFile.trim())
  }

  for (const arg of profile.extraArgs ?? []) {
    const trimmed = arg.trim()
    if (trimmed) {
      args.push(trimmed)
    }
  }

  const target = profile.user?.trim() ? `${profile.user.trim()}@${host}` : host
  args.push(target)

  return {
    command: 'ssh',
    args,
    label: profile.name?.trim() || target
  }
}
