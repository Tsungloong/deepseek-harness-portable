// Real official persistence + AgentLoop, driven only by a loopback Messages fixture.
// Usage: node tests/session-upgrade-smoke.mjs <previous dsh runtime directory>
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, copyFileSync, renameSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPortable, TARGETS } from '../scripts/portable.mjs'
import { migrate } from '../scripts/session-portability.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = TARGETS[process.platform + '-' + process.arch]
const current = join(root, 'runtimes', target, 'dsh')
const previous = resolve(process.argv[2] || current)
const base = createPortable(root, target)
assert.equal(base.installed(), true, 'Run setup first')
mkdirSync(join(root, 'output'), { recursive: true })
const temporary = mkdtempSync(join(root, 'output/session-upgrade-'))
let location = join(temporary, 'before')
mkdirSync(join(location, 'scripts'), { recursive: true })
copyFileSync(join(root, 'scripts/manifest.json'), join(location, 'scripts/manifest.json'))
const requests = []
const reply = 'PORTABLE_FIXTURE_REPLY'
const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/messages') { response.writeHead(404).end(); return }
  try {
    let body = ''
    for await (const chunk of request) body += chunk
    requests.push(JSON.parse(body))
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    const emit = (type, fields) => response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`)
    emit('message_start', { message: { id: 'msg-fixture-' + requests.length, type: 'message', role: 'assistant', model: 'deepseek-flash', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } })
    emit('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    emit('content_block_delta', { index: 0, delta: { type: 'text_delta', text: reply } })
    emit('content_block_stop', { index: 0 })
    emit('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } })
    emit('message_stop', {})
    response.end()
  } catch (error) { response.destroy(error) }
})
await new Promise(accept => server.listen(0, '127.0.0.1', accept))
const baseURL = 'http://127.0.0.1:' + server.address().port

async function turn(runtime, message, sessionId) {
  const portable = createPortable(location, target)
  const env = { ...portable.environment(), PATH: base.environment().PATH,
    DEEPSEEK_API_KEY: 'local-fixture-not-a-secret', DEEPSEEK_BASE_URL: baseURL,
    DSH_PORTABLE_NO_AUTO_UPDATE: '1', NO_PROXY: 'localhost,127.0.0.1' }
  const cwd = join(location, 'data/workspace')
  for (const path of [cwd, env.DSH_HOME, env.HOME, env.TEMP]) mkdirSync(path, { recursive: true })
  migrate({ root: location, target, dshHome: env.DSH_HOME })
  const args = [join(runtime, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), 'headless', '--json']
  if (sessionId) args.push('--session-id', sessionId)
  args.push(message)
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  const timeout = setTimeout(() => {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else child.kill('SIGKILL')
  }, 180000)
  const code = await new Promise((accept, reject) => { child.once('error', reject); child.once('close', accept) }).finally(() => clearTimeout(timeout))
  assert.equal(code, 0, stdout + '\n' + stderr)
  const events = stdout.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line))
  assert.equal(events.find(event => event.type === 'final')?.text, reply, stdout)
  const id = events.find(event => event.type === 'session')?.sessionId
  assert.ok(id, 'Official runner must report the session ID')
  if (sessionId) assert.equal(id, sessionId)
  return id
}

try {
  const oldVersion = JSON.parse(readFileSync(join(previous, 'node_modules/@deepseek-ai/dsh/package.json'))).version
  const id = await turn(previous, 'PORTABLE_OLD_SESSION_MARKER')
  console.log('PASS: official ' + oldVersion + ' persisted a completed AgentLoop turn')
  requests.length = 0
  await turn(current, 'PORTABLE_UPGRADED_SESSION_MARKER', id)
  assert.ok(requests.some(request => JSON.stringify(request.messages).includes('PORTABLE_OLD_SESSION_MARKER')))
  console.log('PASS: official ' + base.manifest.deepseekHarness.version + ' reopened and continued the same session with old history')
  const moved = join(temporary, 'moved 中文 folder')
  renameSync(location, moved)
  location = moved
  requests.length = 0
  await turn(current, 'PORTABLE_MOVED_SESSION_MARKER', id)
  assert.ok(requests.some(request => ['PORTABLE_OLD_SESSION_MARKER', 'PORTABLE_UPGRADED_SESSION_MARKER'].every(marker => JSON.stringify(request.messages).includes(marker))))
  console.log('PASS: moved directory reopened and continued the same session with both earlier turns')
} finally {
  server.closeAllConnections()
  await new Promise(accept => server.close(accept))
  rmSync(temporary, { recursive: true, force: true })
}
