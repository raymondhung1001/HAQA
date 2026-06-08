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

const env = { ...process.env }
if (workspace === 'haqa-app') {
	// The root .env uses PORT for HAQA-API; keep it from steering the app dev server.
	env.PORT = '3000'
}

const result = spawnSync(process.execPath, ['run', `--cwd=${directory}`, ...scriptArgs], {
	cwd: root,
	env,
	stdio: 'inherit',
})

process.exit(result.status ?? 1)
