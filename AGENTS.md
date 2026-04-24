# AGENTS.md — my-finance-app

This file is the single source of truth for AI coding agents working on this project. Read it first before making any changes.

---

## Project Overview

`my-finance-app` is a **personal financial management system** (Portuguese: *Sistema de Gestão Financeira*). It helps users track bank accounts, credit cards, transactions, investments, and financial goals. Key capabilities include:

- Dashboard with total balance, per-account balances, and spending trends
- Income/expense transaction CRUD with categories
- Recurring (fixed) transactions with day-margin windows, confirmation, and skipping
- File imports for bank/broker statements (CSV/OFX/XLSX)
- Market data tracking for stocks, FIIs, and crypto
- Financial goals with progress tracking

The codebase is a **pnpm workspace monorepo** with a NestJS backend and a Next.js frontend.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Monorepo** | pnpm workspaces | `10.25.0` |
| **Lint / Format** | Biome | `2.3.7` |
| **Backend** | NestJS | `^11.0.1` |
| **Backend language** | TypeScript | `5.7.3` |
| **ORM** | Prisma | `7.0.1` |
| **Database** | PostgreSQL | `16` |
| **Cache / Jobs** | Redis | `7` |
| **Auth** | JWT + Argon2 | — |
| **Frontend** | Next.js (App Router) | `16.0.8` |
| **Frontend UI** | React + Tailwind CSS v4 | React `19.2.1` |
| **Server state** | TanStack React Query | `^5.90.12` |
| **Client state** | Zustand | `^5.0.9` |

---

## Monorepo Structure

```
my-finance-app/
├── apps/
│   ├── backend/          # NestJS API
│   └── frontend/         # Next.js web app
├── docs/                 # Architecture & requirements docs
├── docker-compose.yml    # Postgres + Redis for local dev
├── biome.json            # Root Biome config (lint + format)
├── package.json          # Root workspace manifest
├── pnpm-workspace.yaml   # Workspace definition
└── AGENTS.md             # This file
```

The workspace currently has two apps (`apps/*`). The `packages/*` directory is reserved for future shared libraries but is empty right now.

---

## Build & Development Commands

### Root workspace

```bash
# Install all dependencies
pnpm install

# Start local infrastructure (Postgres + Redis)
docker compose up -d
```

### Backend (`apps/backend/`)

```bash
pnpm start:dev      # NestJS watch mode (default port 3001)
pnpm build          # nest build → dist/
pnpm start:prod     # node dist/main
pnpm lint           # biome check --write .
pnpm check          # biome check .
pnpm format         # biome format --write .
```

### Frontend (`apps/frontend/`)

```bash
pnpm dev            # Next.js dev server (default port 3000)
pnpm build          # next build
pnpm start          # next start
pnpm lint           # biome check
pnpm format         # biome format --write
```

### Prisma (backend)

```bash
# Generate Prisma Client after schema changes
npx prisma generate --config prisma.config.ts

# Run migrations
npx prisma migrate dev --config prisma.config.ts
```

> **Note:** Prisma 7 uses a `prisma.config.ts` file instead of a CLI `--schema` flag. The generated client is output to `prisma/generated/`.

---

## Code Style Guidelines

We use **Biome** for linting, formatting, and import organization. There is a root `biome.json` and a per-app override in `apps/frontend/biome.json`.

### Key rules

| Rule | Value |
|------|-------|
| Line width | `120` |
| Indent | `2` spaces |
| Quotes | `single` |
| Import type style | `useImportType: off` (do not force `import type`) |
| Organize imports | Enabled (`assist.actions.source.organizeImports: on`) |
| NestJS decorators | `unsafeParameterDecoratorsEnabled: true` |

### How to apply formatting

```bash
# Backend
pnpm --filter backend format

# Frontend
pnpm --filter frontend format
```

Always run `format` and `lint` before committing. Biome is configured with Git integration and respects `.gitignore`.

---

## Backend Architecture

### Framework & runtime

- **NestJS 11** with Express platform
- **TypeScript 5.7**, target `ES2023`, `module: commonjs`
- Global prefix: `/api/v1`
- CORS enabled for `http://localhost:3000`
- Global `ValidationPipe` with `whitelist: true, transform: true`
- Port: `process.env.PORT ?? 3001`

### Module organization

Each domain lives in its own NestJS module under `src/<feature>/`:

```
src/
├── accounts/
├── auth/
├── categories/
├── dashboard/
├── decorators/           # @Public(), @CurrentUser()
├── fixed-transactions/
├── jobs/                 # Cron jobs (e.g. fixed-transactions daily check)
├── prisma/               # Global PrismaModule + PrismaService
├── transactions/
├── users/
├── app.module.ts
└── main.ts
```

A module typically contains:
- `{feature}.module.ts`
- `{feature}.controller.ts`
- `{feature}.service.ts`
- `{feature}.dto.ts`
- `{feature}.service.spec.ts` (unit tests, co-located)

### Auth & security

- **JWT Bearer tokens** (`Authorization: Bearer <token>`)
- **Argon2** for password hashing
- **Global `AuthGuard`** registered in `AuthModule` via `APP_GUARD`
- **Public routes**: use the custom `@Public()` decorator to bypass auth
- **Current user**: use `@CurrentUser()` custom parameter decorator
- Services perform **ownership checks** (`userId` vs resource owner) and throw `ForbiddenException` on mismatch

### Database & ORM

- **Prisma 7** with custom output at `prisma/generated/`
- Uses `@prisma/adapter-pg` (`PrismaPg`) for direct PostgreSQL connection
- `PrismaService` extends `PrismaClient`, connects on `onModuleInit`
- `PrismaModule` is **global**
- All tables have a `userId` column for multi-tenancy readiness
- Primary keys are **UUIDs** (`@id @default(uuid())`)
- DB fields use `snake_case` (`@map`), Prisma model fields use `camelCase`
- Soft deletion via `isActive` boolean (not hard deletes)

### Environment variables (backend)

Required in `apps/backend/.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | HTTP server port (default `3001`) |

---

## Frontend Architecture

### Framework & runtime

- **Next.js 16** with App Router
- **React 19** with React Compiler enabled (`babel-plugin-react-compiler`)
- **TypeScript 5**
- Path alias: `@/*` → `./src/*`

### Directory structure

```
src/
├── app/
│   ├── (private)/        # Authenticated routes (dashboard, accounts, transactions)
│   ├── (public)/         # Unauthenticated routes (login, register)
│   ├── layout.tsx        # Root layout (Urbanist font + Providers)
│   ├── page.tsx          # Marketing landing page
│   └── providers.tsx     # QueryClientProvider
├── components/
│   ├── specific/         # Feature-specific components (dashboard panels, modals)
│   └── ui/               # Reusable primitives (button, icon, label, modal, sidebar)
├── features/             # Domain-driven modules
│   ├── accounts/
│   ├── auth/
│   ├── categories/
│   ├── dashboard/
│   ├── fixed-transactions/
│   └── transactions/
│       └── queries.ts + mutations.ts
├── shared/
│   ├── lib/
│   │   ├── api/          # HTTP client + typed API modules
│   │   ├── query/        # TanStack Query key factories
│   │   └── utils.ts
│   ├── stores/           # Zustand stores (auth-store.ts)
│   └── styles/
│       └── globals.css   # Tailwind v4 theme tokens
```

### State management

- **Server state**: TanStack React Query
  - `staleTime: 60 * 1000` (1 minute)
  - Query keys centralized in `src/shared/lib/query/keys.ts`
  - Mutations invalidate related keys on success
- **Client state**: Zustand
  - `auth-store.ts` holds `accessToken` and `user`
  - `persist` middleware syncs to `localStorage` under key `"finance-auth"`
- **HTTP client** (`src/shared/lib/api/http.ts`)
  - `fetch`-based wrapper
  - Auto-attaches `Bearer` token via `setTokenGetter`
  - Auto-clears auth and redirects on `401` via `setUnauthorizedCallback`

### Routing & layouts

| Route | File | Layout |
|-------|------|--------|
| `/` | `app/page.tsx` | Root |
| `/login` | `app/(public)/login/page.tsx` | Public (minimal) |
| `/register` | `app/(public)/register/page.tsx` | Public (minimal) |
| `/dashboard` | `app/(private)/dashboard/page.tsx` | Private (Sidebar) |
| `/accounts` | `app/(private)/accounts/page.tsx` | Private (Sidebar) |
| `/transactions` | `app/(private)/transactions/page.tsx` | Private (Sidebar) |

Auth guards are implemented **client-side** in page components (checking `accessToken` and redirecting).

### Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss`
- Dark theme defined in `globals.css` via `@theme` directive
- Core tokens: `layer00`, `layer01`, `layer02`, `primary`, `green`, `red`
- Font: Urbanist (weights 400, 500, 600)

### Environment variables (frontend)

Required in `apps/frontend/.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:3001`) |

---

## API Conventions

Read `docs/api-conventions.md` for the full specification. Summary:

- **Base path**: `/api/v1`
- **IDs**: UUID v4 strings
- **Dates**: ISO 8601 (`2025-11-25T14:30:00Z` or `2025-11-25`)
- **JSON fields**: `camelCase`
- **Resources**: plural English (`/accounts`, `/transactions`, `/fixed-transactions`)
- **HTTP methods**: `GET` list/one, `POST` create, `PATCH` partial update, `DELETE` remove
- **Pagination**: `?page=` (default 1), `?limit=` (default 20, max 100)
- **Error shape**:
  ```json
  {
    "statusCode": 400,
    "error": "VALIDATION_ERROR",
    "message": "...",
    "details": null,
    "timestamp": "2025-11-25T14:30:00Z",
    "path": "/api/v1/transactions"
  }
  ```

### Implemented modules

The backend currently implements: `auth`, `users`, `accounts`, `categories`, `transactions`, `fixed-transactions`, `dashboard`, and `jobs`.

Planned but not yet implemented: `credit-cards`, `investments`, `market-data`, `goals`, `imports`, `backup`.

---

## Testing Instructions

### Backend

Unit/integration tests are co-located next to source files (`*.spec.ts`). E2E tests live in `test/app.e2e-spec.ts`.

```bash
# Unit / integration tests
pnpm --filter backend test

# Watch mode
pnpm --filter backend test:watch

# Coverage
pnpm --filter backend test:cov

# E2E
pnpm --filter backend test:e2e
```

Testing stack: **Jest 30**, `ts-jest`, `supertest`, `@nestjs/testing`. Prisma is typically mocked with `jest.fn()` in unit tests.

### Frontend

**There are currently no frontend tests.** No test runner is configured in `apps/frontend/package.json`.

### Manual verification script

A PowerShell script `test_backend.ps1` at the repo root performs a quick end-to-end smoke test:
1. Register a test user
2. Login and get JWT
3. Create an account and category
4. Create a transaction and fixed transaction
5. Fetch the dashboard

Run it against a locally running backend:
```powershell
.\test_backend.ps1
```

---

## Database Migrations

Migrations are managed by Prisma and live in `apps/backend/prisma/migrations/`.

Current migrations:
- `20251125204546_init` — initial schema creation
- `20251210015148_optional_description` — makes `fixed_transactions.description` nullable

To create a new migration:
```bash
cd apps/backend
npx prisma migrate dev --name <description> --config prisma.config.ts
```

To generate the client after schema changes:
```bash
npx prisma generate --config prisma.config.ts
```

There is **no seed script** currently.

---

## Scheduled Jobs

The backend uses `@nestjs/schedule` for cron jobs.

- **`FixedTransactionsJob`** — runs daily at 3 AM. Scans active `FixedTransaction` records and auto-creates `FixedTransactionOccurrence` rows for the current month when the current day falls within `[referenceDay - marginDays, referenceDay + marginDays]`.

Future jobs (market data refresh, goal alerts) are planned but not implemented.

---

## Security Considerations

1. **Never commit `.env` files.** Both `apps/backend/.env` and `apps/frontend/.env.local` contain secrets and are excluded by `.gitignore`.
2. **JWT secret** must be strong and rotated in production.
3. **CORS** is currently locked to `http://localhost:3000` in `main.ts`. Update for production origins.
4. **Ownership checks** are done in services, but always verify authorization logic when adding new endpoints.
5. **Argon2** is used for password hashing — do not swap to a weaker algorithm.
6. **SQL injection** is mitigated by Prisma's query builder, but raw queries must be avoided or parameterized.
7. **Frontend auth** is client-side only (`localStorage`). XSS on the frontend could leak tokens.

---

## Deployment Targets (Documented)

- **Frontend**: Vercel
- **Backend**: Railway, Render, Fly.io, or Koyeb
- **Database**: Railway Postgres, Render Postgres, or Neon

These are noted in `docs/architecture.md` but are not yet configured (no CI/CD files exist in the repo).

---

## Development Workflow Tips

1. Run `docker compose up -d` before starting the backend to have Postgres and Redis available.
2. After pulling changes that touch `schema.prisma`, run `prisma generate` and `prisma migrate dev`.
3. Use `pnpm --filter <app> <script>` to run commands for a specific workspace package.
4. The frontend expects the backend to be on port `3001` and CORS-whitelisted.
5. Keep docs in `docs/` updated when architectural decisions change.
