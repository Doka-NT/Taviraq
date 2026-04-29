import pty from 'node-pty'

describe('local PTY lifecycle', () => {
  it('starts a shell command, receives output, and exits', async () => {
    const shell = process.env.SHELL || '/bin/sh'
    const child = pty.spawn(shell, ['-lc', 'printf PTY_OK'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    })

    const output = await new Promise<string>((resolve, reject) => {
      let buffer = ''
      const timeout = setTimeout(() => reject(new Error('PTY test timed out')), 5_000)

      child.onData((data) => {
        buffer += data
        if (buffer.includes('PTY_OK')) {
          clearTimeout(timeout)
          resolve(buffer)
        }
      })

      child.onExit(({ exitCode }) => {
        if (exitCode !== 0 && !buffer.includes('PTY_OK')) {
          clearTimeout(timeout)
          reject(new Error(`PTY exited with ${exitCode}`))
        }
      })
    })

    expect(output).toContain('PTY_OK')
  })
})
