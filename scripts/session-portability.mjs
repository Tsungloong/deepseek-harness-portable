// DeepSeek Harness Portable. Copyright 2026 Tsungloong.
// Rewrite only paths inside the moved portable folder. External projects stay
// attached to their actual paths; they are never replaced with empty folders.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join, win32, posix } from 'node:path'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'

// The pinned upstream's projectKey is private, not exported. Keep this small
// encoding equivalent to dsh-session-persistence-jsonl@0.2.1-rc.2, with a test
// against the installed package (separator runs, UTF-16 and uppercase hex).
export function projectKey(cwd) {
  if (!cwd) throw new Error('cannot encode an empty project path')
  let readable = '', separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const code = cwd.charCodeAt(i), ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (/^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch; separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  return '--' + (readable.replace(/^-+/, '') || 'root').slice(0, 251) + '--'
}

export function relocatedPath(path, oldRoot, newRoot) {
  const oldStyle = /^[A-Za-z]:[\\/]|^\\\\/.test(oldRoot) ? win32 : posix
  const relative = oldStyle.relative(oldRoot, path)
  if (relative === '..' || relative.startsWith('..' + oldStyle.sep) || oldStyle.isAbsolute(relative)) return path
  const newStyle = /^[A-Za-z]:[\\/]|^\\\\/.test(newRoot) ? win32 : posix
  return newStyle.join(newRoot, ...relative.split(oldStyle.sep))
}

function replaceFile(file, bytes) {
  const backup = file + '.portable-backup'
  if (!existsSync(backup)) writeFileSync(backup, readFileSync(file))
  writeFileSync(file + '.new', bytes)
  renameSync(file + '.new', file)
}

export function sessionHeader(bytes) {
  const compressed = bytes.length >= 4 && bytes.readUInt32LE(0) === 0xfd2fb528
  const decoded = compressed ? zstdDecompressSync(bytes, { info: true }) : null
  const firstFrame = decoded ? decoded.buffer : bytes
  const newline = firstFrame.indexOf(10)
  const end = newline < 0 ? firstFrame.length : newline
  const header = JSON.parse(firstFrame.subarray(0, end).toString('utf8'))
  if (header.type !== 'session') throw new Error('Unexpected session header')
  return { header, compressed, firstFrame, end, consumed: decoded?.engine.bytesWritten }
}

export function rewriteSessionHeader(file, newCwd) {
  const bytes = readFileSync(file)
  const { header, compressed, firstFrame, end, consumed } = sessionHeader(bytes)
  if (header.cwd === newCwd) return false
  header.cwd = newCwd
  // Keep all other records in frame zero and every subsequent frame unchanged.
  const frame = Buffer.concat([Buffer.from(JSON.stringify(header)), firstFrame.subarray(end)])
  replaceFile(file, compressed ? Buffer.concat([zstdCompressSync(frame), bytes.subarray(consumed)]) : frame)
  return true
}

function sessionFiles(dir) {
  if (!existsSync(dir)) return []
  const files = []
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name)
    if (item.isDirectory()) files.push(...sessionFiles(file))
    else if (item.isFile() && /^session\.v\d+\.jsonl(?:\.zstd)?$/.test(item.name)) files.push(file)
  }
  return files
}

export function migrate({ root, target, dshHome }) {
  mkdirSync(dshHome, { recursive: true })
  const location = join(dshHome, 'portable-location.json')
  const previous = existsSync(location) ? JSON.parse(readFileSync(location, 'utf8')) : null
  if (previous?.root && previous.root !== root) {
    const move = path => typeof path === 'string' ? relocatedPath(path, previous.root, root) : path
    const sessions = join(dshHome, 'sessions')
    const changes = new Map()
    // Read actual nested session files, rather than assuming one flat log.
    for (const file of sessionFiles(sessions)) {
      const { header } = sessionHeader(readFileSync(file))
      const newCwd = move(header.cwd)
      if (newCwd !== header.cwd) changes.set(header.cwd, newCwd)
    }
    for (const [oldCwd, newCwd] of changes) {
      const from = join(sessions, projectKey(oldCwd)), to = join(sessions, projectKey(newCwd))
      if (from !== to && existsSync(from) && existsSync(to)) throw new Error('Session relocation destination already exists: ' + to)
    }
    let count = 0
    for (const file of sessionFiles(sessions)) {
      const { header } = sessionHeader(readFileSync(file))
      const newCwd = move(header.cwd)
      if (newCwd !== header.cwd && rewriteSessionHeader(file, newCwd)) count++
    }
    for (const [oldCwd, newCwd] of changes) {
      const from = join(sessions, projectKey(oldCwd)), to = join(sessions, projectKey(newCwd))
      if (from !== to && existsSync(from)) renameSync(from, to)
    }
    const registryFile = join(dshHome, 'storages/workspace.json')
    if (existsSync(registryFile)) {
      const registry = JSON.parse(readFileSync(registryFile, 'utf8'))
      let changed = false
      for (const workspace of Object.values(registry.tables?.workspaces ?? {})) {
        const path = move(workspace.path)
        if (path !== workspace.path) { workspace.path = path; changed = true }
      }
      if (changed) replaceFile(registryFile, JSON.stringify(registry, null, 2) + '\n')
    }
    const cache = join(dshHome, 'storages/session_projcache/sessions')
    if (existsSync(cache)) {
      for (const file of readdirSync(cache).filter(file => file.endsWith('.json'))) {
        const path = join(cache, file), document = JSON.parse(readFileSync(path, 'utf8'))
        const identity = document.document?.record?.identity
        if (identity && move(identity.cwd) !== identity.cwd) {
          identity.cwd = move(identity.cwd)
          replaceFile(path, JSON.stringify(document, null, 2) + '\n')
        }
      }
    }
    console.log('[portable] 已迁移文件夹内会话 / Relocated internal sessions:', count)
  }
  writeFileSync(location + '.new', JSON.stringify({ schema: 1, root, target }, null, 2) + '\n')
  renameSync(location + '.new', location)
}
