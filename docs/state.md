# Estado da V1

Data da fotografia documental: 2026-09-04.

Este arquivo descreve o que existe no worktree. Não é um certificado de release: nenhum gate deve ser considerado aprovado sem a saída da execução no commit candidato.

## Superfície implementada

### Frontend

Rotas públicas:

- `/`;
- `/login`;
- `/register`.

Rotas privadas sob `RequireAuth` e `AppShell`:

- `/dashboard`;
- `/accounts`: visão geral de contas e cartões; `?view=accounts` e `?view=cards` abrem as listas específicas;
- `/transactions`: movimentações; `?view=uncategorized` abre a fila sequencial e `?view=categories` gerencia categorias;
- `/fixed-transactions`;
- `/investments`;
- `/goals`;
- `/imports`;
- `/settings`: visão geral; `?view=profile`, `?view=security` e `?view=data` abrem perfil, segurança e backup.

Os endereços anteriores continuam como redirecionamentos: `/credit-cards` → `/accounts?view=cards`, `/categories` → `/transactions?view=categories`, `/transactions/uncategorized` → `/transactions?view=uncategorized` e `/backup` → `/settings?view=data`.

O shell inclui navegação móvel e tutorial guiado que pode ser retomado em Configurações. Componentes compartilhados tratam paginação, estados de query, feedback e diálogos acessíveis. As telas consolidadas seguem o protótipo Figma e usam os recursos reais da API.

### Backend

Módulos registrados:

- config, Prisma, common e health;
- auth e users;
- accounts, credit cards, categories e transactions;
- dashboard;
- fixed transactions, occurrences e job;
- market assets e investments;
- goals;
- imports;
- backup.

A superfície HTTP detalhada está em [`api-v1-endpoints.md`](api-v1-endpoints.md).

### Contratos

`packages/contracts` contém enums, primitives, resources e routes. Backend e frontend importam o pacote. O backend mantém apenas adaptadores DTO/Swagger para validação na borda.

### Banco

Schema Prisma com quatro migrations:

- `20251125204546_init`;
- `20251210015148_optional_description`;
- `20260903120000_v1_invariants`.
- `20260904183000_category_color`.

A migration V1 inclui conversão de dados legados, constraints, sessões opacas e batches de importação. O script `apps/backend/test/migrations/upgrade-check.mjs` prepara e avalia um upgrade pré-V1 em banco descartável.

A quarta migration adiciona `categories.color`, anulável, e uma constraint de hexadecimal `#RRGGBB`. Não altera as migrations anteriores.

## Comportamentos relevantes

### Sessão

- access token JWT curto em memória;
- refresh opaco de 256 bits em cookie `HttpOnly`;
- somente hash/família persistidos;
- rotação atômica e tombstones;
- janela de concorrência de cinco segundos;
- bootstrap CSRF por resposta JSON;
- Web Locks e fallback de retry no frontend;
- limpeza conjunta de sessão e cache privado.

### Ledger

- paginação uniforme `{ data, meta }`;
- datas financeiras civis;
- dinheiro normalizado;
- origem conta XOR cartão;
- 404 cross-tenant;
- arquivo/restauração para cadastros com histórico;
- relações nomeadas nas listas.
- categorias com cor opcional, busca por nome e filtro de estado `active`, `archived` ou `all`;
- busca por descrição de transações aplicada no banco antes da paginação.

### Dashboard e cartões

- janelas semana/mês/ano/custom;
- comparação anterior;
- agregados de banco sem truncar pela paginação;
- caixa, conta-investimento e carteira separados;
- 12 meses zero-filled;
- cartões por ciclo aberto.

### Recorrências

- modelos mensais com origem conta/cartão;
- snapshots por competência;
- criação e reativação geram a ocorrência do mês vigente na mesma transação de banco, sem esperar o cron;
- criação concorrente usa a chave única modelo/competência e preserva ocorrências já existentes, inclusive confirmadas e ignoradas;
- job idempotente às 03:00 em `APP_TIMEZONE`, responsável pelos períodos seguintes e pelo backfill limitado;
- estados `pending`, `confirmed`, `skipped`;
- confirmação transacional e claim concorrente;
- archive/restore sem apagar ocorrências finais.

O botão “Nova recorrência” fica disponível na tela principal. A ocorrência nasce pendente; somente a confirmação cria o lançamento financeiro. Iniciar o backend ou abrir a tela ainda não executa a geração dos períodos seguintes.

### Importação

- CSV, OFX/QFX e planilhas;
- estratégias Inter e genérica;
- validação de tipo/tamanho;
- preview persistido com expiração;
- confirmação por batch/linhas;
- revalidação do destino;
- `externalId` determinístico e constraint de duplicidade;
- upload usa a recuperação de sessão comum.

### Backup

- schema versionado;
- exportação paginada do grafo durável;
- ocorrências incluídas;
- credenciais e previews excluídos;
- `replace` e `merge`;
- validação e operação transacional.
- cor da categoria preservada na exportação e na criação/restauração de categorias; backups anteriores sem `color` continuam válidos, normalizados para `null`.

## Testes presentes

### Backend unitário

Specs co-localizados nos módulos principais, auth controller, health, job, parser e serviços de domínio.

### Backend HTTP

Arquivos `apps/backend/test/*.e2e-spec.ts`, executados com Nest completo e Prisma mockado.

### PostgreSQL real

- `auth.int-spec.ts`;
- `database-safety.int-spec.ts`;
- `ledger.int-spec.ts`;
- `import-backup.int-spec.ts`;
- `category-presentation.int-spec.ts`: cor, filtros/busca antes da paginação e isolamento entre usuários;
- `recurrence-creation.int-spec.ts`: ocorrência imediata e concorrência de restauração com o job;
- migration upgrade check.

### Frontend

Specs de filtros/helpers/formulário, QueryClient, sessão, diálogo, paginação e estados de query.

Os testes da interface nova incluem resumo de contas/cartões, formulário de cor de categoria, fila de categorização, retomada de importação por batch e sessão, série de aportes, confirmação de recorrência, atualização manual de meta e resumo com mais de 100 metas. Os arquivos estão junto aos componentes e features correspondentes.

### Browser

- `e2e/core-flow.spec.ts`;
- `e2e/import-backup.spec.ts`;
- `e2e/session-layout.spec.ts`.
- `e2e/tutorial.spec.ts`;
- `e2e/rebranch-ui.spec.ts`.

O fluxo principal exercita criação, confirmação e restauração de recorrências sem duplicar o lançamento, além de atualização e persistência do progresso manual de metas. A presença desses testes não registra sua aprovação para um commit candidato.

## Infraestrutura presente

- Dockerfiles para backend e frontend;
- Compose com PostgreSQL e perfil `full`;
- healthchecks de banco e API;
- `docker-entrypoint.sh` com migration antes do start;
- workflow GitHub Actions;
- smoke HTTP cross-platform;
- banco PostgreSQL descartável para integração e browser;
- `.gitattributes` forçando LF em scripts shell;
- exemplos de ambiente sem credenciais reais.

## Verificação ainda necessária por candidato

Execute e registre:

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

`pnpm verify:all` (também exposto como `pnpm verify`) agrega essa cadeia após a instalação e a geração do cliente Prisma.

Além do código de saída:

1. execute o build do backend duas vezes e confirme `apps/backend/dist/main.js`;
2. inicie `start:prod` e rode `node scripts/smoke.mjs`;
3. teste migration em banco vazio e upgrade pré-V1;
4. com Docker disponível, suba o perfil `full`;
5. confira 200 na readiness e 503 ao indisponibilizar PostgreSQL;
6. confira o status Git e ausência de secrets/artefatos.

Até essa evidência existir para o commit candidato, use “implementado no worktree” e não “release aprovada”.

## Limitações deliberadas

- carteira por custo, sem valor de mercado;
- metas com progresso manual;
- somente layouts de importação Inter/genérico;
- backup em arquivo local, sem armazenamento do operador;
- rate limit em processo;
- Compose destinado a desenvolvimento local;
- nenhuma publicação em provedor incluída.

Esses limites não são defeitos ocultos; formam a fronteira da V1. Evoluções estão em [`backlog.md`](backlog.md).
