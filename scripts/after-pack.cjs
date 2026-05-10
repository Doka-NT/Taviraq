const { execFileSync } = require('node:child_process')

function run(command, args) {
  try {
    execFileSync(command, args, { stdio: 'inherit' })
  } catch (error) {
    const status = typeof error.status === 'number' ? ` (${error.status})` : ''
    throw new Error(`${command} ${args.join(' ')} failed${status}`)
  }
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  run('find', [context.appOutDir, '-name', '._*', '-delete'])
  run('xattr', ['-cr', context.appOutDir])

  if (process.platform === 'darwin') {
    run('dot_clean', ['-m', context.appOutDir])
  }
}
