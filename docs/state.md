# Project State — My Finance App

> **Last updated:** 2026-04-24  
> **Verified by:** automated test suite + manual build checks

---

## 1. Build & Test Health

| Check | Status |
|-------|--------|
| Backend unit tests (`pnpm test`) | ✅ 93 passed, 1 skipped, 8 suites |
| Backend E2E tests (`pnpm test:e2e`) | ✅ 29 passed, 4 suites |
| Backend build (`pnpm build`) | ✅ Clean |
| Frontend TypeScript (`tsc --noEmit`) | ✅ Clean |
| Frontend build (`next build`) | ✅ Clean |

---

## 2. Backend — What Exists & Works

### 2.1 Fully Implemented Modules

| Module | Endpoints | Notes |
|--------|-----------|-------|
| **Auth** | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` | JWT + Argon2. `Public()` + `CurrentUser()` decorators working. |
| **Users** | `GET /users`, `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id` | Added during fixes. `passwordHash` never leaked in responses. |
| **Accounts** | `POST /accounts`, `GET /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id`, `DELETE /accounts/:id` | Balance calculated in-memory (`initialBalance` + transactions). Ownership enforced. |
| **Categories** | `POST /categories`, `GET /categories`, `GET /categories/:id`, `PATCH /categories/:id`, `DELETE /categories/:id` | Delete blocked if linked transactions/fixed-transactions exist (409). |
| **Transactions** | `POST /transactions`, `GET /transactions`, `GET /transactions/uncategorized`, `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id` | Filters: type, date range, accountId, categoryId. Supports `creditCardId` (mutually exclusive with `accountId`). Ownership enforced. |
| **Fixed Transactions** | `POST /fixed-transactions`, `GET /fixed-transactions`, `GET /fixed-transactions/:id`, `PATCH /fixed-transactions/:id`, `PATCH /fixed-transactions/:id/deactivate` | Occurrences system: confirm creates real Transaction, skip marks as SKIPPED. |
| **Credit Cards** | `POST /credit-cards`, `GET /credit-cards`, `GET /credit-cards/:id`, `PATCH /credit-cards/:id`, `DELETE /credit-cards/:id` | Limit tracking with used/available amounts (current month expenses). Ownership enforced. |
| **Dashboard** | `GET /dashboard?referenceDate` | Returns: period, totals (balance + credit card totals + real trending vs prev month), accounts with balances, credit cards with usage, latest 5 transactions, fixed transactions, 12-month annual balance. |
| **Jobs** | Cron `@3am` | Auto-creates pending occurrences for active fixed transactions within margin window. |

### 2.2 Schema Models Without Backend Modules

These exist in `prisma/schema.prisma` but have **no controller/service**:

| Model | Status |
|-------|--------|
| `Investment` | ❌ Not implemented |
| `MarketAsset` | ❌ Not implemented |
| `Goal` | ❌ Not implemented |
| `ImportedFile` | ❌ Not implemented |

### 2.3 Validation & Security

| Item | Status |
|------|--------|
| DTO validation (`class-validator`) | ✅ All DTOs decorated (auth, accounts, categories, transactions, fixed-transactions, users, credit-cards) |
| Global `ValidationPipe` | ✅ Enabled in `main.ts` (`whitelist: true, transform: true`) |
| JWT Guard | ✅ Global `APP_GUARD` with `@Public()` escape hatch |
| Ownership checks (`ForbiddenException`) | ✅ All services verify `userId` before read/write |
| Password hashing | ✅ Argon2 |
| Password hash leakage | ✅ Fixed — `findByEmail` omits hash; `findByEmailWithPassword` used only by auth |

### 2.4 Known Backend Issues / Tech Debt

1. **Pagination** — Documented in API conventions (`page` + `limit` + `meta`) but not implemented in any endpoint.
2. **Standard error model** — Documented structure (`statusCode`, `error`, `message`, `details`, `timestamp`, `path`) but no global exception filter enforces it. NestJS default errors don't match this shape.
3. **Soft delete** — Not implemented; all deletes are hard deletes.
4. **Decimal handling** — Prisma returns `Decimal` for `value`; services mostly use `Number(t.value)` which works via `.valueOf()` but is implicit.
5. **Dashboard `allTransactions` N+1 concern** — `getOverview` fetches ALL user transactions just to slice 5 for `latestTransactions`. The `TransactionsService.findAllByUser` has no limit.
6. **Annual balance performance** — `calculateAnnualBalance` loops 12 months doing 12 separate DB queries. Could be one query with grouping.
7. **UsersController security** — Endpoints accept any `:id`, not restricted to `@CurrentUser()`. In a multi-user system this is a hole.
8. **No seed script** — Database must be populated manually or via API calls.

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
| `/transactions` | ✅ | List with filters (type), category name resolution, delete with confirmation, edit. Supports account OR credit card as source. |
| `*` (not-found) | ✅ | Generic 404 |

### 3.2 Components

| Component | Status |
|-----------|--------|
| `Button`, `Icon`, `Label`, `Modal` | ✅ Complete design system |
| `Sidebar` / `SidebarItem` | ✅ Responsive (hidden on mobile, no hamburger yet). Includes Dashboard, Accounts, Credit Cards, Transactions. |
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
5. **Category filter on transactions page** — Not implemented (only type filter exists).
6. **Date range filter on transactions page** — Not implemented.
7. **Account filter on transactions page** — Not implemented.
8. **No dedicated pages for:** Categories, Fixed Transactions, Investments, Goals, Imports, Settings.

---

## 4. Database (Prisma + PostgreSQL)

### 4.1 Migrations

| Migration | Description |
|-----------|-------------|
| `20251125204546_init` | Initial schema creation |
| `20251210015148_optional_description` | Made `description` optional on transactions |

### 4.2 Models Summary

11 models defined. 7 have backend modules. 4 are schema-only.

---

## 5. Testing

### 5.1 Backend Unit Tests (8 files, 94 tests)

| Service | Tests |
|---------|-------|
| `AuthService` | validateUser, login, register |
| `UsersService` | findById, findByEmail, findByEmailWithPassword, createUser, listUsers |
| `AccountsService` | CRUD, balance calculation, Decimal handling, ownership |
| `CategoriesService` | CRUD, ownership, delete dependency guard (1 skipped) |
| `TransactionsService` | CRUD, filters, uncategorized, ownership, credit card support |
| `DashboardService` | Aggregation, trending, annual balance, referenceDate, credit card metrics |
| `FixedTransactionsService` | CRUD, toggleActive, ownership |
| `FixedTransactionsOccurrencesService` | create, list, confirm, skip, ownership |

### 5.2 Backend E2E Tests (4 files, 29 tests)

| File | Coverage |
|------|----------|
| `test/auth.e2e-spec.ts` | Register (201/400/409), Login (200/401/404), GET /me (200/401) |
| `test/accounts.e2e-spec.ts` | Create, List, Get, Update, Delete (all with auth + 403/404) |
| `test/credit-cards.e2e-spec.ts` | Create, List, Get, Update, Delete (all with auth + 403/404 + usage calculation) |
| `test/app.e2e-spec.ts` | Root returns 401 (auth guard active) |

### 5.3 Test Infrastructure

- `jest` + `ts-jest` configured
- `moduleNameMapper` resolves `src/` and `prisma/generated/client`
- Tests mock `PrismaService` — no real DB needed
- E2E tests mock Prisma at module level

### 5.4 What's NOT Tested

- Frontend tests (none exist)
- Controller-level tests (only service + E2E)
- JobsModule / cron behavior
- File upload / import flows
- Edge cases: concurrent updates, race conditions

---

## 6. What's Missing (Roadmap)

### 6.1 Backend Modules (Prisma models exist)

- [ ] **InvestmentsModule** — CRUD + market data integration
- [ ] **MarketDataModule** — External API integration (prices)
- [ ] **GoalsModule** — CRUD + progress calculation
- [ ] **ImportsModule** — File upload + parse + preview + confirm
- [ ] **BackupModule** — Export/import JSON

### 6.2 Backend Endpoints (documented but missing)

- [ ] `GET /transactions/summary` — Total spent by period
- [ ] `GET /transactions/projection` — Spend projection
- [ ] `DELETE /fixed-transactions/:id`
- [ ] `PATCH /fixed-transactions/:id/status` (distinct from deactivate)
- [ ] All `/investments/**`
- [ ] All `/goals/**`
- [ ] All `/market-data/**`
- [ ] All `/imports/**`
- [ ] All `/backup/**`

### 6.3 Frontend Pages

- [ ] `/categories` — Dedicated management page
- [ ] `/fixed-transactions` — Full CRUD + occurrence history
- [ ] `/investments` — Portfolio view
- [ ] `/goals` — Progress tracking
- [ ] `/imports` — Upload + preview
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
  jobs/           ✅ cron job for occurrences
  prisma/         ✅ service, schema, 2 migrations
  decorators/     ✅ @Public, @CurrentUser
```

### Frontend
```
apps/frontend/src/
  app/            ✅ pages: /, /login, /register, /dashboard, /accounts, /credit-cards, /transactions
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
```

---

## 9. Definition of Done for Next Phase

Before building **Investments** (or any new module):
- [x] All critical fixes resolved (validation, auth, ownership)
- [x] All high-priority fixes resolved (dashboard data, type safety)
- [x] Test suite green (backend unit + E2E)
- [x] Both frontend and backend build cleanly
- [x] Credit Cards feature fully implemented (backend + frontend)
- [ ] Optional but recommended: add Swagger/OpenAPI docs
- [ ] Optional but recommended: add at least one frontend component test
