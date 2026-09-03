# My Finance App

Gerenciador financeiro pessoal em português do Brasil. Monorepo pnpm com uma API
NestJS + Prisma sobre PostgreSQL e um frontend Next.js.

Os dados ficam no banco que **você** configurar. Não há integração com bancos,
corretoras ou serviços de cotação — veja [Fora do escopo](#fora-do-escopo-da-v1).

---

## Sumário

- [O que a V1 faz](#o-que-a-v1-faz)
- [Fora do escopo da V1](#fora-do-escopo-da-v1)
- [Requisitos](#requisitos)
- [Instalação do zero](#instalação-do-zero)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Rodando em desenvolvimento](#rodando-em-desenvolvimento)
- [Testes](#testes)
- [Build e produção](#build-e-produção)
- [Docker](#docker)
- [Scripts disponíveis](#scripts-disponíveis)
- [Arquitetura](#arquitetura)
- [Decisões que valem conhecer](#decisões-que-valem-conhecer)
- [Solução de problemas](#solução-de-problemas)

---

## O que a V1 faz

| Área | O que está pronto |
|---|---|
| Sessão | Cadastro, login, logout, renovação automática de sessão, perfil, troca de senha, exclusão da conta |
| Cadastros | Contas, cartões de crédito, categorias — com arquivamento em vez de exclusão destrutiva |
| Lançamentos | Receitas e despesas com categoria, filtros por período/conta/cartão/categoria, paginação real |
| Sem categoria | Fila dedicada para categorizar lançamentos em sequência |
| Painel | Saldo em caixa separado do que está em contas de investimento, comparação com o período anterior, série de 12 meses, filtros semana/mês/ano/personalizado |
| Recorrentes | Modelos mensais, geração automática de ocorrências, confirmação na data real escolhida, pular, histórico imutável |
| Investimentos | Carteira registrada manualmente (custo de aquisição). **Sem cotação de mercado.** |
| Metas | Objetivos com progresso **informado manualmente** e rotulado como tal |
| Importação | CSV, OFX e XLSX do Banco Inter e formato genérico, com pré-visualização, erro por linha e reimportação sem duplicatas |
| Backup | Exportação completa em JSON e restauração nos modos substituir/mesclar, atômica |

## Fora do escopo da V1

Os itens abaixo **não existem** e não estão prometidos em lugar nenhum do produto.
Estão registrados em [`docs/backlog.md`](docs/backlog.md):

- cotação de mercado ao vivo e histórico de preços;
- integrações com Mercado Pago, BTG, Binance, Bipa, Coinbase ou qualquer corretora;
- categorização automática / aprendizado de máquina;
- alertas externos (e-mail, push), otimizador de investimentos, modo offline, backup em nuvem.

O CRUD de `market-assets` existe apenas como **catálogo manual** usado pelos
investimentos. Ele não busca preços.

---

## Requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | 22.x | `node --version` |
| pnpm | 10.x | `corepack enable && corepack prepare pnpm@10.25.0 --activate` |
| PostgreSQL | 16 | Local, gerenciado, ou via Docker (`pnpm db:up`) |
| Docker | opcional | Só para subir o PostgreSQL e para o stack completo |

Sem Docker? Os testes de integração sobem um PostgreSQL 16 real e descartável
sozinhos (pacote `embedded-postgres`), então só o desenvolvimento interativo
precisa de um banco seu.

---

## Instalação do zero

```bash
git clone <url-do-repositorio>
cd my-finance-app
corepack enable
pnpm install --frozen-lockfile
```

Copie os arquivos de ambiente e ajuste o que precisar:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
```

Gere dois segredos de verdade para o backend (32+ caracteres, **diferentes entre si**):

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64'))"
```

Suba o banco, aplique as migrations e gere o cliente Prisma:

```bash
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Rode tudo:

```bash
pnpm dev
```

- Frontend: <http://localhost:3000>
- API: <http://localhost:3001/api/v1>
- Swagger: <http://localhost:3001/api/v1/docs>
- Liveness: <http://localhost:3001/health/live>

O seed cria o usuário `demo@example.com` com a senha `senha-demo-12345`.

---

## Variáveis de ambiente

Todas são validadas no boot (`apps/backend/src/config/env.ts`). Um valor inválido
**derruba o processo** com a lista de problemas — nunca com os valores em si.

### `apps/backend/.env`

| Variável | Padrão | Para que serve |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3001` | Porta HTTP |
| `DATABASE_URL` | — | Conexão PostgreSQL (obrigatória) |
| `JWT_SECRET` | — | Assina o access token. Mínimo 32 caracteres |
| `JWT_REFRESH_SECRET` | — | Chave separada para refresh. Precisa ser **diferente** de `JWT_SECRET` |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Access token é curto de propósito |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` | 30 dias |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens exatas, separadas por vírgula |
| `APP_TIMEZONE` | `America/Sao_Paulo` | Define "hoje", limites de mês/semana e o job de recorrências |
| `COOKIE_DOMAIN` | vazio | Vazio = cookie host-only |
| `COOKIE_SECURE` | `false` | **Obrigatoriamente `true` em produção** |
| `COOKIE_SAMESITE` | `lax` | `none` só com `COOKIE_SECURE=true` |
| `MAX_UPLOAD_BYTES` | `5242880` | Limite do arquivo de importação |
| `MAX_IMPORT_ROWS` | `5000` | Limite de linhas por importação |
| `IMPORT_BATCH_TTL_MINUTES` | `60` | Validade da pré-visualização |
| `MAX_BACKUP_BYTES` | `20971520` | Limite do payload de restauração |
| `ENABLE_CRON` | `true` | Desligue em scripts e testes |
| `ENABLE_SWAGGER` | `true` | Desligue em produção se não quiser a doc pública |

### `apps/frontend/.env.local`

| Variável | Padrão | Para que serve |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Base da API, **incluindo** `/api/v1` |

> `NEXT_PUBLIC_*` é embutida no bundle em tempo de build. Em Docker ela é um
> `--build-arg`, não uma variável de runtime.

---

## Banco de dados e migrations

```bash
pnpm db:up            # sobe o PostgreSQL 16 do compose
pnpm db:generate      # gera o cliente Prisma em apps/backend/src/generated (não versionado)
pnpm db:migrate       # prisma migrate deploy — é o que roda em produção
pnpm db:migrate:dev   # cria uma migration nova durante o desenvolvimento
pnpm db:seed          # dados de demonstração, idempotente
```

O histórico tem três migrations. A terceira (`20260903120000_v1_invariants`) é
escrita à mão e faz o upgrade de uma base pré-V1 **sem apagar nada**: normaliza
os enums, converte datas civis para `date`, adiciona chaves estrangeiras,
índices e as constraints de integridade, e conserta as linhas que violavam as
novas regras. O caminho de upgrade é verificado por
`apps/backend/test/migrations/upgrade-check.mjs`, que popula uma base no schema
antigo, migra e confere 45 asserções.

```bash
DATABASE_URL=postgresql://... node apps/backend/test/migrations/upgrade-check.mjs
```

---

## Rodando em desenvolvimento

```bash
pnpm dev            # backend e frontend juntos
pnpm dev:backend    # só a API, com watch
pnpm dev:frontend   # só o Next
```

---

## Testes

```bash
pnpm test               # unitários de backend e frontend
pnpm test:e2e           # camada HTTP do backend (Prisma dublado)
pnpm test:integration   # backend contra PostgreSQL REAL, com as migrations de verdade
pnpm test:browser       # Playwright ponta a ponta
pnpm verify             # lint + typecheck + testes + build
```

`pnpm test:integration` sobe um PostgreSQL 16 descartável automaticamente. Para
apontar para um banco existente:

```bash
TEST_DATABASE_URL=postgresql://finance:finance@localhost:5432/finance_test pnpm test:integration
```

`test:e2e` roda o app inteiro sobre um `PrismaService` dublado: é um teste de
contrato HTTP, **não** uma validação ponta a ponta. Quem prova o comportamento
real contra o banco é `test:integration`.

---

## Build e produção

```bash
pnpm build                        # backend + frontend
pnpm --filter backend start:prod  # executa apps/backend/dist/main.js
```

A ordem em produção é sempre:

1. `pnpm db:migrate` — migrations **antes** do start, nunca de dentro do app;
2. `pnpm --filter backend start:prod`;
3. verificar `GET /health/ready`.

Checklist de deploy:

- [ ] `COOKIE_SECURE=true` e HTTPS ponta a ponta;
- [ ] `CORS_ORIGINS` com a origem exata do frontend (sem barra final, sem curinga);
- [ ] frontend em outro site? `COOKIE_SAMESITE=none` **e** `COOKIE_SECURE=true`;
- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` distintos e rotacionáveis;
- [ ] backup do PostgreSQL agendado (o backup do app é do usuário, não do operador);
- [ ] rollback: as migrations são aditivas; para voltar, restaure o dump anterior
      e faça deploy da versão anterior do código. Não há `migrate down`.

---

## Docker

```bash
pnpm db:up                                   # só o banco
docker compose --profile full up --build     # banco + backend + frontend
```

O `docker-entrypoint.sh` do backend roda `prisma migrate deploy` antes de iniciar
o servidor, e a imagem tem `HEALTHCHECK` apontando para `/health/live`.

> O Redis foi removido do compose: nada no caminho da V1 o usava. Sessões ficam
> em `refresh_tokens`, o rate limit é em processo e as pré-visualizações de
> importação são linhas em `import_batches`.

---

## Scripts disponíveis

| Script | O que faz |
|---|---|
| `pnpm dev` | Backend + frontend em paralelo |
| `pnpm build` | Compila os dois apps |
| `pnpm start` | Executa o artefato de produção do backend |
| `pnpm lint` / `pnpm lint:fix` | Biome |
| `pnpm format` / `pnpm format:check` | Biome format |
| `pnpm typecheck` | `tsc --noEmit` nos três pacotes |
| `pnpm test` / `test:e2e` / `test:integration` / `test:browser` | Ver [Testes](#testes) |
| `pnpm db:*` | Ver [Banco de dados](#banco-de-dados-e-migrations) |
| `pnpm verify` | Tudo o que a CI roda, localmente |
| `node scripts/smoke.mjs` | Smoke HTTP contra um backend já no ar |

---

## Arquitetura

```
apps/
  backend/     NestJS 11 + Prisma 7  ->  PostgreSQL 16
  frontend/    Next.js 16 (App Router) + React Query
packages/
  contracts/   tipos, enums e helpers compartilhados pelos dois apps
```

`packages/contracts` é a fonte única do contrato HTTP: enums, envelope de
paginação, formato de erro, datas civis e a forma de cada recurso. Os dois lados
importam daí, então uma divergência vira erro de compilação — e os testes de
contrato em `apps/backend/test/integration/` conferem que as respostas reais
batem com os tipos.

Documentação detalhada em [`docs/`](docs/):
[arquitetura](docs/architecture.md) ·
[modelo de dados](docs/data-model.md) ·
[endpoints](docs/api-v1-endpoints.md) ·
[convenções da API](docs/api-conventions.md) ·
[estado](docs/state.md) ·
[backlog](docs/backlog.md)

---

## Decisões que valem conhecer

**Sessão.** O access token é curto e vive **só em memória** no navegador — nunca
em `localStorage`. A sessão durável é um refresh token opaco em cookie
`HttpOnly`, guardado no banco como hash SHA-256 e **rotacionado a cada uso**;
reapresentar um token já rotacionado revoga a família inteira. Como toda rota
que altera dados autentica pelo Bearer (e não pelo cookie), um POST
cross-site não consegue agir pelo usuário; a única rota autenticada por cookie,
`POST /auth/refresh`, exige também um CSRF token de duplo envio.

**Datas civis.** A data de um lançamento é um dia do calendário, não um
instante: coluna `date` no PostgreSQL e string `YYYY-MM-DD` no JSON. É isso que
impede o lançamento de 15/01 virar 14/01 em `America/Sao_Paulo`.

**Dinheiro.** `numeric(15,2)` no banco, número JSON com 2 casas na API. O
intervalo cabe com folga na precisão exata de um float64 em centavos.

**Histórico.** Contas, cartões, categorias e modelos de recorrência são
arquivados, não apagados. As chaves estrangeiras são `RESTRICT` justamente para
que o banco recuse apagar algo que ainda tem histórico.

**Uma origem só.** Um lançamento tem conta **ou** cartão, nunca os dois nem
nenhum — garantido por DTO, por serviço e por uma constraint `CHECK`.

---

## Solução de problemas

**`Invalid environment configuration` no start**
A mensagem lista as variáveis problemáticas pelo nome. Compare com
`apps/backend/.env.example`. Causas comuns: `JWT_SECRET` com menos de 32
caracteres, os dois segredos iguais, ou `COOKIE_SECURE=false` com
`NODE_ENV=production`.

**`Cannot find module '../generated/prisma/client'`**
O cliente Prisma não é versionado. Rode `pnpm db:generate`.

**`NEXT_PUBLIC_API_URL não está definida`**
Falta `apps/frontend/.env.local`. Se estiver usando Docker, lembre que essa
variável é `--build-arg`, não runtime.

**`P1001: Can't reach database server`**
`pnpm db:up` e confira a porta em `DATABASE_URL`.

**CORS bloqueando o frontend**
`CORS_ORIGINS` precisa da origem exata (`https://app.exemplo.com`), sem caminho
e sem barra no fim.

**Sessão cai a cada recarga em produção**
O cookie de refresh não está voltando: verifique `COOKIE_SECURE=true` sob HTTPS
e, se o frontend estiver em outro site, `COOKIE_SAMESITE=none`.

**Testes de integração falham subindo o banco**
Se a porta 55433 estiver ocupada, use `TEST_PG_PORT=55444`, ou aponte
`TEST_DATABASE_URL` para um PostgreSQL 16 que você já tenha.
