# Project State — My Finance App

> **Last updated:** 2026-04-24 (post-tech-debt)  
> **Verified by:** automated test suite + manual build checks

---

## 1. Build & Test Health

| Check | Status |
|-------|--------|
| Backend unit tests (`pnpm test`) | ✅ 181 passed, 1 skipped, 13 suites |
| Backend E2E tests (`pnpm test:e2e`) | ✅ 151 passed, 13 suites |
| Frontend tests (`pnpm test`) | ✅ 10 passed, 5 suites |
| Backend build (`pnpm build`) | ✅ Clean |
| Backend lint (`pnpm check`) | ✅ Clean |
| Frontend TypeScript (`tsc --noEmit`) | ✅ Clean |
| Frontend build (`next build`) | ✅ Clean |

---

## 2. Backend — What Exists & Works

### 2.1 Fully Implemented Modules

| Module | Endpoints | Notes |
|--------|-----------|-------|
| **Auth** | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` | JWT + Argon2. `Public()` + `CurrentUser()` decorators working. |
| **Users** | `GET /users/me`, `PATCH /users/me`, `DELETE /users/me` | Restricted to current user only (`@CurrentUser()`). `passwordHash` never leaked in responses. |
| **Accounts** | `POST /accounts`, `GET /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id`, `DELETE /accounts/:id` | Balance calculated in-memory (`initialBalance` + transactions). Ownership enforced. |
| **Categories** | `POST /categories`, `GET /categories`, `GET /categories/:id`, `PATCH /categories/:id`, `DELETE /categories/:id` | Delete blocked if linked transactions/fixed-transactions exist (409). |
| **Transactions** | `POST /transactions`, `GET /transactions`, `GET /transactions/uncategorized`, `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id`, `GET /transactions/summary`, `GET /transactions/projection` | Filters: type, date range, accountId, categoryId. Supports `creditCardId` (mutually exclusive with `accountId`). Summary: income/expense/net by period. Projection: next month expense based on last 3 months average. Ownership enforced. |
| **Fixed Transactions** | `POST /fixed-transactions`, `GET /fixed-transactions`, `GET /fixed-transactions/:id`, `PATCH /fixed-transactions/:id`, `PATCH /fixed-transactions/:id/deactivate`, `DELETE /fixed-transactions/:id` | Occurrences system: confirm creates real Transaction, skip marks as SKIPPED. Delete removes transaction and its occurrences (cascata Prisma). |
| **Credit Cards** | `POST /credit-cards`, `GET /credit-cards`, `GET /credit-cards/:id`, `PATCH /credit-cards/:id`, `DELETE /credit-cards/:id` | Limit tracking with used/available amounts (current month expenses). Ownership enforced. |
| **Dashboard** | `GET /dashboard?referenceDate` | Returns: period, totals (balance + credit card totals + real trending vs prev month), accounts with balances, credit cards with usage, latest 5 transactions, fixed transactions, 12-month annual balance. |
| **Investments** | `POST /investments`, `GET /investments`, `GET /investments/:id`, `PATCH /investments/:id`, `DELETE /investments/:id` | CRUD with `investedAmount` validation (`quantity * buyPrice`), optional `marketAssetId` validation. Ownership enforced. |
| **Goals** | `POST /goals`, `GET /goals`, `GET /goals/:id`, `GET /goals/:id/progress`, `PATCH /goals/:id`, `DELETE /goals/:id` | CRUD with `progress` calculation (`currentAmount / targetAmount`), optional `relatedAccountId`/`relatedCategoryId` validation. `GET /goals/:id/progress` returns `{ goalId, name, targetAmount, currentAmount, progress, percentage, deadline }`. Ownership enforced. |
| **Market Data** | `POST /market-assets`, `GET /market-assets`, `GET /market-assets/:id`, `PATCH /market-assets/:id`, `DELETE /market-assets/:id` | CRUD with unique constraint (`symbol` + `exchange`), hybrid ownership (global assets `userId=null` visible to all, user assets editable only by owner). |
| **Imports** | `POST /imports/preview`, `POST /imports/confirm`, `GET /imports`, `GET /imports/:id` | File upload (CSV/XLSX/OFX) with parser factory + strategy pattern (Inter + generic bank). Preview with duplicate detection (externalId + signature). Confirm creates ImportedFile + Transactions. Ownership enforced. |
| **Backup** | `GET /backup/export`, `POST /backup/import` | Export: returns all user data as structured JSON. Import: validates structure, creates records with ID mapping (accounts → categories → creditCards → marketAssets → transactions → fixedTransactions → investments → goals → importedFiles). |
| **Jobs** | Cron `@3am` | Auto-creates pending occurrences for active fixed transactions within margin window. |

### 2.2 Schema Models Status

All 11 Prisma models have backend modules implemented.

### 2.3 Validation & Security

| Item | Status |
|------|--------|
| DTO validation (`class-validator`) | ✅ All DTOs decorated (auth, accounts, categories, transactions, fixed-transactions, users, credit-cards, investments, goals, market-assets, imports, backup) |
| Global `ValidationPipe` | ✅ Enabled in `main.ts` (`whitelist: true, transform: true`) |
| Global exception filter | ✅ `GlobalExceptionFilter` formats all errors as `{ statusCode, error, message, details?, timestamp, path }` |
| Swagger/OpenAPI | ✅ `@nestjs/swagger` configured at `/api/docs` with Bearer auth |
| JWT Guard | ✅ Global `APP_GUARD` with `@Public()` escape hatch |
| Ownership checks (`ForbiddenException`) | ✅ All services verify `userId` before read/write |
| Password hashing | ✅ Argon2 |
| Password hash leakage | ✅ Fixed — `findByEmail` omits hash; `findByEmailWithPassword` used only by auth |
| UsersController security | ✅ Fixed — endpoints now use `@CurrentUser()` (`/users/me`, `/users/me` PATCH/DELETE) instead of accepting any `:id` |

### 2.4 Known Backend Issues / Tech Debt

1. **Soft delete** — Not implemented; all deletes are hard deletes.
2. **Decimal handling** — Prisma returns `Decimal` for `value`; services mostly use `Number(t.value)` which works via `.valueOf()` but is implicit.
3. **Dashboard `allTransactions` N+1 concern** — `getOverview` fetches ALL user transactions just to slice 5 for `latestTransactions`. The `TransactionsService.findAllByUser` has no limit.
4. **Annual balance performance** — `calculateAnnualBalance` loops 12 months doing 12 separate DB queries. Could be one query with grouping.

---

## 3. Frontend — What Exists & Works

### 3.1 Pages & Routes

| Route | Status | Notes |
|-------|--------|-------|
| `/` (landing) | ✅ | App name, description, Login/Register CTAs |
| `/login` | ✅ | Functional, JWT stored in Zustand + localStorage |
| `/register` | ✅ | Functional |
| `/dashboard` | ✅ | Real data: balance, trending, accounts, credit cards, fixed transactions, recent transactions, annual balance chart |
| `/accounts` | ✅ | CRUD complete (create, edit, delete with confirmation) |
| `/credit-cards` | ✅ | CRUD complete with usage bars (create, edit, delete with confirmation) |
| `/transactions` | ✅ | List with filters (type, date range, category, account/credit card), category name resolution, delete with confirmation, edit. Supports account OR credit card as source. |
| `/categories` | ✅ | CRUD complete (create, edit, delete with confirmation) |
| `*` (not-found) | ✅ | Generic 404 |

### 3.2 Components

| Component | Status |
|-----------|--------|
| `Button`, `Icon`, `Label`, `Modal` | ✅ Complete design system |
| `Sidebar` / `SidebarItem` | ✅ Responsive (hidden on mobile, no hamburger yet). Includes Dashboard, Accounts, Credit Cards, Categories, Transactions. |
| `TopBar` | ✅ Now has logout button |
| `BalanceHero` | ✅ Shows totals + real trending + CTA buttons |
| `AccountsPanel` | ✅ Horizontal carousel, create modal trigger |
| `CreditCardsPanel` | ✅ Horizontal carousel with usage bars, aggregate totals, create modal trigger |
| `AnnualBalance` | ✅ Now renders real 12-month data |
| `FixedTransactionsPanel` | ✅ Now fetches occurrences + confirm/skip wired |
| `RecentTransactionsPanel` | ✅ |
| `CreateAccountModal` | ✅ |
| `EditAccountModal` | ✅ Works end-to-end |
| `CreateCreditCardModal` | ✅ |
| `EditCreditCardModal` | ✅ Works end-to-end |
| `CreateTransactionModal` | ✅ Supports account OR credit card as source |
| `EditTransactionModal` | ✅ Supports account OR credit card as source |
| `CreateCategoryModal` | ✅ |
| `EditCategoryModal` | ✅ Works end-to-end |
| `CreateCategoryModal` | ✅ |
| `EditCategoryModal` | ✅ Works end-to-end |

### 3.3 State & API Client

| Item | Status |
|------|--------|
| Zustand auth store (persisted) | ✅ |
| HTTP client (`fetch` wrapper) | ✅ With auth header injection + 401 redirect |
| React Query (queries + mutations) | ✅ All existing entities covered, including credit cards |

### 3.4 Known Frontend Issues / Tech Debt

1. **Mobile responsiveness** — Sidebar completely hidden on mobile (`hidden lg:block`) with no hamburger menu alternative.
2. **Landing page** — Functional but very basic; no screenshots or feature highlights.
3. **Fixed transactions panel** — Assumes each fixed transaction has an occurrence for the current month. If the cron job hasn't run or the occurrence doesn't exist, shows "Sem ocorrência".
4. **Annual balance month labels** — The `AnnualBalance` component uses fixed `Jan-Dez` labels, but the data is a sliding 12-month window. Labels don't match the actual months being displayed.
5. **Category filter on transactions page** — ✅ Implemented.
6. **Date range filter on transactions page** — ✅ Implemented.
7. **Account filter on transactions page** — ✅ Implemented (combined with credit cards as "Origem").
8. **No dedicated pages for:** Fixed Transactions, Investments, Goals, Imports, Settings.

---

## 4. Database (Prisma + PostgreSQL)

### 4.1 Migrations

| Migration | Description |
|-----------|-------------|
| `20251125204546_init` | Initial schema creation |
| `20251210015148_optional_description` | Made `description` optional on transactions |

### 4.2 Models Summary

11 models defined. All 11 have backend modules.

---

## 5. Testing

### 5.1 Backend Unit Tests (13 files, 181 tests)

| Service | Tests |
|---------|-------|
| `AuthService` | validateUser, login, register |
| `UsersService` | findById, findByEmail, findByEmailWithPassword, createUser, listUsers |
| `AccountsService` | CRUD, balance calculation, Decimal handling, ownership |
| `CategoriesService` | CRUD, ownership, delete dependency guard (1 skipped) |
| `TransactionsService` | CRUD, filters, uncategorized, summary, projection, ownership, credit card support |
| `DashboardService` | Aggregation, trending, annual balance, referenceDate, credit card metrics |
| `FixedTransactionsService` | CRUD, toggleActive, delete, ownership |
| `FixedTransactionsOccurrencesService` | create, list, confirm, skip, ownership |
| `InvestmentsService` | CRUD, investedAmount validation, marketAssetId validation, ownership |
| `GoalsService` | CRUD, progress calculation, relationship validation, ownership |
| `MarketAssetsService` | CRUD, unique constraint, hybrid ownership (global + user) |
| `ImportsService` | Parser factory, CSV/XLSX/OFX selection, strategy normalization, duplicate detection, preview, confirm, findAll, findById + ownership |
| `BackupService` | Export structure, all entity types, restore with ID mapping, null FK handling, validation |

### 5.2 Backend E2E Tests (13 files, 148 tests)

| File | Coverage |
|------|----------|
| `test/auth.e2e-spec.ts` | Register (201/400/409), Login (200/401/404), GET /me (200/401) |
| `test/accounts.e2e-spec.ts` | Create, List, Get, Update, Delete (all with auth + 403/404) |
| `test/credit-cards.e2e-spec.ts` | Create, List, Get, Update, Delete (all with auth + 403/404 + usage calculation) |
| `test/categories.e2e-spec.ts` | Create (incl. lowercase type validation), List, Get, Update, Delete (incl. 409 dependency guard) |
| `test/transactions.e2e-spec.ts` | Create (account + credit card), filters (type/date/category/account/credit card), Get, Update, Delete, Summary, Projection |
| `test/fixed-transactions.e2e-spec.ts` | Create, List, Get, Update, Deactivate, Delete, Occurrences (list + filter + confirm + skip) |
| `test/dashboard.e2e-spec.ts` | Root path `/dashboard`, rejects `/dashboard/overview`, accepts referenceDate |
| `test/investments.e2e-spec.ts` | Create, List, Get, Update, Delete (all with auth + 403/404 + investedAmount validation + marketAssetId validation) |
| `test/goals.e2e-spec.ts` | Create, List, Get, Update, Delete (all with auth + 403/404 + progress calculation + relationship validation) |
| `test/market-data.e2e-spec.ts` | Create, List, Get, Update, Delete (all with auth + 403/404/409 + unique constraint + hybrid ownership) |
| `test/imports.e2e-spec.ts` | Preview (CSV upload + duplicate detection), Confirm, List, Get (all with auth + 403/404 + unsupported file type) |
| `test/backup.e2e-spec.ts` | Export (structured JSON), Import (restore with validation), auth required |
| `test/app.e2e-spec.ts` | Root returns 401 (auth guard active) |

### 5.3 Test Infrastructure

- `jest` + `ts-jest` configured
- `moduleNameMapper` resolves `src/` and `prisma/generated/client`
- Tests mock `PrismaService` — no real DB needed
- E2E tests mock Prisma at module level

### 5.4 Frontend Tests (5 files, 10 tests)

| File | Coverage |
|------|----------|
| `accounts.api.test.ts` | Payload contract: lowercase types (`checking`, `savings`, `investment`, `cash`, `other`) |
| `categories.api.test.ts` | Payload contract: lowercase types (`expense`, `income`, `both`) |
| `dashboard.api.test.ts` | Endpoint contract: calls `/dashboard`, not `/dashboard/overview` |
| `create-account-modal.test.tsx` | Component: submits lowercase `type` in payload |
| `create-category-modal.test.tsx` | Component: submits lowercase `type` in payload |

### 5.5 What's NOT Tested

- Controller-level unit tests (only service + E2E)
- JobsModule / cron behavior
- File upload edge cases (OFX, XLSX real-world files)
- UsersController E2E tests (no `test/users.e2e-spec.ts`)
- Edge cases: concurrent updates, race conditions

---

## 6. What's Missing (Roadmap)

### 6.1 Backend Modules (Prisma models exist)

- [x] **InvestmentsModule** — CRUD + market data integration
- [x] **GoalsModule** — CRUD + progress calculation
- [x] **MarketDataModule** — CRUD + unique constraint + hybrid ownership
- [x] **ImportsModule** — File upload + parse + preview + confirm
- [x] **BackupModule** — Export/import JSON

### 6.2 Backend Endpoints (documented but missing)

- [x] `GET /transactions/summary` — Total spent by period
- [x] `GET /transactions/projection` — Spend projection
- [x] `DELETE /fixed-transactions/:id`
- [x] `GET /goals/:id/progress` — Progress tracking endpoint
- [ ] `PATCH /fixed-transactions/:id/status` (distinct from deactivate)
- [x] All `/investments/**`
- [x] All `/goals/**`
- [x] All `/market-data/**`
- [x] All `/imports/**`
- [x] All `/backup/**`

### 6.3 Frontend Pages

- [x] `/categories` — Dedicated management page (backend + frontend ready)
- [ ] `/fixed-transactions` — Full CRUD + occurrence history
- [ ] `/investments` — Portfolio view
- [ ] `/goals` — Progress tracking
- [ ] `/imports` — Upload + preview (backend ready, frontend page needed)
- [ ] `/backup` — Export/import (backend ready, frontend page needed)
- [ ] `/settings` — User profile, preferences

### 6.4 DevOps / Tooling

- [ ] Docker Compose for full stack (only DB + Redis exist)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Environment-based config (prod vs dev)
- [ ] Rate limiting
- [ ] API documentation (Swagger/OpenAPI)

---

## 7. File Inventory (Key Files)

### Backend
```
apps/backend/src/
  auth/           ✅ service, controller, guard, dto, spec
  users/          ✅ service, controller, dto, spec
  accounts/       ✅ service, controller, dto, spec
  categories/     ✅ service, controller, dto, spec
  transactions/   ✅ service, controller, dto, spec
  fixed-transactions/  ✅ service, occurrences service, controller, dto, spec
  credit-cards/   ✅ service, controller, dto, spec
  dashboard/      ✅ service, controller, spec
  investments/    ✅ service, controller, dto, spec
  goals/          ✅ service, controller, dto, spec
  market-data/    ✅ service, controller, dto, spec
  imports/        ✅ service, controller, dto, spec, parsers, strategies
  backup/         ✅ service, controller, dto, spec
  jobs/           ✅ cron job for occurrences
  app.controller.ts / app.service.ts  ✅ root endpoint
  prisma/         ✅ service, schema, 2 migrations, seed script
  filters/        ✅ global exception filter
  decorators/     ✅ @Public, @CurrentUser
```

### Frontend
```
apps/frontend/src/
  app/            ✅ pages: /, /login, /register, /dashboard, /accounts, /credit-cards, /categories, /transactions
  components/ui/  ✅ Button, Icon, Label, Modal, Sidebar
  components/specific/dashboard/  ✅ all panels + topbar (incl. CreditCardsPanel)
  components/specific/modals/     ✅ create/edit for accounts, credit cards & transactions
  features/*/     ✅ queries + mutations for all entities
  shared/lib/api/ ✅ HTTP client + entity APIs (incl. credit-cards)
  shared/lib/queries/ ✅ credit-cards queries + mutations
  shared/stores/  ✅ auth-store (Zustand + persist)
```

---

## 8. Quick Commands

```bash
# Backend
cd apps/backend
pnpm test              # unit tests
pnpm test:e2e          # E2E tests
pnpm test:cov          # coverage
pnpm build             # NestJS build
pnpm start:dev         # dev server on :3001

# Frontend
cd apps/frontend
pnpm dev               # Next.js dev on :3000
npx tsc --noEmit       # type check
npx next build         # production build

# Database (from root)
docker-compose up -d   # PostgreSQL + Redis

# Seed (from apps/backend)
npx ts-node prisma/seed.ts   # Creates demo user with sample data
```

---

## 9. Definition of Done for Current Phase

Backend MVP is **complete**. All Prisma models have modules, all endpoints are tested.
- [x] All critical fixes resolved (validation, auth, ownership, UsersController security)
- [x] All high-priority fixes resolved (dashboard data, type safety, standard error model)
- [x] Test suite green (backend unit + E2E + frontend)
- [x] Both frontend and backend build cleanly
- [x] All backend modules implemented (Auth, Users, Accounts, Categories, Transactions, FixedTransactions, CreditCards, Dashboard, Investments, Goals, MarketData, Imports, Backup, Jobs)
- [x] Frontend test suite configured (Jest + React Testing Library)
- [x] Prisma seed script for development
- [x] Swagger/OpenAPI docs
- [x] Pagination on list endpoints
- [ ] Optional: Soft delete support
