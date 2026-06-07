// SPDX-License-Identifier: MPL-2.0
const STRICT_TERMINAL_CONTEXT_CONTINUATION = 'A command finished. Terminal command and output are withheld because strict terminal context is enabled. Continue without terminal context.'

export function buildAgentContinuation(command: string, output: string, strictTerminalContext: boolean): string {
  if (strictTerminalContext) {
    return STRICT_TERMINAL_CONTEXT_CONTINUATION
  }

  return `Command \`${command}\` finished.\nOutput:\n\`\`\`\n${output}\n\`\`\`\nContinue.`
}

export function wasTerminalContextSentToProvider(content: string, explicitState?: boolean): boolean {
  return explicitState ?? content !== STRICT_TERMINAL_CONTEXT_CONTINUATION
}
