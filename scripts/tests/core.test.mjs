import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, cpSync, renameSync, copyFileSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, execFileSync } from 'node:child_process'
import { createPortable, promote, sha256CanonicalText, TARGETS, containsSymlink } from '../portable.mjs'
import { compareVersions } from '../portable-update.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const target = TARGETS[process.platform + '-' + process.arch]
const win = process.platform === 'win32'
function fixture(t, withNode = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'deepseek portable 测试-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  cpSync(join(source, 'scripts'), join(root, 'scripts'), { recursive: true })
  const runtime = join(root, 'runtimes', target)
  if (withNode) {
    const node = join(runtime, win ? 'node/node.exe' : 'node/bin/node')
    mkdirSync(dirname(node), { recursive: true })
    if (win) copyFileSync(process.execPath, node)
    else symlinkSync(process.execPath, node)
  }
  return { root, runtime, portable: createPortable(root, target) }
}
function ready(root, runtime, portable, code = '') {
  const bin = join(runtime, 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js')
  mkdirSync(dirname(bin), { recursive: true }); writeFileSync(bin, code)
  const state = join(root, 'state', target)
  mkdirSync(state, { recursive: true })
  writeFileSync(join(state, 'install.json'), JSON.stringify({ target,
    dshVersion: portable.manifest.deepseekHarness.version, nodeVersion: portable.manifest.node.version,
    lockSha256: portable.manifest.dependencyLock.sha256 }))
}

test('production lock checksum and Harness integrity match the manifest', t => {
  const { portable } = fixture(t)
  portable.verifyLock()
  assert.equal(sha256CanonicalText('a\r\nb\r\n'), sha256CanonicalText('a\nb\n'))
})
test('tampered dependency lock is rejected', t => {
  const { root, portable } = fixture(t)
  writeFileSync(join(root, 'scripts/locks/package-lock.json'), '{}')
  assert.throws(() => portable.verifyLock(), /checksum mismatch/)
})
test('failed promotion restores the working runtime', t => {
  const { root } = fixture(t), app = join(root, 'app'), previous = join(root, 'previous')
  mkdirSync(app); writeFileSync(join(app, 'working'), 'yes')
  assert.throws(() => promote(join(root, 'missing-stage'), app, previous))
  assert.equal(readFileSync(join(app, 'working'), 'utf8'), 'yes')
})
test('recovery works even when the completion marker still exists', t => {
  const { root, runtime, portable } = fixture(t)
  ready(root, runtime, portable)
  mkdirSync(join(root, 'temp'))
  renameSync(join(runtime, 'dsh'), join(root, 'temp/previous-dsh-' + target))
  portable.recover()
  assert.equal(portable.installed(), true)
})
test('installer failure leaves runtime and data intact and releases its lock', async t => {
  const { root, runtime, portable } = fixture(t, true)
  ready(root, runtime, portable)
  mkdirSync(join(root, 'data')); writeFileSync(join(root, 'data/keep'), 'saved')
  const npm = join(runtime, win ? 'node/node_modules/npm/bin/npm-cli.js' : 'node/lib/node_modules/npm/bin/npm-cli.js')
  mkdirSync(dirname(npm), { recursive: true }); writeFileSync(npm, 'process.exit(23)')
  await assert.rejects(portable.setup(true), /npm ci failed/)
  assert.equal(portable.installed(), true)
  assert.equal(readFileSync(join(root, 'data/keep'), 'utf8'), 'saved')
  assert.equal(existsSync(join(root, 'state/.setup-lock')), false)
})
test('portable environment redirects data, caches and home without changing host environment', t => {
  const { root, portable } = fixture(t)
  const before = process.env.HOME, env = portable.environment()
  for (const name of ['DSH_HOME', 'DSH_AGENTS_HOME', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'npm_config_cache']) {
    assert.ok(env[name].startsWith(root), name)
  }
  assert.equal(process.env.HOME, before)
})
test('pnpm wrapper points to the final installation and still works after relocation', t => {
  const { root, runtime, portable } = fixture(t, true)
  mkdirSync(join(runtime, 'bin'), { recursive: true })
  const entry = join(runtime, 'dsh/node_modules/pnpm/bin/pnpm.cjs')
  mkdirSync(dirname(entry), { recursive: true }); writeFileSync(entry, "console.log('wrapper-ok')")
  portable.wrappers()
  const moved = root + ' moved'
  renameSync(root, moved); t.after(() => rmSync(moved, { recursive: true, force: true }))
  const wrapper = join(moved, 'runtimes', target, 'bin', win ? 'pnpm.cmd' : 'pnpm')
  const output = win ? execFileSync('cmd.exe', ['/d', '/s', '/c', '""' + wrapper + '""'], { encoding: 'utf8', windowsVerbatimArguments: true }) : execFileSync(wrapper, [], { encoding: 'utf8' })
  assert.match(output, /wrapper-ok/)
  assert.doesNotMatch(readFileSync(wrapper, 'utf8'), /stage\.|deepseek portable/)
})
test('default command launches web in the portable workspace; explicit arguments stay intact', t => {
  const { root, runtime, portable } = fixture(t, true)
  ready(root, runtime, portable, "console.log('RESULT=' + JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),home:process.env.DSH_HOME}));process.exitCode=7")
  const invoke = args => spawnSync(process.execPath, [join(root, 'scripts/portable.mjs'), '--root', root, '--target', target, ...args], {
    encoding: 'utf8', env: { ...process.env, DSH_PORTABLE_NO_AUTO_UPDATE: '1' }, cwd: root,
  })
  const first = invoke([])
  assert.equal(first.status, 7, first.stderr)
  const result = JSON.parse(first.stdout.split('RESULT=')[1].trim())
  assert.deepEqual(result.args, ['web']); assert.equal(result.cwd, join(root, 'data/workspace'))
  const forwarded = invoke(['--', 'example', '--root', 'a', '--target', 'b'])
  assert.equal(forwarded.status, 7, forwarded.stderr)
  assert.deepEqual(JSON.parse(forwarded.stdout.split('RESULT=')[1].trim()).args, ['example', '--root', 'a', '--target', 'b'])
  assert.equal(existsSync(join(root, 'state/running.json')), false)
})
test('reset entry works without Node and preserves models and scripts', t => {
  const { root } = fixture(t)
  for (const name of ['windows.bat', 'linux.sh', 'mac.sh']) copyFileSync(join(source, name), join(root, name))
  mkdirSync(join(root, 'models')); writeFileSync(join(root, 'models/keep.bin'), 'model')
  mkdirSync(join(root, 'data')); writeFileSync(join(root, 'data/delete'), 'data')
  const invoke = input => spawnSync(win ? 'cmd.exe' : 'sh', win ? ['/d', '/c', join(root, 'windows.bat'), 'reset'] : [join(root, 'linux.sh'), 'reset'], { input, encoding: 'utf8' })
  assert.equal(invoke('n\n').status, 0)
  assert.ok(existsSync(join(root, 'data/delete')))
  const result = invoke('y\n'); assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(join(root, 'data')), false)
  assert.equal(readFileSync(join(root, 'models/keep.bin'), 'utf8'), 'model')
  assert.ok(existsSync(join(root, 'scripts/portable.mjs')))
  assert.equal(existsSync(join(root, 'runtimes')), false)
})
test('doctor reports missing runtime as a failure, not a successful inspection', async t => {
  const { portable } = fixture(t)
  assert.equal(await portable.doctor(), 1)
})
test('symlink detector uses directory-entry metadata, not stat of the target', { skip: win }, t => {
  const { root } = fixture(t)
  writeFileSync(join(root, 'real'), 'data'); symlinkSync(join(root, 'real'), join(root, 'link'))
  assert.equal(containsSymlink(root), true)
})
test('CLI entry runs through a directory alias, including macOS /var', { skip: win }, t => {
  const { root } = fixture(t)
  const alias = root + '-alias'
  symlinkSync(root, alias)
  t.after(() => rmSync(alias))
  const result = spawnSync(process.execPath, [join(alias, 'scripts/portable.mjs'), '--version'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /DeepSeek Harness Portable v1\.0\.0/)
})
test('release versions are compared numerically', () => {
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1)
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('1.0.0', '2.0.0'), -1)
})

test('platform bootstrap quarantines an invalid cached Node archive before extraction', t => {
  const { root, portable } = fixture(t)
  const archive = join(root, 'packages/bootstrap', target, 'node-' + portable.manifest.node.version + (win ? '.zip' : '.tar.xz'))
  mkdirSync(dirname(archive), { recursive: true }); writeFileSync(archive, 'invalid download')
  const result = win
    ? spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/portable.ps1'), 'setup'], { encoding: 'utf8' })
    : spawnSync('sh', [join(root, 'scripts/portable.sh'), target, 'setup'], { encoding: 'utf8' })
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.ok(existsSync(archive + '.bad'), result.stdout + result.stderr)
  assert.equal(existsSync(archive), false)
  assert.equal(existsSync(join(root, 'runtimes', target, '.node-lock')), false)
})
