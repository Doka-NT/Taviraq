import type { CommandRiskAssessment, CommandRiskAssessmentRequest, CommandRiskLevel } from '@shared/types'
import { SECRET_PLACEHOLDER_RE } from '@shared/secretPlaceholders'

type ProtectedPattern = {
  pattern: RegExp
  reason: string
  reasonCode?: CommandRiskAssessment['reasonCode']
  riskLevel?: CommandRiskLevel
  matcher?: (command: string) => boolean
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
    pattern: /\b(?:cat|less|more|head|tail|sed|awk|grep|rg|find)\b/i,
    reason: 'This command can read files or paths that often contain secrets or credentials.',
    riskLevel: 'warning',
    matcher: hasSensitiveReadRisk
  },
  {
    pattern: /\b(?:curl|wget|scp|rsync|nc|ncat|netcat)\b/i,
    reason: 'This command can transfer local data or open a raw network stream.',
    riskLevel: 'danger',
    matcher: hasTransferRisk
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

  const matches = PROTECTED_PATTERNS.filter(({ pattern, matcher }) =>
    matcher ? matcher(command) : pattern.test(command)
  )
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

const TRANSFER_COMMANDS = new Set(['scp', 'rsync', 'nc', 'ncat', 'netcat'])
const SENSITIVE_READ_COMMANDS = new Set(['cat', 'less', 'more', 'head', 'tail', 'sed', 'awk', 'grep', 'rg', 'find'])
const SHELL_WRAPPERS = new Set(['sh', 'bash', 'zsh'])
const HTTP_UPLOAD_FLAG_RE = /^(?:(?:--data(?:-ascii|-binary|-raw|-urlencode)?|--form|--upload-file|-T|--post-(?:file|data)|--body-file)(?:=.*)?|-d\S*|-F\S*)$/i
const HTTP_SENSITIVE_INPUT_FLAG_RE = /^(?:(--config|--netrc-file|--cookie)(?:=(.*))?|-K(.*)?)$/i
const ENV_ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=.*$/s
const ENV_FLAGS_WITH_VALUE = new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string'])
const ENV_FLAGS_WITH_OPTIONAL_VALUE_RE = /^(?:--unset|--chdir|--split-string)=/
const ENV_FLAGS_WITHOUT_VALUE = new Set(['--ignore-environment', '--null', '--debug'])
const ENV_SHORT_FLAGS_WITHOUT_VALUE_RE = /^-[i0v]+$/
const SENSITIVE_PATH_RE = /(?:^|[/~])(?:\.env(?:\.[\w-]+)?|\.ssh\b|\.npmrc|\.pypirc|\.netrc|\.curlrc|id_(?:rsa|dsa|ecdsa|ed25519)|credentials|kubeconfig|secrets?\b|tokens?\b|passwd\b|shadow\b)|\.pem\b/i
const SECRET_SEARCH_RE = /^(?:password|passwd|secret|secrets|token|tokens|api[_-]?key|private[_-]?key|credential|credentials)$/i
const MAX_SHELL_INSPECTION_DEPTH = 8

function hasSensitiveReadRisk(command: string, depth = 0): boolean {
  if (depth > MAX_SHELL_INSPECTION_DEPTH) return false
  if (extractCommandSubstitutions(command).some((inner) => hasSensitiveReadRisk(inner, depth + 1))) return true

  return splitShellCommands(command).some((segment) => {
    const tokens = executableTokens(tokenizeShellSegment(segment))
    if (tokens.length === 0) return false

    const executable = basename(tokens[0] ?? '').toLowerCase()
    if (SHELL_WRAPPERS.has(executable)) {
      const commandArg = readShellCommandArgument(tokens.slice(1))
      return commandArg ? hasSensitiveReadRisk(commandArg, depth + 1) : false
    }

    if (!SENSITIVE_READ_COMMANDS.has(executable)) return false

    const args = tokens.slice(1).filter((token) => token !== '--')
    if (args.some(isSensitivePathToken)) return true

    if (executable === 'grep' || executable === 'rg') {
      return args
        .filter((token) => !token.startsWith('-'))
        .some((token) => SECRET_SEARCH_RE.test(token))
    }

    return false
  })
}

function hasTransferRisk(command: string, depth = 0): boolean {
  if (depth > MAX_SHELL_INSPECTION_DEPTH) return false
  if (extractCommandSubstitutions(command).some((inner) => hasTransferRisk(inner, depth + 1))) return true

  return splitShellCommands(command).some((segment) => {
    const tokens = executableTokens(tokenizeShellSegment(segment))
    if (tokens.length === 0) return false

    const executable = basename(tokens[0] ?? '').toLowerCase()
    if (!executable) return false

    if (TRANSFER_COMMANDS.has(executable)) return true

    if ((executable === 'curl' || executable === 'wget') && hasHttpTransferRisk(tokens.slice(1))) {
      return true
    }

    if (SHELL_WRAPPERS.has(executable)) {
      const commandArg = readShellCommandArgument(tokens.slice(1))
      return commandArg ? hasTransferRisk(commandArg, depth + 1) : false
    }

    return false
  })
}

function hasHttpTransferRisk(args: string[]): boolean {
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i] ?? ''
    if (HTTP_UPLOAD_FLAG_RE.test(token)) return true
    const sensitiveInput = readHttpSensitiveInputFlagValue(args, i)
    if (sensitiveInput && isSensitivePathToken(sensitiveInput)) return true
    if ((token === '<' || token === '0<') && isSensitivePathToken(args[i + 1] ?? '')) return true
    const inputRedirect = token.match(/^\d*<(.+)$/)
    if (inputRedirect && isSensitivePathToken(inputRedirect[1] ?? '')) return true
  }

  return false
}

function readHttpSensitiveInputFlagValue(args: string[], index: number): string | undefined {
  const token = args[index] ?? ''
  const match = token.match(HTTP_SENSITIVE_INPUT_FLAG_RE)
  if (!match) return undefined
  return match[2] || match[3] || args[index + 1]
}

function executableTokens(tokens: string[]): string[] {
  const result = [...tokens]
  while (result.length > 0) {
    const token = result[0] ?? ''
    if (/^\(+$/.test(token)) {
      result.shift()
      continue
    }

    if (token.startsWith('(')) {
      result[0] = token.replace(/^\(+/, '')
      if (!result[0]) result.shift()
      continue
    }

    if (token === 'sudo' || token === 'command' || ENV_ASSIGNMENT_RE.test(token)) {
      result.shift()
      continue
    }

    if (token === 'env') {
      result.shift()
      while (result.length > 0) {
        const envToken = result[0] ?? ''
        if (ENV_ASSIGNMENT_RE.test(envToken)) {
          result.shift()
          continue
        }

        if (envToken === '--') {
          result.shift()
          break
        }

        if (ENV_FLAGS_WITH_VALUE.has(envToken)) {
          result.splice(0, 2)
          continue
        }

        if (
          ENV_FLAGS_WITH_OPTIONAL_VALUE_RE.test(envToken) ||
          ENV_SHORT_FLAGS_WITHOUT_VALUE_RE.test(envToken) ||
          ENV_FLAGS_WITHOUT_VALUE.has(envToken)
        ) {
          result.shift()
          continue
        }

        break
      }
      continue
    }

    break
  }
  return result
}

function splitShellCommands(command: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | undefined

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i]

    if (quote) {
      if (char === '\\' && (command[i + 1] === '\n' || command[i + 1] === '\r')) {
        if (command[i + 1] === '\r' && command[i + 2] === '\n') i += 2
        else i += 1
        continue
      }

      current += char
      if (char === '\\' && quote === '"' && i + 1 < command.length) {
        current += command[i + 1]
        i += 1
        continue
      }

      if (char === quote) {
        quote = undefined
      }

      continue
    }

    if (char === '\\' && (command[i + 1] === '\n' || command[i + 1] === '\r')) {
      if (command[i + 1] === '\r' && command[i + 2] === '\n') i += 2
      else i += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }

    if (char === '|' || char === ';' || char === '&' || char === '\n' || char === '\r') {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

function tokenizeShellSegment(segment: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | undefined

  for (let i = 0; i < segment.length; i += 1) {
    const char = segment[i]

    if (quote) {
      if (char === '\\' && quote === '"' && i + 1 < segment.length) {
        current += segment[i + 1]
        i += 1
        continue
      }

      if (char === quote) {
        quote = undefined
        continue
      }

      current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) tokens.push(current)
  return tokens
}

function extractCommandSubstitutions(command: string): string[] {
  const substitutions: string[] = []
  let quote: '"' | "'" | undefined

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i]

    if (quote === "'") {
      if (char === quote) quote = undefined
      continue
    }

    if (quote === '"') {
      if (char === '\\' && i + 1 < command.length) {
        i += 1
        continue
      }
      if (char === quote) quote = undefined
    } else if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '`') {
      const end = command.indexOf('`', i + 1)
      if (end !== -1) {
        substitutions.push(command.slice(i + 1, end))
        i = end
      }
      continue
    }

    if (char === '$' && command[i + 1] === '(') {
      const end = findCommandSubstitutionEnd(command, i + 2)
      if (end !== -1) {
        substitutions.push(command.slice(i + 2, end))
        i = end
      }
    }
  }

  return substitutions
}

function findCommandSubstitutionEnd(command: string, start: number): number {
  let depth = 1
  let quote: '"' | "'" | undefined

  for (let i = start; i < command.length; i += 1) {
    const char = command[i]

    if (quote) {
      if (char === '\\' && quote === '"' && i + 1 < command.length) {
        i += 1
        continue
      }
      if (char === quote) quote = undefined
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '$' && command[i + 1] === '(') {
      depth += 1
      i += 1
      continue
    }

    if (char === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }

  return -1
}

function readShellCommandArgument(tokens: string[]): string | undefined {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === '--command') return tokens[i + 1]
    if (token.startsWith('--command=')) return token.slice('--command='.length)
    if (!token.startsWith('-')) continue
    if (token.startsWith('--')) continue
    if (!/^-[A-Za-z]*c[A-Za-z]*$/.test(token)) continue
    return tokens[i + 1]
  }

  return undefined
}

function basename(command: string): string {
  return command.split('/').at(-1) ?? command
}

function isSensitivePathToken(token: string): boolean {
  return SENSITIVE_PATH_RE.test(token)
}
