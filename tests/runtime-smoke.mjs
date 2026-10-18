// Exercises an installed, unmodified runtime without model/API calls.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer, connect } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPortable, TARGETS } from '../scripts/portable.mjs'
import { projectKey } from '../scripts/session-portability.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = TARGETS[process.platform + '-' + process.arch]
const portable = createPortable(root, target)
assert.equal(portable.installed(), true, 'Run setup first')
const app = join(root, 'runtimes', target, 'dsh')
const require = createRequire(join(app, 'package.json'))
const dsh = join(app, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
assert.match(execFileSync(process.execPath, [dsh, '--help'], { env: portable.environment(), encoding: 'utf8' }), /Usage:/)
const upstream = readFileSync(join(app, 'node_modules/@deepseek-ai/dsh-session-persistence-jsonl/lib/index.js'), 'utf8')
const match = upstream.match(/function projectKey\(cwd\) \{[\s\S]*?\n\}/)
assert.ok(match, 'Pinned upstream projectKey must remain identifiable')
const officialKey = Function(match[0] + '; return projectKey')()
for (const path of ['C:\\Users\\测试\\project', '/tmp/a b/😀', '/a///b', '/'.repeat(300), '/a~b']) assert.equal(projectKey(path), officialKey(path))
require('koffi')
const pty = require('node-pty')
const terminal = pty.spawn(process.execPath, ['-e', 'console.log("PORTABLE_PTY_OK")'], { env: portable.environment(), cwd: root, cols: 80, rows: 24 })
await new Promise((accept, reject) => {
  let output = ''
  const timer = setTimeout(() => { terminal.kill(); reject(new Error('PTY timeout')) }, 15000)
  terminal.onData(data => { output += data })
  terminal.onExit(() => { clearTimeout(timer); /PORTABLE_PTY_OK/.test(output) ? accept() : reject(new Error('PTY failed: ' + output)) })
})
console.log('PASS: official CLI, upstream projectKey, koffi, native PTY')
const port = await new Promise(accept => {
  const server = createServer().listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => accept(value)) })
})
const child = spawn(process.execPath, [join(root, 'scripts/portable.mjs'), '--root', root, '--target', target, 'web', '--no-open', '--port', String(port)], {
  env: { ...process.env, DSH_PORTABLE_NO_AUTO_UPDATE: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
})
let output = '', stopped = false
const exited = new Promise(accept => child.once('exit', (code, signal) => { stopped = true; accept({ code, signal }) }))
child.stdout.on('data', chunk => { output += chunk })
child.stderr.on('data', chunk => { output += chunk })
try {
  const deadline = Date.now() + 90000
  while (!output.includes('dsh web:') && !stopped && Date.now() < deadline) await new Promise(r => setTimeout(r, 200))
  assert.match(output, /dsh web:/, output)
  const unauthenticated = await fetch('http://127.0.0.1:' + port)
  assert.equal(unauthenticated.status, 401)
  const url = output.replace(/\u001b\[[0-9;]*m/g, '').match(/dsh web:\s*(https?:\/\/\S+)/)?.[1]
  assert.ok(url, 'Harness must print its authenticated launch URL')
  const entry = await fetch(url, { redirect: 'manual' })
  const cookie = entry.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const response = entry.status >= 300 && entry.status < 400
    ? await fetch(new URL(entry.headers.get('location'), url), { headers: { cookie } })
    : entry
  assert.equal(response.status, 200)
  assert.match(await response.text(), /<html/i)
  console.log('PASS: Web rejects unauthenticated access (401); launch URL returns authenticated HTML (200) on port ' + port)
} finally {
  if (!stopped) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'pipe' })
    else child.kill('SIGTERM')
  }
  const timeout = setTimeout(() => { if (!stopped) child.kill('SIGKILL') }, 15000)
  await exited; clearTimeout(timeout)
}
const occupied = await new Promise(accept => {
  const socket = connect(port, '127.0.0.1')
  socket.once('connect', () => { socket.destroy(); accept(true) })
  socket.once('error', () => accept(false))
})
assert.equal(occupied, false, 'Web server must release its port on stop')
console.log('PASS: shutdown released the listener')
// The Windows ConPTY worker can retain a native handle after its onExit event.
// All assertions and child shutdown have completed; terminate this test host.
process.exit(0)
