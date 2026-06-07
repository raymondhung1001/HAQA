# HAQA

Monorepo for the HAQA test-flow platform. Uses [Bun workspaces](https://bun.com/docs/pm/workspaces) with **isolated installs** and a shared **dependency catalog**.

| Package | Stack | Dev URL |
|---------|-------|---------|
| `HAQA-API` | NestJS, TypeORM, PostgreSQL, Redis | http://localhost:3001/api |
| `HAQA-APP` | React, TanStack Start, Vite | http://localhost:3000 |
| `HAQA-DB` | PostgreSQL init SQL + Docker | port from `.env` (`DB_PORT`) |
| `HAQA-REDIS` | Redis config for Docker | port from `.env` (`REDIS_PORT`) |

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (see `packageManager` in root `package.json`)
- Docker (for PostgreSQL and Redis)

## Setup

1. **Install dependencies from the repo root only:**

   ```bash
   bun install
   ```

   Do not run `bun install` inside `HAQA-API` or `HAQA-APP`.

   **Windows:** If install fails building `sqlite3` (used only by `generate-entities`), skip native scripts:

   ```bash
   bun run install:skip-native
   ```

   **Windows symlink issues:** Isolated installs use symlinks. If `bun install` fails, enable [Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development) or set `linker = "hoisted"` in `bunfig.toml` as a fallback.

2. **Environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your secrets. The single root `.env` is loaded by both the API and the app.

3. **Infrastructure:**

   ```bash
   docker compose up -d
   ```

## Development

Start API and app together:

```bash
bun dev
```

Or run individually:

```bash
bun run dev:api
bun run dev:app
```

Root scripts call workspaces by package name (`haqa-api`, `haqa-app`) via `scripts/run-workspace.ts`, which runs each package in its own directory so isolated dependencies resolve correctly.

## Monorepo layout

- **Catalog** — shared versions (`typescript`, `zod`, `eslint`, etc.) live in root `package.json` → `workspaces.catalog`; workspaces reference them with `"catalog:"`.
- **Isolated linker** — each package only sees its own dependencies (`bunfig.toml` → `linker = "isolated"`).
- **Single lockfile** — only root `bun.lock` (never commit `HAQA-*/bun.lock`).

## Other scripts

| Command | Description |
|---------|-------------|
| `bun run build:all` | Build all workspaces |
| `bun run test` | Run app unit tests (Vitest) |
| `bun run lint` | Lint API |
| `bun run verify` | Check workspace dependencies are installed |
| `bun run install:skip-native` | Install without native build scripts (Windows) |

## Entity generation (optional)

Requires a running database and, on Windows, [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++** (for `sqlite3`):

```bash
bun scripts/run-workspace.ts haqa-api generate-entities
```
