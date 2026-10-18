// Real tar archive + local HTTP server: whitelist replacement keeps user data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installUpdate } from '../scripts/portable-update.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Mirrors scripts/portable-update.mjs: whole directories plus explicit root files.
const REPLACE = ['scripts', 'docs', 'tests', 'linux.sh', 'mac.sh', 'windows.bat', 'README.md', 'README.en.md', 'README.txt',
  'LICENSE', 'NOTICE.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'package.json',
  '.gitignore', '.gitattributes', '.editorconfig']

async function fixture(t) {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh-update-')), root = join(temporary, 'current'), candidate = join(temporary, 'next')
  t.after(() => rmSync(temporary, { recursive: true, force: true }))
  mkdirSync(root); mkdirSync(candidate)
  for (const item of REPLACE) {
    if (!existsSync(join(source, item))) continue
    cpSync(join(source, item), join(root, item), { recursive: true })
    cpSync(join(source, item), join(candidate, item), { recursive: true })
  }
  writeFileSync(join(root, 'scripts/STALE.txt'), 'removed by the update')
  writeFileSync(join(root, 'my-notes.txt'), 'user file')
  const manifest = JSON.parse(readFileSync(join(root, 'scripts/manifest.json')))
  const remote = structuredClone(manifest)
  remote.portableVersion = '1.1.0'
  writeFileSync(join(candidate, 'scripts/manifest.json'), JSON.stringify(remote, null, 2))
  writeFileSync(join(candidate, 'README.txt'), 'new release')
  writeFileSync(join(candidate, 'docs/NEW.md'), '# new doc')
  writeFileSync(join(candidate, 'tests/new.test.mjs'), '// new test')
  writeFileSync(join(candidate, 'user-notes.txt'), 'archive-only file')
  mkdirSync(join(candidate, 'extra'))
  writeFileSync(join(candidate, 'extra/data.txt'), 'archive-only directory')
  const archive = join(temporary, 'release.tar.gz')
  execFileSync('tar', ['-czf', archive, '-C', candidate, ...REPLACE, 'user-notes.txt', 'extra'])
  const bytes = readFileSync(archive)
  for (const dir of ['data', 'models', 'runtimes', 'state']) {
    mkdirSync(join(root, dir)); writeFileSync(join(root, dir, 'keep'), dir)
  }
  let archiveHits = 0
  const server = createServer((request, response) => {
    if (request.url === '/archive') { archiveHits++; response.end(bytes) }
    else { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(remote)) }
  })
  await new Promise(accept => server.listen(0, '127.0.0.1', accept))
  t.after(() => new Promise(accept => server.close(accept)))
  const url = 'http://127.0.0.1:' + server.address().port
  remote.release.archive = { url: url + '/archive', sha256: createHash('sha256').update(bytes).digest('hex') }
  return { root, manifest, remote, url, before: readFileSync(join(root, 'README.txt'), 'utf8'), archiveHits: () => archiveHits }
}

test('update replaces source directories and whitelisted root files, keeping personal data', async t => {
  const { root, manifest, url } = await fixture(t)
  assert.equal(await installUpdate({ root, manifest, args: ['--manifest', url + '/manifest'] }), 0)
  assert.equal(JSON.parse(readFileSync(join(root, 'scripts/manifest.json'))).portableVersion, '1.1.0')
  assert.equal(readFileSync(join(root, 'README.txt'), 'utf8'), 'new release')
  assert.ok(existsSync(join(root, 'docs/NEW.md')))
  assert.ok(existsSync(join(root, 'tests/new.test.mjs')))
  assert.equal(existsSync(join(root, 'scripts/STALE.txt')), false)
  for (const dir of ['data', 'models', 'runtimes', 'state']) assert.equal(readFileSync(join(root, dir, 'keep'), 'utf8'), dir)
  assert.equal(readFileSync(join(root, 'my-notes.txt'), 'utf8'), 'user file')
  assert.equal(existsSync(join(root, 'user-notes.txt')), false)
  assert.equal(existsSync(join(root, 'extra')), false)
})

test('a bad archive checksum leaves the installed source unchanged', async t => {
  const { root, manifest, remote, url, before } = await fixture(t)
  remote.release.archive.sha256 = '0'.repeat(64)
  await assert.rejects(installUpdate({ root, manifest, args: ['--manifest', url + '/manifest'] }), /checksum mismatch/)
  assert.equal(JSON.parse(readFileSync(join(root, 'scripts/manifest.json'))).portableVersion, manifest.portableVersion)
  assert.equal(readFileSync(join(root, 'README.txt'), 'utf8'), before)
})

test('an already current release is a no-op', async t => {
  const { root, manifest, remote, url, before, archiveHits } = await fixture(t)
  remote.portableVersion = manifest.portableVersion
  assert.equal(await installUpdate({ root, manifest, args: ['--manifest', url + '/manifest'] }), 0)
  assert.equal(readFileSync(join(root, 'README.txt'), 'utf8'), before)
  assert.equal(archiveHits(), 0)
})
