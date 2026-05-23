import type { CommandRiskAssessment, CommandRiskAssessmentRequest, CommandRiskLevel } from '@shared/types'
import { SECRET_PLACEHOLDER_RE } from '@shared/secretPlaceholders'

type ProtectedPattern = {
  pattern: RegExp
  reason: string
  reasonCode?: CommandRiskAssessment['reasonCode']
  riskLevel?: CommandRiskLevel
}

const PROTECTED_PATTERNS: ProtectedPattern[] = [
  {
    pattern: SECRET_PLACEHOLDER_RE,
    reason: 'This command uses a local secret and must be reviewed before Taviraq resolves it.',
    reasonCode: 'local-secret',
    riskLevel: 'warning'
  },
  {
    pattern: /\brm\s+(?:-[^\s]*[rf][^\s]*|-[^\s]*[fr][^\s]*)\b/i,
    reason: 'This command can recursively or forcefully delete files.',
    riskLevel: 'danger'
  },
  {
    pattern: /\b(?:chmod|chown)\s+(?:-[^\s]*R[^\s]*|--recursive)\b/i,
    reason: 'This command can recursively change permissions or ownership.',
    riskLevel: 'danger'
  },
  {
    pattern: /\b(?:dd|mkfs(?:\.[\w-]+)?|diskutil\s+erase|diskutil\s+partition)\b/i,
    reason: 'This command can overwrite disks, filesystems, or partitions.',
    riskLevel: 'danger'
  },
  {
    pattern: /\bcurl\b[\s\S]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b|\bwget\b[\s\S]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/i,
    reason: 'This command downloads a script and executes it in the shell.',
    riskLevel: 'danger'
  },
  {
    pattern: /\bkubectl\s+(?:delete|drain|cordon|uncordon|apply|replace|patch|scale|rollout\s+restart)\b/i,
    reason: 'This command can modify Kubernetes resources or cluster availability.',
    riskLevel: 'danger'
  },
  {
    pattern: /\bterraform\s+(?:apply|destroy|import|state\s+(?:rm|mv|push))\b/i,
    reason: 'This command can modify infrastructure or Terraform state.',
    riskLevel: 'danger'
  },
  {
    pattern: /\b(?:drop\s+database|drop\s+table|truncate\s+table|delete\s+from|update\s+\S+\s+set)\b/i,
    reason: 'This command can destructively modify database data or schema.',
    riskLevel: 'danger'
  },
  {
    pattern: /\bgit\s+(?:reset\s+--hard|clean\s+-[^\s]*f|push\s+--force|push\s+-[^\s]*f)\b/i,
    reason: 'This command can discard local work or rewrite shared Git history.',
    riskLevel: 'danger'
  },
  {
    pattern: /\b(?:cat|less|more|head|tail|sed|awk|grep|rg|find)\b[\s\S]*(?:^|[/\s~])(?:\.env(?:\.[\w-]+)?|\.ssh\b|\.npmrc|\.pypirc|\.netrc|id_(?:rsa|dsa|ecdsa|ed25519)|credentials|kubeconfig|secrets?\b|tokens?\b|passwd\b|shadow\b)/i,
    reason: 'This command can read files or paths that often contain secrets or credentials.',
    riskLevel: 'warning'
  },
  {
    pattern: /\bgrep\b[\s\S]*(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|credential)/i,
    reason: 'This command searches for secret-like values that should be reviewed before being shown or shared.',
    riskLevel: 'warning'
  },
  {
    pattern: /\b(?:curl|wget)\b[\s\S]*(?:--data(?:-binary|-raw)?|-d|--form|-F|--upload-file|-T)\s*@?[^\s|;&]+|\b(?:scp|rsync|nc|ncat|netcat)\b/i,
    reason: 'This command can transfer local data or open a raw network stream.',
    riskLevel: 'danger'
  },
  {
    pattern: /\bsudo\b/i,
    reason: 'This command asks for elevated privileges and can change system state.'
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

const RISK_PRECEDENCE: Record<CommandRiskLevel, number> = { warning: 1, danger: 2 }

function higherRiskLevel(
  a: CommandRiskLevel | undefined,
  b: CommandRiskLevel | undefined
): CommandRiskLevel | undefined {
  if (!a) return b
  if (!b) return a
  return RISK_PRECEDENCE[a] >= RISK_PRECEDENCE[b] ? a : b
}

export function assessProtectedCommandRisk(
  request: Pick<CommandRiskAssessmentRequest, 'command' | 'context'>
): CommandRiskAssessment | undefined {
  const command = request.command.trim()
  if (!command) return undefined

  const matches = PROTECTED_PATTERNS.filter(({ pattern }) => pattern.test(command))
  if (matches.length === 0) return undefined

  // Pick the primary match: first pattern with the highest risk level,
  // or the first match if none have a risk level.
  const bestRisk = matches.reduce<CommandRiskLevel | undefined>(
    (acc, m) => higherRiskLevel(acc, m.riskLevel), undefined
  )
  const primary = bestRisk
    ? matches.find(m => m.riskLevel === bestRisk) ?? matches[0]
    : matches[0]

  const sshLabel = request.context.session?.kind === 'ssh' ? request.context.session.label : undefined
  const host = sshLabel
    ? ` The active session is SSH (${sshLabel}), so remote-side effects need explicit review.`
    : ''

  return {
    dangerous: true,
    reason: `${primary.reason}${host} Taviraq requires confirmation before running it.`,
    ...(primary.reasonCode ? { reasonCode: primary.reasonCode } : {}),
    ...(sshLabel ? { reasonArgs: { sshLabel } } : {}),
    ...(bestRisk ? { riskLevel: bestRisk } : {})
  }
}
