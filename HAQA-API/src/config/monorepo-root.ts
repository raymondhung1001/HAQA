import { join } from 'path';

/** Monorepo root (HAQA/), three levels above `dist/config/`. */
export const monorepoRoot = join(__dirname, '..', '..', '..');

export const monorepoEnvFiles = [
	join(monorepoRoot, '.env'),
	join(monorepoRoot, '.env.local'),
];
