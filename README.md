# My Finance App

Gerenciador financeiro pessoal em pt-BR, organizado como monorepo pnpm. A V1 reúne uma API NestJS/Prisma, um frontend Next.js e contratos TypeScript compartilhados sobre PostgreSQL 16.

O código da V1 está presente no worktree, mas uma versão só deve ser tratada como liberável depois da execução dos gates descritos em [Verificação](#verificação). Este documento não presume que esses comandos passaram no ambiente atual.

## Escopo da V1

- cadastro, login, renovação e encerramento de sessão;
- perfil, troca de senha e exclusão confirmada da conta;
- contas, cartões e categorias, incluindo arquivamento e restauração;
- receitas e despesas paginadas, com filtros, resumo, projeção e fila sem categoria;
- dashboard por semana, mês, ano ou intervalo personalizado, comparado ao período anterior;
- saldo em caixa separado de contas do tipo investimento e da carteira manual;
- uso de cartão calculado no ciclo aberto segundo o dia de fechamento;
- modelos mensais de lançamentos recorrentes, ocorrências, confirmação e ação de ignorar;
- investimentos e catálogo de ativos preenchidos manualmente, por custo de aquisição;
- metas cujo progresso é informado manualmente;
- importação CSV, OFX e XLSX nos layouts Banco Inter e genérico, com prévia persistida;
- backup JSON versionado, com restauração nos modos `replace` e `merge`.

Rotas web autenticadas: `/dashboard`, `/accounts`, `/credit-cards`, `/categories`, `/transactions`, `/transactions/uncategorized`, `/fixed-transactions`, `/investments`, `/goals`, `/imports`, `/backup` e `/settings`.

Não fazem parte da V1: cotações ao vivo, integração direta com bancos ou corretoras, categorização por ML, alertas externos, recomendação ou otimização de carteira, modo offline e backup em nuvem. A lista de possíveis evoluções está em [`docs/backlog.md`](docs/backlog.md).

## Stack e requisitos

| Componente | Versão ou escolha |
|---|---|
| Runtime | Node.js 22 |
| Workspace | pnpm 10 (`packageManager: pnpm@10.25.0`) |
| API | NestJS 11, TypeScript, Prisma 7 |
| Web | Next.js 16, React 19, Tailwind CSS 4, TanStack Query |
| Banco | PostgreSQL 16 |
| Qualidade | Biome, Jest, Testing Library, Playwright |

Docker é opcional para desenvolvimento. As suítes que precisam de banco podem iniciar um PostgreSQL 16 descartável com `embedded-postgres`.

## Instalação local

```bash
corepack enable
corepack prepare pnpm@10.25.0 --activate
pnpm install --frozen-lockfile
```

Copie os exemplos sem versionar os arquivos preenchidos:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
```

Gere um segredo forte para assinar os access tokens:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Preencha `JWT_SECRET`, suba o banco e prepare o schema:

```bash
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- frontend: <http://localhost:3000>
- API: <http://localhost:3001/api/v1>
- Swagger em desenvolvimento: <http://localhost:3001/api/v1/docs>
- liveness: <http://localhost:3001/health/live>
- readiness: <http://localhost:3001/health/ready>

O seed é opcional e cria dados de demonstração. Consulte o próprio script antes de usá-lo em qualquer banco compartilhado.

## Configuração

O backend valida a configuração ao iniciar e não imprime valores secretos nos erros.

| Variável | Padrão | Uso |
|---|---:|---|
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `PORT` | `3001` | porta da API |
| `DATABASE_URL` | — | URL PostgreSQL obrigatória |
| `JWT_SECRET` | — | assinatura do access token; mínimo de 32 caracteres |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | duração do access token |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` | duração da sessão renovável |
| `CORS_ORIGINS` | `http://localhost:3000` | origens exatas separadas por vírgula |
| `APP_TIMEZONE` | `America/Sao_Paulo` | datas de referência e job de recorrências |
| `COOKIE_DOMAIN` | vazio | vazio cria cookie host-only |
| `COOKIE_SECURE` | `false` | deve ser `true` em produção |
| `COOKIE_SAMESITE` | `lax` | use `none` apenas com HTTPS e cookie seguro |
| `MAX_UPLOAD_BYTES` | `5242880` | limite de arquivo de importação |
| `MAX_IMPORT_ROWS` | `5000` | limite de linhas por importação |
| `IMPORT_BATCH_TTL_MINUTES` | `60` | validade da prévia |
| `MAX_BACKUP_BYTES` | `20971520` | limite do payload de restauração |
| `ENABLE_CRON` | `true` | geração agendada de ocorrências |
| `ENABLE_SWAGGER` | `true` | publicação da interface Swagger |

No frontend, `NEXT_PUBLIC_API_URL` deve conter a base completa, incluindo `/api/v1`. Ela é incorporada no build do Next.js.

## Comandos

```bash
pnpm dev                 # API e frontend em paralelo
pnpm dev:backend         # API com watch
pnpm dev:frontend        # Next.js em desenvolvimento
pnpm db:generate         # gera o cliente Prisma não versionado
pnpm db:migrate          # prisma migrate deploy
pnpm db:migrate:dev      # fluxo de criação de migration local
pnpm db:seed             # dados de demonstração
pnpm build               # backend e frontend
pnpm start               # artefato de produção da API
```

`apps/backend/src/generated` e os diretórios `dist`, `.next`, cobertura e relatórios são artefatos; não devem ser versionados.

## Verificação

Execute os gates a partir da raiz. Eles são requisitos de aceite, não resultados registrados neste README:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:integration
pnpm test:migration:upgrade
pnpm build
pnpm test:smoke
pnpm test:browser
pnpm audit --audit-level high
```

`pnpm verify:all` executa essa cadeia completa (depois de `pnpm install` e `pnpm db:generate`); `pnpm verify` é um alias para ela.

As suítes têm papéis distintos:

- `pnpm test`: unitários do backend e Jest/Testing Library no frontend;
- `pnpm test:e2e`: contrato HTTP da API com Prisma substituído por mocks;
- `pnpm test:integration`: API e migrations contra PostgreSQL real;
- `pnpm test:migration:upgrade`: upgrade pré-V1 inconsistente em PostgreSQL 16 descartável;
- `pnpm test:smoke`: inicia o artefato backend já compilado em ambiente de produção e banco descartável;
- `pnpm test:browser`: jornadas completas com Playwright.

Sem `TEST_DATABASE_URL`, integração e browser usam PostgreSQL descartável. Ao fornecer uma URL, o nome do banco precisa terminar em `_test`, `_ci` ou `_e2e`; o bloqueio só pode ser ignorado conscientemente com `ALLOW_DESTRUCTIVE_TEST_DB=true`.

O workflow em `.github/workflows/ci.yml` separa análise estática, testes unitários/HTTP, migrations e integração, build/smoke, browser e auditoria. A existência do workflow não substitui verificar o resultado da execução correspondente.

## Banco e migrations

Há duas migrations históricas e a migration V1 `20260903120000_v1_invariants`. Em instalações novas, use sempre `pnpm db:migrate`. O caminho de upgrade pré-V1 pode ser exercitado de forma autocontida com:

```bash
pnpm test:migration:upgrade
```

Para usar um PostgreSQL externo descartável, defina
`MIGRATION_TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/finance_upgrade_test`.

Nunca execute migrations de teste ou restauração destrutiva contra um banco desconhecido. Em produção, faça backup do PostgreSQL antes do deploy; não existe fluxo automático de `migrate down`.

## Docker

```bash
pnpm db:up
docker compose --profile full up --build
```

O primeiro comando sobe somente PostgreSQL. O perfil `full` sobe banco, backend e frontend e foi configurado como stack local: API em `NODE_ENV=development` e cookies não seguros sobre HTTP. Isso não é configuração de produção.

Para produção, use HTTPS ponta a ponta, `NODE_ENV=production`, `COOKIE_SECURE=true`, origens CORS explícitas e um `JWT_SECRET` externo. A imagem do backend aplica `prisma migrate deploy` antes do start; os healthchecks consultam a readiness real do banco.

## Contratos e invariantes

`packages/contracts` é a fonte compartilhada de rotas, enums, tipos de recursos, paginação, datas, dinheiro e erros. O backend acrescenta DTOs de validação/Swagger; o frontend consome os mesmos tipos.

- coleções retornam `{ data, meta }`, página baseada em 1, padrão 20 e máximo 100;
- datas financeiras são strings civis `YYYY-MM-DD` e colunas PostgreSQL `DATE`;
- timestamps ISO servem apenas para auditoria;
- dinheiro sai como número JSON com duas casas; quantidades aceitam até oito;
- uma transação ou recorrência usa exatamente uma origem: conta XOR cartão;
- recursos arquivados ficam no histórico, mas saem dos seletores ativos;
- acesso a recurso de outro usuário responde 404, evitando enumeração;
- erros usam `{ statusCode, error, message, details?, timestamp, path, requestId }`.

Mais detalhes: [arquitetura](docs/architecture.md), [convenções da API](docs/api-conventions.md), [endpoints](docs/api-v1-endpoints.md) e [modelo de dados](docs/data-model.md).

## Sessão e segurança

O access token é um JWT curto mantido somente em memória. O refresh token é um valor opaco aleatório de 256 bits, enviado em cookie `HttpOnly` e persistido apenas como hash SHA-256 com família, expiração, revogação e sucessor.

Cada refresh rotaciona o token dentro de uma transação. Reuso conhecido fora da janela de concorrência revoga apenas a família afetada; token desconhecido não identifica nem altera sessões. Uma corrida legítima de até cinco segundos devolve 409 ao perdedor. O frontend coordena abas com Web Locks quando disponível e possui um único retry curto no fallback.

Antes de `POST /auth/refresh`, o frontend chama `GET /auth/csrf` e envia o valor retornado em `X-CSRF-Token`; ele não lê `document.cookie`. Logout, 401 terminal e troca de usuário descartam access token e cache privado.

## Antes de publicar

- execute todos os gates e registre seus resultados;
- confirme duas builds consecutivas do backend e a presença de `apps/backend/dist/main.js`;
- execute `pnpm test:smoke`; para diagnóstico manual, inicie `start:prod` e rode `node scripts/smoke.mjs`;
- valide `GET /health/ready`: 200 com banco disponível e 503 sem banco;
- valide o stack Docker e seus healthchecks no ambiente-alvo;
- aplique migrations antes de receber tráfego;
- mantenha Swagger desativado se a documentação pública não for desejada;
- não faça push ou deploy a partir de uma máquina com mudanças locais não revisadas.

## Documentação

- [`docs/architecture.md`](docs/architecture.md): componentes e fluxos;
- [`docs/api-conventions.md`](docs/api-conventions.md): formatos transversais;
- [`docs/api-v1-endpoints.md`](docs/api-v1-endpoints.md): superfície HTTP;
- [`docs/backend-modules.md`](docs/backend-modules.md): módulos NestJS;
- [`docs/backend_tests.md`](docs/backend_tests.md): estratégia de testes;
- [`docs/data-model.md`](docs/data-model.md): entidades e integridade;
- [`docs/functional-requirements.md`](docs/functional-requirements.md): requisitos entregues;
- [`docs/user-stories.md`](docs/user-stories.md): histórias da V1;
- [`docs/state.md`](docs/state.md): fotografia do worktree;
- [`docs/backlog.md`](docs/backlog.md): itens explicitamente posteriores.
