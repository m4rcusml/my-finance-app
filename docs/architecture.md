# Arquitetura da V1

## Visão geral

O My Finance App é um monorepo pnpm com três pacotes:

```text
Navegador
   |
   | HTTPS + JSON/multipart
   v
apps/frontend (Next.js 16)
   |
   | /api/v1 + Bearer; cookies apenas no fluxo de sessão
   v
apps/backend (NestJS 11)
   |
   | Prisma 7
   v
PostgreSQL 16

packages/contracts
   ├── tipos e helpers consumidos pelo frontend
   └── tipos e helpers consumidos pelo backend
```

Não há Redis, fila, provedor de cotação ou integração bancária externa na V1.

## Responsabilidades

### `packages/contracts`

Fonte compartilhada do protocolo:

- rotas e prefixo;
- enums minúsculos;
- recursos e payloads;
- paginação;
- datas civis e timestamps;
- dinheiro e quantidade;
- envelope de erro.

O pacote produz `dist/index.js` para runtime e expõe os fontes TypeScript para tipos. Seu `dist` é artefato gerado.

### `apps/backend`

API NestJS modular. Cada domínio possui controller, DTO e service; os services acessam Prisma diretamente. O fluxo típico é:

1. middleware atribui ou propaga `X-Request-Id`;
2. Helmet, CORS e parser de cookies tratam a borda HTTP;
3. `ValidationPipe` remove campos desconhecidos, transforma queries e rejeita DTO inválido;
4. o guard global exige access token, salvo rotas `@Public()`;
5. o service valida ownership e invariantes;
6. Prisma consulta ou altera PostgreSQL;
7. o filtro global converte qualquer falha para o envelope uniforme;
8. o interceptor registra método, rota, status, duração e `requestId`.

O prefixo de negócio é `/api/v1`. `/health/live` e `/health/ready` ficam fora dele para balanceadores.

### `apps/frontend`

Aplicação Next.js App Router. Há um layout público e um layout privado único:

```text
SessionProvider
  └── RequireAuth
      └── AppShell
          └── página privada
```

`SessionProvider` também possui o `QueryClient`, porque sessão e cache privado precisam ser descartados juntos. TanStack Query controla dados remotos; estado local de sessão permanece em memória.

A camada `shared/lib/api` centraliza base URL, Bearer, cookies, erros, refresh e retry. Upload multipart passa pela mesma recuperação de sessão do cliente JSON.

## Sessão

### Access token

É um JWT curto assinado por `JWT_SECRET`. O servidor o devolve no corpo de cadastro, login e refresh. O frontend mantém o valor apenas em memória e o envia em `Authorization: Bearer`.

### Refresh token

É `base64url` de 32 bytes aleatórios, sem identificador embutido. O valor bruto existe apenas no cookie `refresh_token`; PostgreSQL guarda SHA-256, `familyId`, expiração, revogação, rotação e vínculo com o sucessor.

A rotação ocorre numa transação com lock da linha:

- um token ativo gera exatamente um sucessor;
- o predecessor fica como tombstone até expirar;
- valor desconhecido ou malformado retorna 401 sem descobrir usuário ou família;
- reuso conhecido fora da janela revoga somente aquela família;
- uma segunda chamada na janela de cinco segundos retorna 409 e não limpa cookies.

O frontend usa Web Locks quando o navegador oferece a API. No fallback, após 409 espera 200 ms e tenta uma vez com o cookie atualizado.

### CSRF

`POST /auth/refresh` é a única operação autenticada pelo cookie. Antes dela, a SPA chama `GET /api/v1/auth/csrf`, recebe `{ csrfToken }` e repete o valor em `X-CSRF-Token`. A API compara o header ao cookie `csrf_token` em tempo constante. Ambos os cookies são `HttpOnly`; a SPA não usa `document.cookie`.

Logout, 401 terminal e troca de usuário cancelam queries, limpam o cache privado e descartam o access token.

## Dados financeiros

### Datas

Datas escolhidas pelo usuário são dias civis:

- JSON: `YYYY-MM-DD`;
- PostgreSQL: `DATE`;
- exemplos: data do lançamento, compra, vencimento e confirmação.

`createdAt`, `updatedAt`, expiração e revogação são instantes ISO e usam `timestamptz`.

### Valores

- dinheiro: `numeric(15,2)` no banco e número JSON;
- quantidade de investimento: `numeric(15,8)`;
- conversão e arredondamento ficam nos helpers comuns.

### Ownership

Todos os recursos de usuário carregam `userId` ou são alcançados por um pai do usuário. Consultas por ID confirmam ownership. Um ID existente de outro tenant retorna 404 para não revelar sua existência.

## Fluxos principais

### Dashboard

O backend resolve a janela (`week`, `month`, `year` ou `custom`) em `APP_TIMEZONE` e calcula a anterior. Agregados são feitos no banco, não sobre uma página de 20 itens. A resposta separa:

- caixa em contas não-investimento;
- saldo de contas do tipo `investment`;
- custo da carteira manual;
- cartão no ciclo vigente;
- totais atual/anterior e tendência;
- série de 12 meses;
- últimas transações, pendências recorrentes e contagem sem categoria.

### Recorrências

O modelo mensal guarda dia de referência, margem, categoria e exatamente uma origem. O job das 03:00 gera snapshots por competência, com índice único e backfill limitado.

O snapshot não muda quando o modelo histórico muda. Somente `pending -> confirmed` e `pending -> skipped` são permitidos. Confirmar cria a transação `source: fixed` e reivindica a ocorrência na mesma transação PostgreSQL.

### Importação

1. upload valida tamanho, extensão/conteúdo e escolhe parser CSV, OFX ou XLSX;
2. estratégia `inter` ou `generic` normaliza cada linha;
3. servidor persiste batch e linhas da prévia com expiração;
4. frontend confirma por `batchId`, destino e números de linha;
5. servidor recarrega as linhas, revalida ownership/destino e grava em transação;
6. `externalId` determinístico e índice único protegem contra repetição e concorrência.

A prévia é estado transitório e não entra no backup.

### Backup

A exportação pagina o grafo do usuário e inclui contas, cartões, categorias, transações, recorrências e ocorrências, ativos, investimentos, metas e histórico de arquivos importados. Não inclui hash de senha, tokens ou batches transitórios.

A restauração valida versão, forma, limites e referências antes de escrever. `replace` substitui o grafo do usuário; `merge` preserva o existente, reconcilia chaves únicas de categoria/ativo e ignora transações importadas com `externalId` já presente. Toda a operação é uma transação e falhas fazem rollback.

## Arquivamento

Contas, cartões e categorias são removidos fisicamente apenas sem dependências; com histórico, são arquivados. Modelos recorrentes são sempre arquivados. Itens arquivados continuam resolvíveis no histórico e não podem receber novos lançamentos.

Investimentos, metas e ativos sem dependentes podem ser excluídos porque não preservam um ledger próprio.

## Operação

### Desenvolvimento local

`docker compose up -d db` sobe PostgreSQL. `pnpm dev` inicia os dois apps no host.

### Compose completo

`docker compose --profile full up --build` é uma stack local. O backend roda em desenvolvimento com cookies não seguros por usar HTTP. O frontend é compilado com a URL pública da API. O healthcheck do backend usa `/health/ready`.

### Produção

Produção exige:

- Node.js 22 e PostgreSQL 16;
- HTTPS;
- `NODE_ENV=production` e `COOKIE_SECURE=true`;
- CORS com origens exatas;
- secret externo;
- `prisma migrate deploy` antes do tráfego;
- verificação de readiness e smoke do artefato.

Docker Compose local não é um manifesto de produção.

## Decisões conscientemente adiadas

Consulte [`backlog.md`](backlog.md). Em especial, `MarketAsset` é apenas catálogo manual; não existe preço corrente, lucro de mercado ou atualização externa.
