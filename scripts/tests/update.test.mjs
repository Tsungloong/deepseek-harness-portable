import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installUpdate, SOURCE_ITEMS, checkForUpdate } from '../portable-update.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
async function fixture(t) {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh-update-')), root = join(temporary, 'current'), candidate = join(temporary, 'next')
  t.after(() => rmSync(temporary, { recursive: true, force: true }))
  mkdirSync(root); mkdirSync(candidate)
  for (const item of SOURCE_ITEMS) {
    cpSync(join(source, item), join(root, item), { recursive: true })
    cpSync(join(source, item), join(candidate, item), { recursive: true })
  }
  const manifest = JSON.parse(readFileSync(join(root, 'scripts/manifest.json')))
  const remote = structuredClone(manifest); remote.portableVersion = '1.1.0'
  writeFileSync(join(candidate, 'scripts/manifest.json'), JSON.stringify(remote, null, 2))
  writeFileSync(join(candidate, 'README.txt'), 'new release')
  const archive = join(temporary, 'release.tar.gz')
  execFileSync('tar', ['-czf', archive, '-C', candidate, ...SOURCE_ITEMS])
  const bytes = readFileSync(archive)
  let hits = 0
  const server = createServer((request, response) => {
    hits++
    if (request.url === '/archive') response.end(bytes)
    else { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(remote)) }
  })
  await new Promise(accept => server.listen(0, '127.0.0.1', accept))
  t.after(() => new Promise(accept => server.close(accept)))
  const url = 'http://127.0.0.1:' + server.address().port
  remote.release.archive = { url: url + '/archive', sha256: createHash('sha256').update(bytes).digest('hex') }
  for (const dir of ['data', 'models', 'runtimes']) {
    mkdirSync(join(root, dir)); writeFileSync(join(root, dir, 'keep'), dir)
  }
  return { root, manifest, remote, url, hits: () => hits }
}

test('update replaces complete source, including scripts and lock, without touching personal directories', async t => {
  const { root, manifest, url } = await fixture(t)
  assert.equal(await installUpdate({ root, manifest, args: ['--manifest', url + '/manifest'] }), 0)
  assert.equal(JSON.parse(readFileSync(join(root, 'scripts/manifest.json'))).portableVersion, '1.1.0')
  assert.equal(readFileSync(join(root, 'README.txt'), 'utf8'), 'new release')
  for (const dir of ['data', 'models', 'runtimes']) assert.equal(readFileSync(join(root, dir, 'keep'), 'utf8'), dir)
})
test('invalid update checksum leaves installed source unchanged', async t => {
  const { root, manifest, remote, url } = await fixture(t)
  remote.release.archive.sha256 = '0'.repeat(64)
  await assert.rejects(installUpdate({ root, manifest, args: ['--manifest', url] }), /checksum mismatch/)
  assert.equal(JSON.parse(readFileSync(join(root, 'scripts/manifest.json'))).portableVersion, manifest.portableVersion)
})
test('automatic update checks respect the 24-hour interval and do not replace code', async t => {
  const { root, manifest, url, hits } = await fixture(t)
  manifest.release.manifestUrl = url
  await checkForUpdate({ root, manifest }); await checkForUpdate({ root, manifest })
  assert.equal(hits(), 1)
  assert.equal(JSON.parse(readFileSync(join(root, 'scripts/manifest.json'))).portableVersion, manifest.portableVersion)
})
