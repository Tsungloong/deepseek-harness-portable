#!/usr/bin/env node
// DeepSeek Harness Portable. Copyright 2026 Tsungloong.
import { createHash } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync, statSync, chmodSync, statfsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createServer } from 'node:net'
import { join, resolve, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from './session-portability.mjs'

export const RESET_DIRS = ['data', 'runtimes', 'packages', 'logs', 'state', 'temp']
export const TARGETS = { 'win32-x64': 'windows-x64', 'linux-x64': 'linux-x64', 'darwin-arm64': 'macos-arm64' }
const log = (...args) => console.log('[portable]', ...args)
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const ensure = (...dirs) => dirs.forEach(dir => mkdirSync(dir, { recursive: true }))
export const sha256CanonicalText = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')

export function writeJson(file, value) {
  writeFileSync(file + '.new', JSON.stringify(value, null, 2) + '\n')
  renameSync(file + '.new', file)
}

export function promote(stage, destination, previous) {
  rmSync(previous, { recursive: true, force: true })
  if (existsSync(destination)) renameSync(destination, previous)
  try {
    renameSync(stage, destination)
  } catch (error) {
    if (existsSync(previous)) renameSync(previous, destination)
    throw error
  }
}

export function containsSymlink(directory) {
  if (!existsSync(directory)) return false
  return readdirSync(directory, { withFileTypes: true }).some(entry =>
    entry.isSymbolicLink() || (entry.isDirectory() && containsSymlink(join(directory, entry.name))))
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (error) { return error.code === 'EPERM' }
}

export function run(executable, args, options = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { stdio: 'inherit', detached: process.platform !== 'win32', ...options })
    const forward = signal => {
      try {
        if (process.platform === 'win32') child.kill(signal)
        else process.kill(-child.pid, signal)
      } catch (error) { if (error.code !== 'ESRCH') reject(error) }
    }
    const interrupt = () => forward('SIGINT')
    const terminate = () => forward('SIGTERM')
    process.on('SIGINT', interrupt)
    process.on('SIGTERM', terminate)
    const cleanup = () => {
      process.off('SIGINT', interrupt)
      process.off('SIGTERM', terminate)
    }
    child.once('error', error => { cleanup(); reject(error) })
    child.once('close', (code, signal) => { cleanup(); accept(code ?? (signal === 'SIGINT' ? 130 : 143)) })
  })
}

export function createPortable(root, target) {
  root = resolve(root)
  if (!Object.values(TARGETS).includes(target)) throw new Error('Unsupported target: ' + target)
  const scripts = join(root, 'scripts')
  const manifest = readJson(join(scripts, 'manifest.json'))
  const runtime = join(root, 'runtimes', target)
  const app = join(runtime, 'dsh')
  const bin = join(runtime, 'bin')
  const nodeHome = join(runtime, 'node')
  const win = target === 'windows-x64'
  const node = join(nodeHome, win ? 'node.exe' : 'bin/node')
  const npmCli = join(nodeHome, win ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js')
  const state = join(root, 'state', target)
  const temp = join(root, 'temp')
  const previous = join(temp, 'previous-dsh-' + target)
  const dshHome = join(root, 'data', 'dsh-home')
  const agentsHome = join(root, 'data', 'agents-home')
  const home = join(root, 'data', 'portable-home')
  const workspace = join(root, 'data', 'workspace')
  const marker = join(state, 'install.json')
  const dshBin = join(app, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
  const lockFile = join(scripts, 'locks/package-lock.json')
  const pidFile = join(root, 'state/running.json')
  const setupLock = join(root, 'state/.setup-lock')
  const cache = join(root, 'packages/cache', target)

  function environment() {
    // Windows environment names are case-insensitive; do not retain a second Path.
    const inherited = { ...process.env }
    const pathKey = Object.keys(inherited).find(key => key.toUpperCase() === 'PATH')
    const hostPath = inherited[pathKey] || ''
    if (pathKey) delete inherited[pathKey]
    return {
      ...inherited,
      DSH_HOME: dshHome, DSH_AGENTS_HOME: agentsHome,
      HOME: home, USERPROFILE: home,
      APPDATA: join(home, 'AppData/Roaming'), LOCALAPPDATA: join(home, 'AppData/Local'),
      XDG_CACHE_HOME: join(cache, 'xdg'), XDG_CONFIG_HOME: join(home, '.config'),
      XDG_DATA_HOME: join(home, '.local/share'), PNPM_HOME: join(home, '.local/share/pnpm'),
      npm_config_cache: join(cache, 'npm'), npm_config_userconfig: join(home, '.npmrc'),
      npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false',
      TEMP: temp, TMP: temp, TMPDIR: temp,
      PATH: [bin, win ? nodeHome : join(nodeHome, 'bin'), hostPath].join(win ? ';' : delimiter),
      NODE_USE_ENV_PROXY: '1',
    }
  }

  function prepare() {
    ensure(runtime, bin, state, temp, dshHome, agentsHome, home, workspace, join(root, 'logs'), cache)
  }

  function recover() {
    if (!existsSync(app) && existsSync(previous)) {
      ensure(runtime)
      renameSync(previous, app)
      log('已恢复上次运行时 / Restored previous runtime')
    }
  }

  function installed() {
    if (!existsSync(marker) || !existsSync(dshBin)) return false
    const info = readJson(marker)
    return info.target === target && info.dshVersion === manifest.deepseekHarness.version &&
      info.nodeVersion === manifest.node.version && info.lockSha256 === manifest.dependencyLock.sha256
  }

  function assertIdle() {
    if (existsSync(pidFile) && alive(readJson(pidFile).pid)) {
      throw new Error('工作台仍在运行，请先 Ctrl+C 退出 / Stop the running workbench first')
    }
  }

  function verifyLock() {
    const raw = readFileSync(lockFile, 'utf8')
    if (sha256CanonicalText(raw) !== manifest.dependencyLock.sha256) throw new Error('Dependency lock checksum mismatch')
    const lock = JSON.parse(raw)
    const dsh = lock.packages['node_modules/' + manifest.deepseekHarness.package]
    if (dsh?.version !== manifest.deepseekHarness.version || dsh?.integrity !== manifest.deepseekHarness.integrity) {
      throw new Error('Harness version/integrity does not match the dependency lock')
    }
    for (const [name, version] of Object.entries(lock.packages[''].dependencies)) {
      const wanted = name === manifest.deepseekHarness.package ? manifest.deepseekHarness.version : manifest.pnpm
      if (version !== wanted) throw new Error('Dependency version mismatch: ' + name)
    }
    return { raw, lock }
  }

  function wrappers() {
    const entries = {
      pnpm: '../dsh/node_modules/pnpm/bin/pnpm.cjs',
      npm: win ? '../node/node_modules/npm/bin/npm-cli.js' : '../node/lib/node_modules/npm/bin/npm-cli.js',
      npx: win ? '../node/node_modules/npm/bin/npx-cli.js' : '../node/lib/node_modules/npm/bin/npx-cli.js',
    }
    for (const [name, entry] of Object.entries(entries)) {
      const file = join(bin, name + (win ? '.cmd' : ''))
      const content = win
        ? '@echo off\r\n"%~dp0..\\node\\node.exe" "%~dp0' + entry.replaceAll('/', '\\') + '" %*\r\n'
        : '#!/bin/sh\nHERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)\nexec "$HERE/../node/bin/node" "$HERE/' + entry + '" "$@"\n'
      writeFileSync(file, content)
      if (!win) chmodSync(file, 0o755)
    }
  }

  async function setup(force = false) {
    assertIdle()
    prepare()
    recover()
    if (!force && installed()) { wrappers(); log('运行时已就绪 / Runtime already installed'); return 0 }
    try { mkdirSync(setupLock) } catch (error) {
      if (error.code !== 'EEXIST') throw error
      throw new Error('安装锁存在；确认没有安装进程后删除 state/.setup-lock 再重试')
    }
    const stage = join(temp, 'dsh.stage.' + process.pid)
    try {
      const { raw, lock } = verifyLock()
      ensure(stage)
      const pkg = readJson(join(scripts, 'locks/package.json'))
      pkg.allowScripts = manifest.allowScripts
      writeJson(join(stage, 'package.json'), pkg)
      writeFileSync(join(stage, 'package-lock.json'), raw)
      const env = environment()
      log('安装官方 Harness ' + manifest.deepseekHarness.version + ' / Installing locked dependencies')
      let code = await run(node, [npmCli, 'ci', '--prefix', stage, '--omit=dev', '--no-audit', '--no-fund', '--no-bin-links', '--ignore-scripts'], { cwd: stage, env })
      if (code !== 0) throw new Error('npm ci failed (exit ' + code + ')')
      // Rebuild only the exact locked packages approved by this release.
      // The bundled npm also reads package.json#allowScripts.
      const approved = []
      for (const [path, pkgInfo] of Object.entries(lock.packages)) {
        if (!pkgInfo.hasInstallScript) continue
        const name = path.split('node_modules/').at(-1)
        if (manifest.allowScripts[name + '@' + pkgInfo.version] !== true) {
          throw new Error('Install script is not approved: ' + name + '@' + pkgInfo.version)
        }
        approved.push(name)
      }
      code = await run(node, [npmCli, 'rebuild', ...approved, '--prefix', stage, '--ignore-scripts=false', '--no-bin-links'], { cwd: stage, env })
      if (code !== 0) throw new Error('Native dependency setup failed (exit ' + code + ')')
      const version = readJson(join(stage, 'node_modules/@deepseek-ai/dsh/package.json')).version
      if (version !== manifest.deepseekHarness.version) throw new Error('Installed Harness version mismatch')
      promote(stage, app, previous)
      try {
        wrappers()
        writeJson(marker, { schema: 1, target, dshVersion: version, nodeVersion: manifest.node.version,
          lockSha256: manifest.dependencyLock.sha256, completedAt: new Date().toISOString() })
      } catch (error) {
        rmSync(app, { recursive: true, force: true })
        if (existsSync(previous)) renameSync(previous, app)
        throw error
      }
      rmSync(previous, { recursive: true, force: true })
      log('安装完成 / Setup complete: ' + target)
      return 0
    } finally {
      rmSync(stage, { recursive: true, force: true })
      rmSync(setupLock, { recursive: true, force: true })
    }
  }

  async function doctor() {
    const checks = []
    const check = async (name, fn) => {
      try { checks.push({ name, ...await fn() }) }
      catch (error) { checks.push({ name, status: 'FAIL', detail: error.message }) }
    }
    const ok = detail => ({ status: 'OK', detail })
    const warn = detail => ({ status: 'WARN', detail })
    await check('平台 / Platform', () => TARGETS[process.platform + '-' + process.arch] === target ? ok(target) : { status: 'FAIL', detail: target })
    await check('磁盘空间 / Free space', () => {
      const fs = statfsSync(root), mb = Math.floor(fs.bavail * fs.bsize / 1048576)
      return mb >= 1024 ? ok(mb + ' MiB') : warn(mb + ' MiB; 建议至少 1 GiB / 1 GiB recommended')
    })
    await check('安装路径 / Location', () => ok(root))
    await check('可写目录 / Writable', () => {
      const file = join(root, '.write-test-' + process.pid)
      writeFileSync(file, ''); rmSync(file); return ok(root)
    })
    await check('Node.js', () => {
      const actual = execFileSync(node, ['--version'], { encoding: 'utf8' }).trim()
      return { status: actual === 'v' + manifest.node.version ? 'OK' : 'FAIL', detail: actual }
    })
    await check('Harness', () => {
      if (!existsSync(dshBin)) throw new Error('未安装；运行 setup / Run setup')
      return ok(readJson(join(app, 'node_modules/@deepseek-ai/dsh/package.json')).version)
    })
    await check('依赖锁 / Dependency lock', () => { verifyLock(); return ok('version + integrity + checksum') })
    await check('安装状态 / Installation', () => ({ status: installed() ? 'OK' : 'FAIL', detail: installed() ? 'ready' : '运行 setup / Run setup' }))
    await check('pnpm', () => ok(execFileSync(node, [join(app, 'node_modules/pnpm/bin/pnpm.cjs'), '--version'], { encoding: 'utf8', env: environment() }).trim()))
    await check('原生模块 / Native modules', () => {
      execFileSync(node, ['-e', "require('node-pty'); require('koffi')"], { cwd: app, env: environment(), stdio: 'pipe' })
      return ok('node-pty + koffi loaded')
    })
    await check('符号链接 / Symlinks', () => containsSymlink(runtime) ? warn('检测到符号链接，不适合 exFAT / Symlinks found') : ok('none'))
    await check('凭据 / Credentials', () => existsSync(join(dshHome, '.credentials.yaml')) || existsSync(join(dshHome, '.env')) ? ok('文件存在 / File present') : warn('尚未配置；在工作台设置模型 / Configure a model in the workbench'))
    await check('凭据权限 / Credential permissions', () => {
      const file = join(dshHome, '.credentials.yaml')
      if (win || !existsSync(file)) return warn(win ? 'Windows ACL 未检查 / Windows ACL not inspected' : '尚无凭据文件 / No credential file')
      return statSync(file).mode & 0o077 ? { status: 'FAIL', detail: '官方 Harness 要求 0600；请使用支持 Unix 权限的文件系统 / Harness requires owner-only permissions' } : ok('0600')
    })
    await check('端口 3080 / Port', () => new Promise(accept => {
      const server = createServer()
      server.once('error', error => accept(warn(error.code + '; 使用 web --port 3081 / Choose another port')))
      server.listen(3080, '127.0.0.1', () => server.close(() => accept(ok('3080 available'))))
    }))
    await check('运行实例 / Running instance', () => existsSync(pidFile) && alive(readJson(pidFile).pid) ? warn('工作台正在运行 / Workbench running') : ok('none'))
    await check('数据目录 / Data', () => existsSync(dshHome) ? ok(dshHome) : warn('首次启动时创建 / Created on launch'))
    for (const item of checks) log(item.status.padEnd(4), item.name + ':', item.detail)
    const failed = checks.filter(item => item.status === 'FAIL').length
    log(checks.filter(item => item.status === 'OK').length + ' OK, ' + checks.filter(item => item.status === 'WARN').length + ' WARN, ' + failed + ' FAIL')
    return failed ? 1 : 0
  }

  async function reset() {
    assertIdle()
    log('将删除 / Delete: ' + RESET_DIRS.join(', '))
    log('保留 / Keep: models/, scripts/, launchers, docs, source')
    const confirmed = await new Promise(accept => {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      rl.once('close', () => accept(false))
      rl.question('[portable] 删除所有会话、设置与凭据？输入 y 确认 / Delete all data? [y/N] ', answer => {
        accept(answer.trim().toLowerCase() === 'y'); rl.close()
      })
    })
    if (!confirmed) { log('已取消 / Cancelled'); return 0 }
    for (const dir of RESET_DIRS) rmSync(join(root, dir), { recursive: true, force: true })
    log('重置完成 / Reset complete')
    return 0
  }

  async function launch(args, explicit = false) {
    assertIdle()
    prepare()
    recover()
    if (!installed()) await setup()
    wrappers()
    migrate({ root, target, dshHome })
    const credential = join(dshHome, '.credentials.yaml')
    if (!win && existsSync(credential)) {
      chmodSync(credential, 0o600)
      if (statSync(credential).mode & 0o077) throw new Error('凭据权限无法设为 0600。Linux 请将整个文件夹放到支持 Unix 权限的文件系统；WSL 请使用 Linux 目录而非无 metadata 的 /mnt/c 或 /mnt/f。')
    }
    if (!win) {
      const helper = join(app, 'node_modules/node-pty/prebuilds', process.platform + '-' + process.arch, 'spawn-helper')
      if (existsSync(helper)) chmodSync(helper, 0o755)
    }
    const forwarded = args.length ? args : explicit ? [] : ['web']
    const web = forwarded[0] === 'web'
    if (web) log('启动工作台；请使用下方 dsh web 的完整地址。Ctrl+C 停止。 / Starting workbench; use the full dsh web URL below.')
    writeJson(pidFile, { pid: process.pid, target })
    try {
      if (web && process.env.DSH_PORTABLE_NO_AUTO_UPDATE !== '1') {
        import('./portable-update.mjs').then(mod => mod.checkForUpdate({ root, manifest })).catch(error => log('更新检查跳过 / Update check skipped:', error.message))
      }
      return await run(node, [dshBin, ...forwarded], { cwd: web ? workspace : process.cwd(), env: environment() })
    } finally { rmSync(pidFile, { force: true }) }
  }

  async function main(args) {
    const [command, ...rest] = args
    switch (command) {
      case 'help': case '--help': case '-h':
        console.log('DeepSeek Harness Portable v' + manifest.portableVersion + '\n\n' +
          'windows.bat / sh linux.sh / sh mac.sh [command]\n' +
          '  (none)            启动 Web 工作台 / Start web workbench\n' +
          '  setup             安装锁定运行时 / Install locked runtime\n' +
          '  doctor            16 项诊断 / Diagnostics\n' +
          '  repair            重建运行时、保留数据 / Rebuild runtime, keep data\n' +
          '  reset             确认后清除数据 / Confirm and clear data\n' +
          '  portable-update   更新便携启动器 / Update portable launcher\n' +
          '  --version         查看版本 / Version\n' +
          '  -- <args>         原样传给 dsh / Forward to dsh\n\n' +
          'https://github.com/' + manifest.release.repository)
        return 0
      case '--version': case '-V':
        console.log('DeepSeek Harness Portable v' + manifest.portableVersion + ' / dsh ' + manifest.deepseekHarness.version); return 0
      case 'setup': return setup()
      case 'repair': return setup(true)
      case 'doctor': return doctor()
      case 'reset': return reset()
      case 'portable-update': {
        assertIdle()
        const { installUpdate } = await import('./portable-update.mjs')
        return installUpdate({ root, manifest, args: rest })
      }
      case '--': return launch(rest, true)
      default: return launch(args)
    }
  }
  return { main, setup, installed, verifyLock, wrappers, environment, doctor, recover, manifest }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const root = args[0] === '--root' ? args[1] : dirname(dirname(fileURLToPath(import.meta.url)))
  const target = args[2] === '--target' ? args[3] : TARGETS[process.platform + '-' + process.arch]
  const forwarded = args[0] === '--root' && args[2] === '--target' ? args.slice(4) : args
  try { process.exitCode = await createPortable(root, target).main(forwarded) }
  catch (error) { console.error('[portable] Error:', error.message); process.exitCode = 1 }
}
