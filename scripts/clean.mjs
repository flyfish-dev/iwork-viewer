import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

await Promise.all([
  rm(resolve('.release'), { force: true, recursive: true }),
  rm(resolve('packages/iwork-viewer/dist'), { force: true, recursive: true }),
  rm(resolve('packages/renderer-iwork/dist'), { force: true, recursive: true }),
])
