// Fact-based checks: dependency lock, data isolation, bootstrap quarantine, reset.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, cpSync, copyFileSync, realpathSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPortable, TARGETS } from '../scripts/portable.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = TARGETS[process.platform + '-' + process.arch]
const win = process.platform === 'win32'
const report = "console.log('RESULT=' + JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), home: process.env.DSH_HOME })); process.exitCode = 7"

function fixture(t, withNode = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-core-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  cpSync(join(source, 'scripts'), join(root, 'scripts'), { recursive: true })
  if (withNode) {
    const node = join(root, 'runtimes', target, win ? 'node/node.exe' : 'node/bin/node')
    mkdirSync(dirname(node), { recursive: true })
    if (win) copyFileSync(process.execPath, node)
    else symlinkSync(process.execPath, node)
  }
  return { root, portable: createPortable(root, target) }
}

function ready(root, portable) {
  const bin = join(root, 'runtimes', target, 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js')
  mkdirSync(dirname(bin), { recursive: true })
  writeFileSync(bin, report)
  mkdirSync(join(root, 'state', target), { recursive: true })
  writeFileSync(join(root, 'state', target, 'install.json'), JSON.stringify({ target,
    dshVersion: portable.manifest.deepseekHarness.version, nodeVersion: portable.manifest.node.version,
    lockSha256: portable.manifest.dependencyLock.sha256 }))
}

function invoke(root, args) {
  return spawnSync(process.execPath, [join(root, 'scripts/portable.mjs'), '--root', root, '--target', target, ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, DSH_PORTABLE_NO_AUTO_UPDATE: '1' },
  })
}

const reported = stdout => JSON.parse(stdout.split('RESULT=')[1].trim())

test('dependency lock matches the manifest and a tampered lock is rejected', t => {
  const { root, portable } = fixture(t)
  const { raw, lock } = portable.verifyLock()
  assert.ok(lock.packages)
  assert.equal(createHash('sha256').update(raw.replace(/\r\n/g, '\n')).digest('hex'), portable.manifest.dependencyLock.sha256)
  writeFileSync(join(root, 'scripts/locks/package-lock.json'), '{}')
  assert.throws(() => portable.verifyLock(), /checksum mismatch/)
})

test('default command starts web in the portable workspace with isolated DSH_HOME', t => {
  const { root, portable } = fixture(t, true)
  ready(root, portable)
  const run = invoke(root, [])
  assert.equal(run.status, 7, run.stderr)
  assert.deepEqual(reported(run.stdout).args, ['web'])
  assert.equal(reported(run.stdout).cwd, join(root, 'data/workspace'))
  assert.equal(reported(run.stdout).home, join(root, 'data/dsh-home'))
  assert.equal(existsSync(join(root, 'state/running.json')), false)
})

test('explicit arguments pass through to dsh unchanged', t => {
  const { root, portable } = fixture(t, true)
  ready(root, portable)
  const explicit = invoke(root, ['--', 'example', '--root', 'a', '--target', 'b'])
  assert.equal(explicit.status, 7, explicit.stderr)
  assert.deepEqual(reported(explicit.stdout).args, ['example', '--root', 'a', '--target', 'b'])
  const web = invoke(root, ['web', '--port', '4321'])
  assert.equal(web.status, 7, web.stderr)
  assert.deepEqual(reported(web.stdout).args, ['web', '--port', '4321'])
})

test('an invalid cached Node archive is quarantined before extraction', t => {
  const { root, portable } = fixture(t)
  const archive = join(root, 'packages/bootstrap', target, 'node-' + portable.manifest.node.version + (win ? '.zip' : '.tar.xz'))
  mkdirSync(dirname(archive), { recursive: true })
  writeFileSync(archive, 'invalid download')
  const run = win
    ? spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/portable.ps1'), 'setup'], { encoding: 'utf8' })
    : spawnSync('sh', [join(root, 'scripts/portable.sh'), target, 'setup'], { encoding: 'utf8' })
  assert.equal(run.status, 1, run.stdout + run.stderr)
  assert.ok(existsSync(archive + '.bad'))
  assert.equal(existsSync(archive), false)
  assert.equal(existsSync(join(root, 'runtimes', target, '.node-lock')), false)
})

test('reset through the launcher clears runtime data and keeps models and scripts', t => {
  const { root } = fixture(t)
  copyFileSync(join(source, win ? 'windows.bat' : 'linux.sh'), join(root, win ? 'windows.bat' : 'linux.sh'))
  mkdirSync(join(root, 'models'))
  writeFileSync(join(root, 'models/keep.bin'), 'model')
  mkdirSync(join(root, 'data'))
  writeFileSync(join(root, 'data/delete'), 'data')
  const reset = input => win
    ? spawnSync('cmd.exe', ['/d', '/c', 'windows.bat', 'reset'], { cwd: root, input, encoding: 'utf8' })
    : spawnSync('sh', [join(root, 'linux.sh'), 'reset'], { cwd: root, input, encoding: 'utf8' })
  assert.equal(reset('n\n').status, 0)
  assert.ok(existsSync(join(root, 'data/delete')))
  const confirmed = reset('y\n')
  assert.equal(confirmed.status, 0, confirmed.stderr)
  assert.equal(existsSync(join(root, 'data')), false)
  assert.equal(existsSync(join(root, 'runtimes')), false)
  assert.equal(readFileSync(join(root, 'models/keep.bin'), 'utf8'), 'model')
  assert.ok(existsSync(join(root, 'scripts/portable.mjs')))
})
