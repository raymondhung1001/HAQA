import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

const workspaces: Record<string, string> = {
	'haqa-api': 'HAQA-API',
	'haqa-app': 'HAQA-APP',
}

const [workspace, ...scriptArgs] = process.argv.slice(2)

if (!workspace || scriptArgs.length === 0) {
	console.error('Usage: bun scripts/run-workspace.ts <workspace> <script> [args...]')
	console.error('Workspaces:', Object.keys(workspaces).join(', '))
	process.exit(1)
}

const directory = workspaces[workspace]
if (!directory) {
	console.error(`Unknown workspace "${workspace}".`)
	console.error('Known workspaces:', Object.keys(workspaces).join(', '))
	process.exit(1)
}

const result = spawnSync('bun', ['run', `--cwd=${directory}`, ...scriptArgs], {
	cwd: root,
	stdio: 'inherit',
})

process.exit(result.status ?? 1)
