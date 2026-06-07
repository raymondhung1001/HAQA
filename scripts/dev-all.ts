import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

function run(workspace: string, script: string): ChildProcess {
	return spawn('bun', ['scripts/run-workspace.ts', workspace, script], {
		cwd: root,
		stdio: 'inherit',
	})
}

const children = [
	run('haqa-api', 'start:dev'),
	run('haqa-app', 'dev'),
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
