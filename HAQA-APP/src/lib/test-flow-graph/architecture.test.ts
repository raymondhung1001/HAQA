import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const GRAPH_LIB_ROOT = path.resolve(
  process.cwd(),
  'src/lib/test-flow-graph',
)

const collectTypeScriptFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath))
      continue
    }

    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('test-flow graph architecture boundaries', () => {
  it('does not import components layer from graph domain modules', () => {
    const files = collectTypeScriptFiles(GRAPH_LIB_ROOT)
    const offenders: string[] = []

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      if (source.includes(`@/components/`)) {
        offenders.push(path.relative(process.cwd(), file))
      }
    }

    expect(offenders).toEqual([])
  })
})
