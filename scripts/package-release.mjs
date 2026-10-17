// Package only committed source; never personal runtime data.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
execFileSync('git', ['diff', '--exit-code', 'HEAD'], { cwd: root, stdio: 'inherit' })
const manifest = JSON.parse(readFileSync(join(root, 'scripts/manifest.json')))
const version = manifest.portableVersion, base = 'deepseek-harness-portable-' + version
const out = join(root, 'dist')
mkdirSync(out, { recursive: true })
const checksums = []
for (const format of ['zip', 'tar.gz']) {
  const file = base + '.' + format
  execFileSync('git', ['archive', '--format=' + format, '--output=' + join(out, file), 'HEAD'], { cwd: root })
  const hash = createHash('sha256').update(readFileSync(join(out, file))).digest('hex')
  checksums.push(hash + '  ' + file)
  if (format === 'tar.gz') manifest.release.archive = {
    url: 'https://github.com/' + manifest.release.repository + '/releases/download/v' + version + '/' + file,
    sha256: hash,
  }
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(join(out, 'checksums.txt'), checksums.join('\n') + '\n')
console.log('Release files: ' + out)
