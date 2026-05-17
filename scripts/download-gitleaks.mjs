import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, cp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const version = '8.30.1'
const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const resourceRoot = join(repoRoot, 'resources', 'gitleaks')
const assets = [
  {
    arch: 'arm64',
    platformArch: 'darwin-arm64',
    checksum: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5'
  },
  {
    arch: 'x64',
    platformArch: 'darwin-x64',
    checksum: 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709'
  }
]

for (const asset of assets) {
  const archiveName = `gitleaks_${version}_darwin_${asset.arch}.tar.gz`
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archiveName}`
  const workdir = join(tmpdir(), `taviraq-gitleaks-${asset.platformArch}-${Date.now()}`)
  const archivePath = join(workdir, archiveName)
  const destination = join(resourceRoot, asset.platformArch)

  await rm(workdir, { recursive: true, force: true })
  await mkdir(workdir, { recursive: true })
  await mkdir(destination, { recursive: true })

  await download(url, archivePath)
  const checksum = await sha256(archivePath)
  if (checksum !== asset.checksum) {
    throw new Error(`${archiveName} checksum mismatch: expected ${asset.checksum}, got ${checksum}`)
  }

  execFileSync('tar', ['-xzf', archivePath, '-C', workdir], { stdio: 'inherit' })
  await cp(join(workdir, 'gitleaks'), join(destination, 'gitleaks'))
  await chmod(join(destination, 'gitleaks'), 0o755)

  await cp(join(workdir, 'LICENSE'), join(resourceRoot, 'LICENSE'))
  await cp(join(workdir, 'README.md'), join(resourceRoot, 'README.md'))
  await rm(workdir, { recursive: true, force: true })
  console.log(`Prepared ${basename(destination)}/gitleaks`)
}

function download(url, filePath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        download(response.headers.location, filePath).then(resolve, reject)
        return
      }

      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`Download failed with ${response.statusCode}: ${url}`))
        return
      }

      const output = createWriteStream(filePath)
      response.pipe(output)
      output.on('finish', () => {
        output.close(resolve)
      })
      output.on('error', reject)
    })

    request.on('error', reject)
  })
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
