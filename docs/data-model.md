# Modelo de dados da V1

Fonte executável: `apps/backend/prisma/schema.prisma`. O banco suportado é PostgreSQL 16.

## Convenções

- tabelas e colunas físicas usam `snake_case`;
- campos Prisma e JSON usam `camelCase`;
- IDs são UUIDs;
- entidades do usuário carregam `userId`;
- dinheiro usa `numeric(15,2)`;
- quantidade usa `numeric(15,8)`;
- datas financeiras usam `DATE`;
- instantes de auditoria usam timestamp;
- enums usam valores minúsculos;
- FKs de histórico normalmente usam `RESTRICT`.

## Visão das relações

```text
User
├── RefreshToken
├── Account
│   ├── Transaction
│   ├── FixedTransaction / FixedTransactionOccurrence
│   └── Goal (opcional)
├── CreditCard
│   ├── Transaction
│   └── FixedTransaction / FixedTransactionOccurrence
├── Category
│   ├── Transaction
│   ├── FixedTransaction / FixedTransactionOccurrence
│   └── Goal (opcional)
├── MarketAsset ── Investment
├── ImportBatch ── ImportBatchRow
│                ├── Transaction
│                └── ImportedFile
└── Goal
```

## Entidades

### `User`

Identidade da conta:

- `email` único e normalizado;
- `passwordHash` Argon2;
- `name` opcional;
- `tokenVersion` invalida tokens ao trocar credenciais;
- timestamps de criação/atualização.

Excluir o usuário remove seu grafo por cascade após confirmação reforçada na API.

### `RefreshToken`

Uma linha por token emitido:

- `tokenHash` SHA-256 único;
- `familyId`;
- `expiresAt`;
- `revokedAt` e `rotatedAt`;
- `successorTokenId` único e auto-relação.

O token bruto nunca é persistido. Predecessores rotacionados permanecem como tombstones até expirar.

### `Account`

Cadastro financeiro com instituição, tipo, saldo inicial e estado de arquivamento. O saldo atual não é armazenado: é calculado do inicial mais receitas menos despesas.

Tipos:

- `checking`;
- `savings`;
- `investment`;
- `cash`;
- `other`.

Apenas contas não-investimento entram em `netBalance`.

### `CreditCard`

Nome, instituição, limite, dia de fechamento opcional e arquivamento. Uso e disponível não são colunas: são calculados a partir de despesas no ciclo aberto.

`closingDay=null` alinha o ciclo ao mês civil. Dias 29–31 são limitados ao último dia quando necessário.

### `Category`

Nome, tipo e arquivamento. Chave única por `(userId, name, type)`.

Tipos: `income`, `expense`, `both`. Uma categoria vinculada precisa ser `both` ou ter o mesmo tipo da transação/modelo. A API impede mudar o tipo quando isso invalidaria vínculos históricos.

### `Transaction`

Ledger de receitas/despesas:

- `type`, `value`, `date`;
- `accountId` ou `creditCardId`;
- `categoryId` opcional;
- `description` opcional;
- `source`: `manual`, `imported` ou `fixed`;
- `externalId` de importação, quando aplicável;
- `importBatchId` opcional;
- auditoria.

A constraint PostgreSQL exige exatamente uma origem. O índice único parcial `(user_id, external_id)` protege importações quando `externalId` existe.

### `FixedTransaction`

Modelo mensal com tipo, valor, dia de referência, margem, categoria, exatamente uma origem e arquivamento.

O modelo é configuração; o histórico fica em ocorrências. `DELETE` na API arquiva.

### `FixedTransactionOccurrence`

Snapshot por `(fixedTransactionId, periodYear, periodMonth)`:

- status `pending`, `confirmed` ou `skipped`;
- data nominal `dueDate`;
- data real e `transactionId` ao confirmar;
- cópia de tipo, valor, descrição, categoria e origem;
- relação preservada com o modelo.

Constraints garantem origem XOR, unicidade de competência e coerência da ocorrência confirmada. Uma transição final não volta a pending.

### `MarketAsset`

Catálogo manual com símbolo, tipo, bolsa/origem e nome. A chave de V1 é por usuário, símbolo e exchange. `userId` permanece anulável apenas para preservar linhas globais históricas pré-V1; a API exige ownership estrito e não expõe linhas órfãs.

Não há preço ou série de mercado.

### `Investment`

Posição/aporte manual:

- ativo opcional;
- corretora como texto;
- tipo;
- quantidade;
- preço de compra;
- total investido;
- data de compra.

O sumário representa custo de aquisição, não valor atual.

### `Goal`

Meta manual:

- nome e tipo;
- valor alvo;
- valor atual informado pelo usuário;
- prazo civil opcional;
- relação opcional com conta/categoria.

As relações não automatizam o progresso. A API calcula e rotula `progressSource: manual`.

### `ImportBatch` e `ImportBatchRow`

Estado transitório da prévia:

- hash do arquivo, origem, tipo e expiração;
- uma linha persistida por número;
- valores normalizados, `externalId`, flag de duplicata e erros.

Unicidade `(batchId, rowNumber)`. O cliente confirma números, não reenviando conteúdo financeiro.

### `ImportedFile`

Registro durável da confirmação: batch opcional, origem, nome, tipo, status, data e total. O batch pode ser removido sem apagar o histórico.

## Arquivamento e exclusão

| Recurso | Com dependências | Sem dependências |
|---|---|---|
| conta | arquiva | pode remover |
| cartão | arquiva | pode remover |
| categoria | arquiva | pode remover |
| modelo recorrente | sempre arquiva | sempre arquiva |
| investimento | — | remove |
| meta | — | remove |
| ativo | conflito se usado | remove se livre |
| transação | remove conforme endpoint | — |

Arquivar preserva a resolução dos nomes no histórico. Novos lançamentos só aceitam recursos ativos.

## Backup

O arquivo versionado contém:

- usuário sem credenciais;
- contas, cartões e categorias;
- transações;
- modelos e ocorrências;
- ativos e investimentos;
- metas;
- histórico de arquivos importados.

Não contém `RefreshToken`, `passwordHash`, `tokenVersion`, `ImportBatch` ou `ImportBatchRow`.

`replace` recria o grafo com IDs remapeados deterministicamente para o usuário. `merge` gera IDs novos para entidades adicionadas, reaproveita categorias/ativos com chaves únicas e não recria transação importada cujo `externalId` já exista. Quando uma ocorrência do arquivo aponta para essa transação já existente, a restauração remapeia o vínculo em vez de descartar o histórico. Referências sempre passam pelos mapas; IDs do arquivo nunca são usados como atalho cross-tenant.

## Migrations

Histórico:

1. `20251125204546_init`;
2. `20251210015148_optional_description`;
3. `20260903120000_v1_invariants`.

As duas primeiras migrations são históricas. A terceira introduz a V1 e foi escrita para upgrade sem apagar linhas:

- cria enums nativos e normaliza grafias;
- converte datas financeiras para `DATE`;
- adiciona arquivamento;
- repara referências inválidas antes de criar FKs;
- cria conta placeholder arquivada quando uma transação antiga não tem origem;
- resolve colisões antes de índices únicos sem apagar transações;
- cria constraints de origem e ocorrência;
- adiciona sessão opaca e batches de importação.

Validação mínima antes da release:

```bash
DATABASE_URL=postgresql://finance:finance@localhost:5432/finance_empty_test pnpm db:migrate
DATABASE_URL=postgresql://finance:finance@localhost:5432/finance_upgrade_test node apps/backend/test/migrations/upgrade-check.mjs
```

Use apenas bancos descartáveis. Não há migration down automática; backup operacional do PostgreSQL é obrigatório antes de upgrade de produção.

## Índices importantes

- transações por usuário/data, conta, cartão, categoria, origem e tipo/data;
- cards/accounts/categories por usuário e estado;
- ocorrências por usuário/status e competência;
- refresh por usuário/família e expiração;
- batches por usuário/status e expiração;
- histórico importado por usuário/data.

Índices e constraints são parte do contrato de concorrência, não apenas otimização.
