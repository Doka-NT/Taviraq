export function buildAgentContinuation(command: string, output: string, strictTerminalContext: boolean): string {
  if (strictTerminalContext) {
    return 'A command finished. Terminal command and output are withheld because strict terminal context is enabled. Continue without terminal context.'
  }

  return `Command \`${command}\` finished.\nOutput:\n\`\`\`\n${output}\n\`\`\`\nContinue.`
}
