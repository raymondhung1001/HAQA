import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cwd: string, script: string): ChildProcess {
  return spawn('bun', ['run', script], {
    cwd: join(root, cwd),
    stdio: 'inherit',
    shell: true,
  })
}

const children = [
  run('HAQA-API', 'start:dev'),
  run('HAQA-APP', 'dev'),
]

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
  process.exit(code)
}

for (const child of children) {
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      shutdown(code)
    }
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
