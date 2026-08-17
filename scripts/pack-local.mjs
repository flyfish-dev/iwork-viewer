import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const output = resolve('.release/packages')
await rm(output, { force: true, recursive: true })
await mkdir(output, { recursive: true })

for (const directory of ['packages/iwork-viewer', 'packages/renderer-iwork']) {
  const result = spawnSync('pnpm', ['-C', directory, 'pack', '--pack-destination', output], {
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error(`Could not pack ${directory}.`)
}

const files = (await readdir(output)).filter(file => file.endsWith('.tgz')).sort()
if (files.length !== 2) throw new Error(`Expected two package tarballs, found ${files.length}.`)
const packages = []
for (const file of files) {
  const path = resolve(output, file)
  const bytes = await readFile(path)
  const listing = spawnSync('tar', ['-tzf', path], { encoding: 'utf8' })
  if (listing.status !== 0) throw new Error(`Could not inspect ${file}.`)
  const entries = listing.stdout.split(/\r?\n/).filter(Boolean)
  const forbidden = entries.filter(entry => (
    entry.endsWith('.tsbuildinfo')
    || entry.startsWith('package/src/')
    || entry.startsWith('package/test/')
    || entry.startsWith('package/scripts/')
  ))
  if (forbidden.length > 0) {
    throw new Error(`${file} contains development-only files: ${forbidden.join(', ')}`)
  }
  const required = file.startsWith('iwork-viewer-')
    ? ['package/dist/index.js', 'package/dist/index.d.ts', 'package/dist/iwork.worker.js', 'package/dist/iwork.parser.js']
    : ['package/dist/index.js', 'package/dist/index.d.ts', 'package/dist/parser.js']
  const missing = required.filter(entry => !entries.includes(entry))
  if (missing.length > 0) throw new Error(`${file} is missing publish files: ${missing.join(', ')}`)
  packages.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify({ packages }, null, 2)}\n`)
console.log(`[iwork-viewer] Packed ${packages.map(item => item.file).join(', ')}.`)
