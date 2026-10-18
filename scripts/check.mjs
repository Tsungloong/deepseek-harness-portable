#!/usr/bin/env node
// Read-only repository consistency check. Usage: node scripts/check.mjs [--tag v1.0.2]
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const fail = (file, message) => problems.push(file + ': ' + message)
const readJson = file => JSON.parse(readFileSync(join(root, file), 'utf8'))
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const skip = new Set(['.git', 'data', 'runtimes', 'packages', 'state', 'output', 'logs', 'temp', 'dist', 'node_modules', 'private' + '-backups'])

function repositoryFiles() {
  // git ls-files only applies when this folder is the repository root. An
  // unpacked release inside another repository must be walked directly.
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' })
  const samePath = (a, b) => process.platform === 'win32'
    ? resolve(a).toLowerCase() === resolve(b).toLowerCase()
    : resolve(a) === resolve(b)
  if (top.status === 0 && samePath(top.stdout.trim(), root)) {
    const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    if (result.status === 0) return result.stdout.split('\0').filter(Boolean)
  }
  const list = []
  const walk = dir => {
    for (const item of readdirSync(join(root, dir), { withFileTypes: true })) {
      const file = dir ? dir + '/' + item.name : item.name
      if (item.isDirectory()) { if (dir || !skip.has(item.name)) walk(file) } else list.push(file)
    }
  }
  walk('')
  return list
}

const textExtensions = new Set(['.md', '.mjs', '.js', '.json', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.txt'])
const hiddenText = new Set(['.editorconfig', '.gitattributes', '.gitignore'])
const isText = file => textExtensions.has(extname(file)) || hiddenText.has(basename(file))
const files = repositoryFiles().filter(file => existsSync(join(root, file)) && statSync(join(root, file)).isFile())

// 1. Version consistency (package.json, manifest, CHANGELOG) and the optional release tag.
const pkg = readJson('package.json')
const manifest = readJson('scripts/manifest.json')
const version = manifest.portableVersion
if (pkg.version !== version) fail('package.json', 'version ' + pkg.version + ' != scripts/manifest.json portableVersion ' + version)
const tagIndex = process.argv.indexOf('--tag')
if (tagIndex !== -1) {
  const tag = process.argv[tagIndex + 1] ?? '(missing)'
  if (tag !== 'v' + version) fail('--tag', tag + ' != v' + version)
}
for (const file of ['CHANGELOG.md', 'docs/validation.md']) {
  if (!existsSync(join(root, file))) fail(file, 'missing')
}
if (existsSync(join(root, 'CHANGELOG.md')) &&
  !new RegExp('^## \\[' + escape(version) + '\\]', 'm').test(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'))) {
  fail('CHANGELOG.md', 'missing section "## [' + version + ']"')
}

// 2. Dependency lock checksum, with the same newline normalization the launcher uses.
const lockFile = 'scripts/' + manifest.dependencyLock.path
const lockText = readFileSync(join(root, lockFile), 'utf8').replace(/\r\n/g, '\n')
const lockSha = createHash('sha256').update(lockText).digest('hex')
if (lockSha !== manifest.dependencyLock.sha256) fail(lockFile, 'sha256 ' + lockSha + ' != manifest.dependencyLock.sha256')

// 3. Relative Markdown links in every shipped document must resolve.
const documents = new Set(['README.md', 'README.en.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md',
  'CHANGELOG.md', 'NOTICE.md', '.github/PULL_REQUEST_TEMPLATE.md'])
for (const file of files) if (file.startsWith('docs/') && file.endsWith('.md')) documents.add(file)
for (const file of documents) {
  if (!existsSync(join(root, file))) continue
  for (const match of readFileSync(join(root, file), 'utf8').matchAll(/\]\(([^)\n]+)\)/g)) {
    let target = match[1].trim()
    target = target.startsWith('<') ? target.slice(1, target.indexOf('>')) : target.split(/\s+/)[0]
    target = target.split('#')[0]
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue
    let resolved
    try { resolved = resolve(dirname(join(root, file)), decodeURI(target)) } catch { continue }
    if (!existsSync(resolved)) fail(file, 'broken relative link: ' + target)
  }
}

// 4. No local absolute paths, private names or credentials; .mjs parses; .json is valid.
const forbidden = [
  { name: 'local user path', pattern: /[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}(?![<*%${}\s\u0080-\uFFFF\\/])/i },
  { name: 'local workspace path', pattern: /[A-Za-z]:[\\/]{1,2}Codex-Workspace/i },
  { name: 'private backup directory', pattern: new RegExp('private' + '-backups\\b') },
  { name: 'private repository name', pattern: new RegExp('dsh-portable' + '-history\\b') },
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'API key', pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/ },
  { name: 'AWS access key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub token', pattern: /gh[posru]_[A-Za-z0-9]{30,}/ },
  { name: 'GitHub fine-grained token', pattern: /github_pat_[A-Za-z0-9_]{20,}/ },
]
for (const file of files) {
  if (!isText(file)) continue
  const content = readFileSync(join(root, file), 'utf8')
  for (const entry of forbidden) if (entry.pattern.test(content)) fail(file, 'forbidden ' + entry.name)
  if (file.endsWith('.mjs')) {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' })
    if (result.status !== 0) fail(file, 'node --check failed: ' + (result.stderr.trim().split('\n').at(-1) ?? ''))
  } else if (file.endsWith('.json')) {
    try { JSON.parse(content) } catch (error) { fail(file, 'invalid JSON: ' + error.message) }
  }
}

if (problems.length) {
  for (const problem of problems) console.error(problem)
  process.exitCode = 1
} else {
  const checked = files.filter(isText).length
  console.log('check: OK - portable ' + version + '; ' + checked + ' text files; version, lock sha256, ' + documents.size + ' documents and syntax verified')
}
