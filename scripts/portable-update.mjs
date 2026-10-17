// DeepSeek Harness Portable - source-bundle updates, Tsungloong, 2026.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// Never replace user data, models, downloaded runtimes, or Git history.
export const SOURCE_ITEMS = ['scripts', 'docs', 'linux.sh', 'mac.sh', 'windows.bat',
  'README.md', 'README.en.md', 'README.txt', 'LICENSE', 'NOTICE.md', '.gitignore', '.gitattributes', 'package.json']
const log = (...args) => console.log('[portable]', ...args)

export function compareVersions(a, b) {
  const aa = a.split('.').map(Number), bb = b.split('.').map(Number)
  if (aa.length !== 3 || bb.length !== 3 || [...aa, ...bb].some(n => !Number.isInteger(n) || n < 0)) throw new Error('Invalid portable release version')
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] > bb[i] ? 1 : -1
  return 0
}

async function getManifest(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Update manifest HTTP ' + response.status)
  return response.json()
}

export async function checkForUpdate({ root, manifest }) {
  const path = join(root, 'state/update-check.json')
  const last = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).checkedAt : 0
  if (Date.now() - last < (manifest.release.autoUpdateHours ?? 24) * 3600000) return
  mkdirSync(join(root, 'state'), { recursive: true })
  writeFileSync(path, JSON.stringify({ checkedAt: Date.now() }))
  const remote = await getManifest(manifest.release.manifestUrl)
  if (compareVersions(remote.portableVersion, manifest.portableVersion) > 0) {
    log('新版本 / New release: ' + remote.portableVersion + '; 退出工作台后运行 portable-update / Stop the workbench and run portable-update')
  }
}

export async function installUpdate({ root, manifest, args = [] }) {
  if (args.length && (args.length !== 2 || args[0] !== '--manifest')) throw new Error('Usage: portable-update [--manifest URL]')
  const remote = await getManifest(args[1] || manifest.release.manifestUrl)
  if (compareVersions(remote.portableVersion, manifest.portableVersion) <= 0) { log('已是当前版本 / Already up to date'); return 0 }
  const bundle = remote.release?.archive
  if (!bundle?.url || !/^[a-f0-9]{64}$/.test(bundle.sha256)) throw new Error('Release must include archive URL and SHA-256')
  const directory = join(root, 'temp/update-' + process.pid)
  const stage = join(directory, 'source'), backup = join(directory, 'previous')
  mkdirSync(stage, { recursive: true }); mkdirSync(backup, { recursive: true })
  const changed = []
  try {
    const response = await fetch(bundle.url, { signal: AbortSignal.timeout(120000) })
    if (!response.ok) throw new Error('Update archive HTTP ' + response.status)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (createHash('sha256').update(bytes).digest('hex') !== bundle.sha256) {
      writeFileSync(join(directory, 'release.tar.gz.bad'), bytes)
      throw new Error('Update checksum mismatch; archive quarantined in ' + directory)
    }
    const archive = join(directory, 'release.tar.gz')
    writeFileSync(archive, bytes)
    const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
    if (entries.some(path => path.startsWith('/') || path.includes('\\') || path.split('/').includes('..'))) throw new Error('Unsafe archive path')
    const listing = execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' })
    if (listing.split(/\r?\n/).some(line => /^[lh]/.test(line))) throw new Error('Release must not contain links')
    execFileSync('tar', ['-xzf', archive, '-C', stage])
    const staged = JSON.parse(readFileSync(join(stage, 'scripts/manifest.json'), 'utf8'))
    if (staged.portableVersion !== remote.portableVersion) throw new Error('Archive version mismatch')
    const lock = readFileSync(join(stage, 'scripts/locks/package-lock.json'), 'utf8').replace(/\r\n/g, '\n')
    if (createHash('sha256').update(lock).digest('hex') !== staged.dependencyLock.sha256) throw new Error('Release dependency lock mismatch')
    for (const item of SOURCE_ITEMS) if (!existsSync(join(stage, item))) throw new Error('Release is missing ' + item)
    for (const item of SOURCE_ITEMS) {
      const source = join(stage, item), destination = join(root, item), old = join(backup, item)
      if (existsSync(destination)) renameSync(destination, old)
      changed.push(item)
      renameSync(source, destination)
    }
    log('已更新到 / Updated to ' + remote.portableVersion + '. 下次启动安装对应运行时，数据保留 / Next launch installs its pinned runtime; data retained.')
    rmSync(directory, { recursive: true, force: true })
    return 0
  } catch (error) {
    for (const item of changed.reverse()) {
      rmSync(join(root, item), { recursive: true, force: true })
      if (existsSync(join(backup, item))) renameSync(join(backup, item), join(root, item))
    }
    throw error
  }
}
