export function buildAgentContinuation(command: string, output: string, strictTerminalContext: boolean): string {
  if (strictTerminalContext) {
    return `Command \`${command}\` finished. Terminal output is withheld because strict terminal context is enabled. Continue without terminal output.`
  }

  return `Command \`${command}\` finished.\nOutput:\n\`\`\`\n${output}\n\`\`\`\nContinue.`
}
