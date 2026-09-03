# Estratégia de testes

Este documento descreve o que cada suíte deve provar e como executá-la. Ele não registra resultado, contagem de testes aprovados ou percentual de cobertura: essas informações pertencem à execução da CI ou ao relatório da release.

## Pré-requisitos

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
```

Use Node.js 22 e pnpm 10. O cliente Prisma é gerado, não versionado.

## Camadas

### Unitários do backend

Comando:

```bash
pnpm --filter backend test
```

Os specs co-localizados em `apps/backend/src` cobrem services e regras sem servidor real, incluindo:

- auth e cookies;
- usuários;
- contas, cartões, categorias e transações;
- dashboard;
- modelos e ocorrências recorrentes;
- investimentos, metas e ativos;
- importação, parsers e valores;
- backup;
- health;
- job de geração.

Mocks precisam reproduzir a semântica usada pelo código, especialmente `PrismaService.$transaction`, claims condicionais e respostas paginadas. Um mock que sempre retorna sucesso não prova concorrência.

### HTTP do backend com Prisma mockado

Comando:

```bash
pnpm test:e2e
```

Configuração: `apps/backend/test/jest-e2e.json`.

Apesar do nome histórico `e2e`, esta suíte monta a aplicação NestJS e substitui o Prisma. Ela é adequada para:

- método, rota e status;
- guard de autenticação;
- DTO, transformação e validação;
- envelope de erro;
- serialização;
- headers e cookies;
- contrato de paginação.

Ela não prova migration, constraint, SQL, transação real ou isolamento do PostgreSQL.

### Integração PostgreSQL

Comando:

```bash
pnpm test:integration
```

Configuração: `apps/backend/test/jest-integration.json`.

Os specs em `apps/backend/test/integration` usam banco real e cobrem os casos que dependem do PostgreSQL:

- proteção de URL destrutiva;
- sessão opaca, CSRF, rotação, replay e concorrência;
- isolamento entre usuários;
- paginação e invariantes do ledger;
- datas civis, ciclos e concorrência de recorrência;
- importação e backup atômicos.

Sem `TEST_DATABASE_URL`, o harness inicia PostgreSQL 16 descartável via `embedded-postgres`. Com uma URL externa:

```bash
TEST_DATABASE_URL=postgresql://finance:finance@localhost:5432/finance_test pnpm test:integration
```

O nome precisa terminar em `_test`, `_ci` ou `_e2e`. `ALLOW_DESTRUCTIVE_TEST_DB=true` desativa o bloqueio e só deve ser usado após confirmação independente do alvo.

A suíte pode truncar tabelas. Nunca aponte para desenvolvimento compartilhado ou produção.

### Migrations

Banco vazio:

```bash
DATABASE_URL=postgresql://finance:finance@localhost:5432/finance_empty_test pnpm db:migrate
```

Upgrade pré-V1 com dados inconsistentes preparados pelo fixture:

```bash
pnpm test:migration:upgrade
```

O comando cria PostgreSQL 16 descartável por padrão. Para um serviço já existente,
use `MIGRATION_TEST_DATABASE_URL` com banco terminado em `_test`, `_ci` ou `_e2e`.

Ambos os bancos devem ser descartáveis. Além de o comando sair com zero, confira que o schema aplicado corresponde a `prisma/schema.prisma` com `prisma migrate diff`.

### Frontend

Comando:

```bash
pnpm --filter frontend test
```

Jest + Testing Library cobre atualmente áreas críticas em:

- filtros do dashboard;
- helpers e formulário de transação;
- criação/isolamento do QueryClient;
- bootstrap, refresh e limpeza de sessão;
- diálogo;
- paginação;
- loading/empty/error/retry de queries.

Novos componentes devem ser testados pelo comportamento observável e nome acessível, não por estrutura interna.

### Browser

Comando:

```bash
pnpm test:browser
```

Configuração: `playwright.config.ts`; testes em `e2e/`.

O Playwright inicia:

1. banco descartável e migrations por `scripts/e2e-database.mjs`;
2. backend na porta 3001;
3. frontend na porta 3000.

As jornadas cobrem cadastro/login, ledger principal, dashboard, recorrências, importação/backup, troca de usuário, navegação móvel, tamanhos de viewport e teclado.

Por padrão usa Chromium, locale pt-BR, timezone `America/Sao_Paulo`, um worker e artefatos somente em falha. Em CI há retry limitado. `playwright-report` e `test-results` não são versionados.

## Gates da V1

Execute na raiz e preserve a saída no relatório de release:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:integration
pnpm build
pnpm test:smoke
pnpm test:browser
pnpm audit --audit-level high
```

`pnpm verify:all` agrega essa cadeia completa e `pnpm verify` é seu alias. Instalação congelada e geração do Prisma continuam preparações explícitas anteriores ao agregador.

## Build e smoke

O typecheck não garante que o Nest emitiu o arquivo correto. Verifique duas builds consecutivas:

```bash
pnpm build:backend
pnpm build:backend
```

Confirme `apps/backend/dist/main.js` e execute o gate autocontido:

```bash
pnpm test:smoke
```

Ele usa PostgreSQL descartável, aplica migrations, inicia exatamente o artefato em `NODE_ENV=production` com cookie seguro e chama `scripts/smoke.mjs`. Para diagnóstico contra um backend que você já iniciou, execute:

```bash
node scripts/smoke.mjs --base http://localhost:3001
```

O smoke faz chamadas reais de health, auth, paginação, CRUD mínimo, XOR, datas, dashboard, erro e isolamento. Ele cria usuários temporários e tenta removê-los; use `--keep` no script manual apenas para investigação.

## Docker

Quando Docker estiver disponível:

```bash
docker compose --profile full up --build
```

Critérios manuais complementares:

- serviços ficam healthy;
- frontend abre e usa a API;
- `/health/ready` devolve 200;
- ao interromper PostgreSQL, readiness passa a 503 e o backend não se declara pronto;
- ao restaurar o banco, o healthcheck se recupera;
- logs não contêm secrets ou cookies.

Desligue sem remover volumes se quiser preservar o banco local:

```bash
docker compose --profile full down
```

## CI

`.github/workflows/ci.yml` separa:

- lint, formato e tipos;
- unitários, HTTP e cobertura;
- migrations vazia/upgrade e integração;
- build e smoke do artefato;
- Playwright;
- auditoria de dependências.

Não descreva a V1 como aprovada apenas porque o YAML existe. A evidência é uma execução verde no commit candidato.

## Princípios para novos testes

- fixe datas e timezone quando o resultado depende do calendário;
- cubra 0, 1, 20, 21 e mais de 100 itens em paginação;
- use dois usuários para toda regra de ownership;
- teste o estado após falha para provar rollback;
- dispare operações simultâneas para claims e idempotência;
- não substitua PostgreSQL por SQLite;
- não use banco sem sufixo descartável;
- não faça snapshot de UUID, timestamp ou texto irrelevante;
- mantenha fixtures bancários anonimizados.
