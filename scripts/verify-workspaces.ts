import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

type RequiredPackage = {
	label: string
	candidates: string[]
}

function workspacePaths(
	workspace: string,
	...segments: string[]
): string[] {
	const base = join(root, workspace)
	return [
		join(base, 'node_modules', ...segments),
		join(root, 'node_modules', ...segments),
	]
}

const requiredPackages: RequiredPackage[] = [
	{
		label: '@liaoliaots/nestjs-redis (haqa-api)',
		candidates: workspacePaths(
			'HAQA-API',
			'@liaoliaots',
			'nestjs-redis',
			'dist',
			'index.d.ts',
		),
	},
	{
		label: 'ioredis (haqa-api)',
		candidates: workspacePaths('HAQA-API', 'ioredis', 'built', 'index.js'),
	},
	{
		label: '@nestjs/cli / nest (haqa-api)',
		candidates: [
			...workspacePaths('HAQA-API', '.bin', 'nest.exe'),
			...workspacePaths('HAQA-API', '.bin', 'nest'),
		],
	},
	{
		label: 'vite (haqa-app)',
		candidates: [
			...workspacePaths('HAQA-APP', '.bin', 'vite.exe'),
			...workspacePaths('HAQA-APP', '.bin', 'vite'),
		],
	},
]

const missing = requiredPackages.filter(
	({ candidates }) => !candidates.some((path) => existsSync(path)),
)

if (missing.length > 0) {
	console.error('Missing workspace dependencies after install:')
	for (const { label } of missing) {
		console.error(`  - ${label}`)
	}
	console.error(
		'\nRun "bun install" from the repo root, not from HAQA-API or HAQA-APP.',
	)
	console.error(
		'On Windows, if install fails on sqlite3, run: bun run install:skip-native',
	)
	process.exit(1)
}
