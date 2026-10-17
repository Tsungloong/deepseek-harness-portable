import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { projectKey, relocatedPath, rewriteSessionHeader, migrate } from '../session-portability.mjs'

const put = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value) }
const fixture = t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-migration-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}
test('project key follows upstream separator folding and UTF-16 encoding', () => {
  assert.equal(projectKey('C:\\Users\\me\\proj'), '--C-Users-me-proj--')
  assert.equal(projectKey('/项目/😀'), '--~9879~76EE-~D83D~DE00--')
  assert.throws(() => projectKey(''), /empty/)
})
test('only internal paths relocate, across Windows and POSIX separators', () => {
  assert.equal(relocatedPath('C:\\Portable\\data\\work', 'C:\\Portable', '/mnt/portable'), '/mnt/portable/data/work')
  assert.equal(relocatedPath('/old/data/work', '/old', 'D:\\Portable'), 'D:\\Portable\\data\\work')
  assert.equal(relocatedPath('/old-other/project', '/old', '/new'), '/old-other/project')
  assert.equal(relocatedPath('D:\\Projects', 'C:\\Portable', '/new'), 'D:\\Projects')
})
test('compressed header rewrite preserves subsequent frames byte for byte', t => {
  const root = fixture(t), file = join(root, 'session.v5.jsonl.zstd')
  const header = zstdCompressSync(Buffer.from(JSON.stringify({ type: 'session', cwd: '/old', id: 's' }) + '\n'))
  const tail = zstdCompressSync(Buffer.from('{"type":"message","content":"保留内容"}\n'))
  const original = Buffer.concat([header, tail]); put(file, original)
  assert.equal(rewriteSessionHeader(file, '/new'), true)
  const updated = readFileSync(file), decoded = zstdDecompressSync(updated, { info: true })
  assert.equal(JSON.parse(decoded.buffer.toString()).cwd, '/new')
  assert.deepEqual(updated.subarray(decoded.engine.bytesWritten), tail)
  assert.deepEqual(readFileSync(file + '.portable-backup'), original)
  assert.equal(rewriteSessionHeader(file, '/new'), false)
})
test('real nested logs, project directory, registry and projection cache move together', t => {
  const root = fixture(t), home = join(root, 'data/dsh-home'), old = '/old-portable/data/workspace', current = join(root, 'data/workspace')
  put(join(home, 'portable-location.json'), { root: '/old-portable', target: 'linux-x64' })
  const log = join(home, 'sessions', projectKey(old), 'session-id/session.v5.jsonl')
  put(log, JSON.stringify({ type: 'session', cwd: old, id: 'session-id' }) + '\n{"type":"message","content":"hello"}\n')
  put(join(home, 'storages/workspace.json'), { tables: { workspaces: { local: { path: old }, external: { path: '/external/project' } } } })
  const cache = join(home, 'storages/session_projcache/sessions/s.json')
  put(cache, { document: { record: { identity: { cwd: old } } } })
  migrate({ root, target: 'linux-x64', dshHome: home })
  const newLog = join(home, 'sessions', projectKey(current), 'session-id/session.v5.jsonl')
  assert.equal(JSON.parse(readFileSync(newLog, 'utf8').split('\n')[0]).cwd, current)
  assert.ok(existsSync(newLog + '.portable-backup'))
  const registry = JSON.parse(readFileSync(join(home, 'storages/workspace.json')))
  assert.equal(registry.tables.workspaces.local.path, current)
  assert.equal(registry.tables.workspaces.external.path, '/external/project')
  assert.equal(JSON.parse(readFileSync(cache)).document.record.identity.cwd, current)
  migrate({ root, target: 'linux-x64', dshHome: home })
  assert.equal(readFileSync(newLog, 'utf8').split('\n')[1], '{"type":"message","content":"hello"}')
})
