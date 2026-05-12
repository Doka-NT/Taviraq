import type { CommandRiskAssessment, CommandRiskAssessmentRequest } from '@shared/types'

type ProtectedPattern = {
  pattern: RegExp
  reason: string
}

const PROTECTED_PATTERNS: ProtectedPattern[] = [
  {
    pattern: /\[\[TAVIRAQ_SECRET_\d+_[A-Z0-9_]+\]\]/,
    reason: 'This command uses a local secret and must be reviewed before Taviraq resolves it.'
  },
  {
    pattern: /\brm\s+(?:-[^\s]*[rf][^\s]*|-[^\s]*[fr][^\s]*)\b/i,
    reason: 'This command can recursively or forcefully delete files.'
  },
  {
    pattern: /\bsudo\b/i,
    reason: 'This command asks for elevated privileges and can change system state.'
  },
  {
    pattern: /\b(?:chmod|chown)\s+(?:-[^\s]*R[^\s]*|--recursive)\b/i,
    reason: 'This command can recursively change permissions or ownership.'
  },
  {
    pattern: /\b(?:dd|mkfs(?:\.[\w-]+)?|diskutil\s+erase|diskutil\s+partition)\b/i,
    reason: 'This command can overwrite disks, filesystems, or partitions.'
  },
  {
    pattern: /\bcurl\b[\s\S]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b|\bwget\b[\s\S]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/i,
    reason: 'This command downloads a script and executes it in the shell.'
  },
  {
    pattern: /\bkubectl\s+(?:delete|drain|cordon|uncordon|apply|replace|patch|scale|rollout\s+restart)\b/i,
    reason: 'This command can modify Kubernetes resources or cluster availability.'
  },
  {
    pattern: /\bterraform\s+(?:apply|destroy|import|state\s+(?:rm|mv|push))\b/i,
    reason: 'This command can modify infrastructure or Terraform state.'
  },
  {
    pattern: /\b(?:drop\s+database|drop\s+table|truncate\s+table|delete\s+from|update\s+\S+\s+set)\b/i,
    reason: 'This command can destructively modify database data or schema.'
  },
  {
    pattern: /\bgit\s+(?:reset\s+--hard|clean\s+-[^\s]*f|push\s+--force|push\s+-[^\s]*f)\b/i,
    reason: 'This command can discard local work or rewrite shared Git history.'
  },
  {
    pattern: /\b(?:npm|pnpm|yarn|brew|pip|pipx|cargo|gem)\s+(?:install|uninstall|remove|add|update|upgrade)\b/i,
    reason: 'This command can install, remove, or upgrade software on this machine.'
  },
  {
    pattern: /\b(?:kill|killall|pkill|shutdown|reboot|halt)\b/i,
    reason: 'This command can stop processes or change machine availability.'
  }
]

export function assessProtectedCommandRisk(
  request: Pick<CommandRiskAssessmentRequest, 'command' | 'context'>
): CommandRiskAssessment | undefined {
  const command = request.command.trim()
  if (!command) return undefined

  const match = PROTECTED_PATTERNS.find(({ pattern }) => pattern.test(command))
  if (!match) return undefined

  const host = request.context.session?.kind === 'ssh'
    ? ` The active session is SSH (${request.context.session.label}), so remote-side effects need explicit review.`
    : ''

  return {
    dangerous: true,
    reason: `${match.reason}${host} Taviraq requires confirmation before running it.`
  }
}
