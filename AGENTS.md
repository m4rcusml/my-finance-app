# Guia para agentes — My Finance App

Leia este arquivo antes de alterar o repositório. O objetivo é manter a V1 pequena, coerente e verificável. O código e `packages/contracts` prevalecem sobre descrições históricas; ao mudar comportamento público, atualize os contratos, os dois consumidores, testes e documentação na mesma entrega.

## Regras de preservação

- Use Node.js 22 e pnpm 10; não introduza npm, yarn, Bun ou outro lockfile.
- Execute comandos a partir da raiz, salvo quando um script exigir outro diretório.
- Não use `git reset --hard`, `git clean` ou descarte indiscriminado de arquivos.
- Preserve mudanças existentes e não toque no arquivo local `tutor`.
- Não versione `.env*` preenchidos, `node_modules`, `.next`, `dist`, cobertura, relatórios ou `apps/backend/src/generated`.
- Não faça push, deploy ou alteração externa sem autorização explícita.
- Não acrescente integrações ou funcionalidades do backlog durante correções da V1.

## Escopo fixado

A V1 inclui autenticação, contas, cartões, categorias, transações, dashboard, recorrências, investimentos manuais, catálogo manual de ativos, metas manuais, importação Banco Inter/genérica e backup JSON local.

Ficam fora: preços de mercado, bancos/corretoras adicionais, ML, alertas, otimizador, offline e nuvem. Consulte `docs/backlog.md`.

## Stack e estrutura

```text
apps/
  backend/       NestJS 11 + Prisma 7
  frontend/      Next.js 16 App Router + React 19
packages/
  contracts/     contrato HTTP compartilhado
e2e/             Playwright
scripts/         smoke, banco E2E e auxiliares operacionais
docs/            documentação da V1
```

PostgreSQL 16 é o armazenamento persistente. Não há Redis nem serviço externo no caminho da V1.

## Comandos canônicos

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
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
pnpm verify:all
```

Atalhos úteis:

```bash
pnpm dev:backend
pnpm dev:frontend
pnpm build:backend
pnpm build:frontend
pnpm db:local
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

Não registre um gate como aprovado sem executar o comando e observar código de saída zero. `pnpm verify` aponta para a cadeia completa `verify:all`. O teste de produção confirma `apps/backend/dist/main.js`, inicia esse artefato e executa o smoke.

## Contrato HTTP

`packages/contracts` é a única definição de:

- enums e seus valores minúsculos;
- rotas compartilhadas;
- recursos e payloads;
- política de criação de senha;
- `PaginatedResponse<T>` e metadados;
- datas civis, dinheiro, quantidades e envelope de erro.

O backend pode ter DTOs para validação e Swagger, mas eles devem implementar ou espelhar o contrato, não redefinir um formato concorrente. O frontend deve consumir `shared/lib/api/resources` e as query keys atuais; não reintroduza clientes ou módulos removidos.

Regras transversais:

- toda coleção retorna `{ data, meta }`;
- `page` começa em 1, `limit` padrão é 20 e máximo é 100;
- datas financeiras usam `YYYY-MM-DD`; não passe por `new Date('YYYY-MM-DD')` na interface;
- timestamps ISO são reservados a auditoria;
- dinheiro é `numeric(15,2)` no banco e número no JSON; quantidade usa `numeric(15,8)`;
- atualização usa campo omitido para “manter” e `null` explícito para “limpar” quando permitido;
- erros seguem `{ statusCode, error, message, details?, timestamp, path, requestId }`.

## Invariantes de domínio

- `Transaction`, `FixedTransaction` e o snapshot da ocorrência têm exatamente uma origem: `accountId` XOR `creditCardId`.
- Uma categoria precisa ser compatível com o tipo do lançamento.
- Contas, cartões e categorias com histórico são arquivados. Apenas registros sem dependências podem ser removidos fisicamente.
- Recorrências nunca são apagadas de forma definitiva; `DELETE` arquiva o modelo.
- Ocorrências aceitam somente `pending -> confirmed` ou `pending -> skipped`.
- Confirmação de ocorrência cria exatamente uma transação `source: fixed` dentro da mesma transação de banco.
- Cartão soma despesas apenas no ciclo aberto calculado por `closingDay`, com clamp para meses curtos.
- Contas do tipo `investment` não entram no saldo em caixa; a carteira manual também aparece separada.
- Progresso de meta é manual e deve ser rotulado assim.
- Recursos cross-tenant respondem 404, não 403.

## Sessão e segurança

- Senhas usam Argon2.
- Access token JWT curto fica apenas em memória e é enviado como Bearer.
- Refresh token é opaco, tem 256 bits e vive em cookie `HttpOnly`; o banco guarda somente SHA-256, família, expiração, revogação e sucessor.
- A rotação usa lock transacional. Tombstones ficam até expirar para detectar reuso.
- Reuso conhecido revoga somente a família. Token forjado é 401 sem efeitos colaterais.
- Corrida de refresh em até cinco segundos retorna 409 ao perdedor sem limpar cookies.
- `GET /api/v1/auth/csrf` prepara o par e o valor do corpo vai em `X-CSRF-Token` no refresh.
- Nunca leia refresh ou CSRF via `document.cookie`.
- Logout, 401 terminal e troca de usuário cancelam queries e limpam o cache privado.
- Falhas de login não podem revelar se o e-mail existe.

Ao criar nova rota, ela é privada por padrão. Use `@Public()` somente quando houver justificativa explícita, como auth ou health.

## Backend

- Módulos de domínio ficam em `apps/backend/src/<dominio>`.
- Services acessam Prisma diretamente; não invente uma camada de repository vazia.
- Use `assertOwned` ou consulta equivalente com `userId` em todo acesso por ID.
- Use `PrismaService.$transaction` para operações compostas e concorrentes.
- Não some uma página de registros para produzir agregados; agregue no banco.
- A API usa prefixo `/api/v1`; `/health/live` e `/health/ready` ficam fora dele.
- Readiness precisa retornar 503 quando o banco não responde.
- O job de recorrências roda às 03:00 em `APP_TIMEZONE`, é idempotente e faz backfill limitado.
- Arquivos de importação têm prévia persistida; confirmação aceita `batchId` e números de linha, nunca transações fornecidas pelo cliente.
- Backup não inclui credenciais nem estado transitório de preview.

### Prisma e migrations

O cliente é gerado em `apps/backend/src/generated/prisma` e não é versionado. Use:

```bash
pnpm db:generate
pnpm db:migrate
```

Não altere as duas migrations históricas. Enquanto a V1 não tiver sido publicada, correções de upgrade pertencem a `20260903120000_v1_invariants`. Teste tanto uma base vazia quanto o fixture pré-V1 inconsistente. Nunca resete um banco desconhecido.

Testes destrutivos só podem usar banco com nome terminado em `_test`, `_ci` ou `_e2e`, salvo `ALLOW_DESTRUCTIVE_TEST_DB=true` explicitamente autorizado.

## Frontend

- Rotas usam Next.js App Router em `apps/frontend/src/app`.
- Todas as telas privadas passam por um único `RequireAuth` e `AppShell`.
- Estado de servidor usa TanStack Query; o access token/sessão fica no store somente em memória.
- Toda query precisa de loading, vazio, erro e retry acionável.
- Toda mutation precisa de feedback. Só use atualização otimista quando houver rollback seguro.
- Query keys começam pela chave da sessão e usam filtros tipados.
- Upload usa o mesmo tratamento de 401, normalização de erro e retry único do cliente JSON.
- Links devem apontar para rotas existentes e rótulos nunca devem expor UUIDs.
- Navegação precisa funcionar desde 320 px.
- Diálogos precisam de nome acessível, foco inicial, Escape, focus trap e restauração de foco.

## Testes

- Unitários backend: services, auth, health, job, parsers e regras puras.
- HTTP backend (`test:e2e`): Nest completo com Prisma mockado; valida contrato/guards/DTOs, não PostgreSQL.
- Integração: PostgreSQL real, migrations, concorrência, isolamento e atomicidade.
- Frontend: Jest + Testing Library para sessão/cache, paginação, formulários, erros e acessibilidade.
- Browser: Playwright em `e2e/`, com banco e web servers isolados.

Ao corrigir um bug, acrescente o teste na camada mais baixa que reproduza a causa e mantenha um teste de integração quando o comportamento depender de PostgreSQL, cookie, concorrência ou migração.

## Docker, CI e produção

`docker compose up -d db` sobe apenas PostgreSQL. `docker compose --profile full up --build` é uma stack local: backend em desenvolvimento e cookie não seguro por usar HTTP.

Produção exige HTTPS, `NODE_ENV=production`, `COOKIE_SECURE=true`, CORS explícito, secrets externos, migrations antes do tráfego e healthchecks reais. Não trate o Compose local como manifesto de produção.

O workflow de CI deve manter jobs para análise estática, unitários/HTTP, PostgreSQL/migrations, build/smoke, Playwright e auditoria. Ao alterar scripts, mantenha README, CI e comandos raiz coerentes.

## Definition of Done

Uma mudança só está concluída quando:

1. contrato, backend, frontend e documentação concordam;
2. migrations foram exercitadas no caminho aplicável;
3. testes relevantes cobrem sucesso, erro, ownership e limites;
4. lint, formato, typecheck, testes e builds necessários foram executados;
5. nenhum segredo ou artefato entrou no diff;
6. o status local preserva mudanças alheias e o arquivo `tutor`.
