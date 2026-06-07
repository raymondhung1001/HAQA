import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const devPorts = [3000, 3001]

function getPidsOnPort(port: number): number[] {
	if (process.platform === 'win32') {
		const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8' })
		if (result.status !== 0) return []

		const pids = new Set<number>()
		const portPattern = new RegExp(`:${port}\\s`)
		for (const line of result.stdout.split('\n')) {
			if (!line.includes('LISTENING') || !portPattern.test(line)) continue
			const pid = Number(line.trim().split(/\s+/).at(-1))
			if (Number.isFinite(pid) && pid > 0) pids.add(pid)
		}
		return [...pids]
	}

	const result = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
		encoding: 'utf8',
	})
	if (result.status !== 0) return []

	return result.stdout
		.split('\n')
		.map((value) => Number(value.trim()))
		.filter((pid) => Number.isFinite(pid) && pid > 0)
}

function killPort(port: number) {
	const pids = getPidsOnPort(port).filter((pid) => pid !== process.pid)
	for (const pid of pids) {
		if (process.platform === 'win32') {
			spawnSync('taskkill', ['/T', '/PID', String(pid), '/F'], {
				stdio: 'ignore',
			})
		} else {
			spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' })
		}
	}
	if (pids.length > 0) {
		console.log(`Freed port ${port} (killed PID${pids.length > 1 ? 's' : ''}: ${pids.join(', ')})`)
	}
}

for (const port of devPorts) {
	killPort(port)
}

function run(workspace: string, script: string): ChildProcess {
	return spawn(process.execPath, ['scripts/run-workspace.ts', workspace, script], {
		cwd: root,
		stdio: 'inherit',
	})
}

function killChild(child: ChildProcess) {
	if (child.killed || child.pid == null) return
	if (process.platform === 'win32') {
		spawnSync('taskkill', ['/T', '/PID', String(child.pid), '/F'], {
			stdio: 'ignore',
		})
	} else {
		child.kill('SIGTERM')
	}
}

const children = [
	run('haqa-api', 'start:dev'),
	run('haqa-app', 'dev'),
]

function shutdown(code = 0) {
	for (const child of children) {
		killChild(child)
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
