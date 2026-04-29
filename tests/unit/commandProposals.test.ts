import { extractCommandProposals } from '@main/utils/commandProposals'

describe('command proposal extraction', () => {
  it('extracts shell fenced blocks and strips prompts', () => {
    const proposals = extractCommandProposals('Run this:\n\n```bash\n$ pwd\nls -la\n# comment\n```\n')
    expect(proposals.map((proposal) => proposal.command)).toEqual(['pwd', 'ls -la'])
  })

  it('ignores non-shell code blocks', () => {
    expect(extractCommandProposals('```ts\nconsole.log("no")\n```')).toEqual([])
  })
})
