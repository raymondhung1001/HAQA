import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

const requiredPackages = [
  join(root, 'HAQA-API', 'node_modules', '@liaoliaots', 'nestjs-redis', 'dist', 'index.d.ts'),
  join(root, 'HAQA-API', 'node_modules', 'ioredis', 'built', 'index.js'),
]

const missing = requiredPackages.filter((path) => !existsSync(path))

if (missing.length > 0) {
  console.error('Missing workspace dependencies after install:')
  for (const path of missing) {
    console.error(`  - ${path.replace(root + '\\', '').replace(root + '/', '')}`)
  }
  console.error('\nRun "bun install" from the repo root (D:\\Workspace10\\HAQA), not from HAQA-API.')
  process.exit(1)
}
