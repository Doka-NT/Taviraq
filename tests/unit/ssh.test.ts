import { buildSshCommand } from '@main/utils/ssh'

describe('SSH command generation', () => {
  it('builds a system ssh invocation without opening a network connection', () => {
    expect(buildSshCommand({
      host: 'prod',
      user: 'deploy',
      port: 2222,
      identityFile: '~/.ssh/id_ed25519'
    })).toEqual({
      command: 'ssh',
      args: ['-p', '2222', '-i', '~/.ssh/id_ed25519', 'deploy@prod'],
      label: 'deploy@prod'
    })
  })
})
