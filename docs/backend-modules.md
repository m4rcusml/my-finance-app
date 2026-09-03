# Módulos do backend

A API fica em `apps/backend/src`. O `AppModule` compõe módulos de infraestrutura e domínio; rotas são privadas por padrão pelo guard global.

## Infraestrutura

| Módulo/pasta | Responsabilidade |
|---|---|
| `config` | carrega e valida ambiente no boot |
| `prisma` | cliente Prisma 7 via adapter PostgreSQL |
| `common` | paginação adaptada aos contratos, datas civis, dinheiro, ownership, request ID, logs e filtro de erros |
| `health` | `/health/live` e `/health/ready` públicos |
| `decorators` | `@Public()` e `@CurrentUser()` |

`main.ts` configura prefixo, CORS com credentials, Helmet, cookies, validação, Swagger opcional e filtros/interceptors globais.

## Autenticação e usuários

### `AuthModule`

- cadastro e login com Argon2;
- JWT curto para access token;
- refresh opaco de 256 bits;
- hash SHA-256 e família persistidos em `RefreshToken`;
- rotação atômica e detecção de replay;
- CSRF de duplo envio para refresh;
- rate limiting específico;
- guard Bearer global.

Falha de e-mail desconhecido e senha errada usa a mesma mensagem e custo de verificação.

### `UsersModule`

- leitura e edição do perfil;
- confirmação da senha ao trocar e-mail;
- troca de senha com revogação de sessões;
- exclusão reforçada da conta.

## Ledger principal

### `AccountsModule`

CRUD, saldo derivado de `initialBalance + receitas - despesas`, paginação e archive/restore. Conta do tipo `investment` é separada do caixa no dashboard.

### `CreditCardsModule`

CRUD, archive/restore e cálculo de uso por ciclo aberto. Cada cartão resolve seu intervalo com `closingDay`; dia inexistente em mês curto é limitado ao último dia.

### `CategoriesModule`

CRUD e archive/restore. A chave natural por usuário é `(name, type)`. Tipo `both` é compatível com receita e despesa.

### `TransactionsModule`

- criação, leitura, PATCH e remoção;
- paginação e filtros;
- relações nomeadas para a UI;
- fila sem categoria;
- resumo por intervalo;
- projeção com meses completos;
- invariantes de categoria, ownership e origem XOR.

Agregados usados pelo dashboard são consultas dedicadas e não somas de uma página.

### `DashboardModule`

Orquestra accounts, cards, transactions, investments e occurrences. Resolve janela atual e anterior no timezone configurado, retorna série de 12 meses e separa caixa, conta-investimento e carteira manual.

## Recorrências

### `FixedTransactionsModule`

Gerencia modelos mensais e ocorrências.

Modelos guardam dia de referência, margem, valor, categoria e uma origem. Alterações propagam somente a snapshots futuros pendentes. Arquivar remove apenas placeholders futuros sem transação; histórico final permanece.

Ocorrências guardam snapshot do modelo. A confirmação cria a transação e reivindica o status dentro de uma transação; concorrência deixa apenas um vencedor. A ação skip também reivindica apenas estado `pending`.

### `JobsModule`

Executa geração diária às 03:00 em `APP_TIMEZONE`, quando `ENABLE_CRON=true`. Usa upsert pela competência, processa modelos em páginas, faz backfill dos dois meses anteriores e isola falhas por modelo.

## Planejamento manual

### `MarketDataModule`

O nome histórico do módulo não significa cotação. Ele expõe somente CRUD de `MarketAsset`, um catálogo manual por usuário. Não há preço, refresh externo ou cache de mercado.

### `InvestmentsModule`

CRUD de posições/aportes e sumário por custo de aquisição. Quantidade tem oito casas; `investedAmount` pode ser informado ou calculado por quantidade × preço de compra.

### `GoalsModule`

CRUD e atualização de `currentAmount`. O progresso é `currentAmount / targetAmount`, limitado entre 0 e 1, e sempre tem fonte `manual`. Relações com conta/categoria são opcionais e não automatizam o progresso.

## Entrada e portabilidade

### `ImportsModule`

- valida arquivo e tamanho;
- resolve CSV, OFX ou planilha pelo conteúdo e extensão;
- normaliza layouts `inter` e `generic`;
- persiste batch e linhas da prévia;
- calcula `externalId`;
- confirma por números de linha;
- revalida destino e duplicatas;
- grava transações e histórico em uma transação;
- pagina histórico.

Batches expiram e são estado transitório.

### `BackupModule`

Exporta JSON com versão e todo o ledger durável do usuário, inclusive snapshots de recorrência. Exclui credenciais, refresh tokens e batches de preview.

Restaura em `replace` ou `merge`, remapeia IDs e referências, escreve em chunks e confirma que nenhuma relação cruzou tenant. A operação inteira usa uma transação.

## Convenções de implementação

Um módulo de domínio normalmente contém:

```text
<domain>.module.ts
<domain>.controller.ts
<domain>.service.ts
<domain>.dto.ts
<domain>.service.spec.ts
```

Alguns domínios possuem mapper, parser ou controller secundário quando isso reduz a interface principal.

Regras:

- controller traduz HTTP; regra de domínio fica no service;
- DTO valida a entrada e documenta Swagger;
- retorno deve cumprir `@finance/contracts`;
- ownership é obrigatório em toda consulta por ID;
- erro cross-tenant é 404;
- operação composta/concor­rente usa transação;
- listas usam paginação compartilhada;
- agregados são calculados no banco;
- não introduza abstração vazia de repository.

## Inicialização

O backend não executa migrations durante o boot normal. Em container, `docker-entrypoint.sh` executa `prisma migrate deploy` e depois inicia o artefato. Fora do container, o operador deve executar `pnpm db:migrate` antes de `start:prod`.

O build esperado é `apps/backend/dist/main.js`. Não trate a presença de código-fonte typecheckado como prova de artefato; valide o arquivo e faça smoke real.
