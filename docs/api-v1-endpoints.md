# Endpoints da API V1

A base dos endpoints de negócio é `/api/v1`. Salvo indicação de “público”, envie `Authorization: Bearer <accessToken>`. Coleções aceitam `page` e `limit` e retornam `{ data, meta }`.

Swagger, quando `ENABLE_SWAGGER=true`, é servido em `/api/v1/docs`. Os DTOs/Swagger são a referência de campos e validações; os tipos de transporte ficam em `packages/contracts`.

## Health, fora do prefixo

| Método | Caminho | Auth | Resultado |
|---|---|---:|---|
| GET | `/health/live` | público | processo vivo, sem tocar o banco |
| GET | `/health/ready` | público | 200 com banco disponível; 503 sem banco |

## Autenticação

| Método | Caminho | Auth | Resultado |
|---|---|---:|---|
| POST | `/api/v1/auth/register` | público | cria usuário, devolve sessão e define cookies |
| POST | `/api/v1/auth/login` | público | autentica sem enumerar e-mail |
| GET | `/api/v1/auth/csrf` | público | define cookie CSRF e devolve `{ csrfToken }` |
| POST | `/api/v1/auth/refresh` | cookie + CSRF | rotaciona refresh e devolve nova sessão |
| POST | `/api/v1/auth/logout` | Bearer | revoga a sessão atual e limpa cookies |
| GET | `/api/v1/auth/me` | Bearer | perfil autenticado |

Cadastro e login recebem e-mail/senha; cadastro aceita nome opcional. Sessão devolve `accessToken`, `expiresIn` e `user`. Refresh exige `X-CSRF-Token` pareado com o cookie obtido em `/auth/csrf`.

## Usuário

| Método | Caminho | Resultado |
|---|---|---|
| GET | `/api/v1/users/me` | perfil |
| PATCH | `/api/v1/users/me` | altera nome e/ou e-mail; mudança de e-mail exige senha atual |
| PATCH | `/api/v1/users/me/password` | troca senha com senha atual |
| DELETE | `/api/v1/users/me` | exclui conta após senha e literal de confirmação |

A confirmação de exclusão é `EXCLUIR MINHA CONTA`.

## Contas

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/accounts` | cria conta |
| GET | `/api/v1/accounts` | lista paginada |
| GET | `/api/v1/accounts/:id` | obtém conta com saldo calculado |
| PATCH | `/api/v1/accounts/:id` | altera conta |
| DELETE | `/api/v1/accounts/:id` | remove sem histórico ou arquiva |
| POST | `/api/v1/accounts/:id/archive` | arquiva |
| POST | `/api/v1/accounts/:id/restore` | restaura |

Query de lista: `page`, `limit`, `includeArchived`.

Campos principais: `name`, `institution`, `type`, `initialBalance`. Tipos: `checking`, `savings`, `investment`, `cash`, `other`.

## Cartões

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/credit-cards` | cria cartão |
| GET | `/api/v1/credit-cards` | lista paginada com ciclo atual |
| GET | `/api/v1/credit-cards/:id` | obtém cartão |
| PATCH | `/api/v1/credit-cards/:id` | altera cartão |
| DELETE | `/api/v1/credit-cards/:id` | remove sem histórico ou arquiva |
| POST | `/api/v1/credit-cards/:id/archive` | arquiva |
| POST | `/api/v1/credit-cards/:id/restore` | restaura |

Query de lista: `page`, `limit`, `includeArchived`.

Campos principais: `name`, `institution`, `limitTotal`, `closingDay?`. A resposta inclui `cycleUsedAmount`, `availableAmount` e `currentCycle`.

## Categorias

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/categories` | cria categoria |
| GET | `/api/v1/categories` | lista paginada |
| GET | `/api/v1/categories/:id` | obtém categoria |
| PATCH | `/api/v1/categories/:id` | altera categoria |
| DELETE | `/api/v1/categories/:id` | remove sem histórico ou arquiva |
| POST | `/api/v1/categories/:id/archive` | arquiva |
| POST | `/api/v1/categories/:id/restore` | restaura |

Query: `page`, `limit`, `includeArchived`, `type`. Tipos: `income`, `expense`, `both`. Categorias em lançamentos precisam ser `both` ou corresponder ao tipo; PATCH devolve 409 se uma troca de tipo invalidaria o histórico.

## Transações

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/transactions` | cria lançamento manual |
| GET | `/api/v1/transactions` | lista paginada com relações nomeadas |
| GET | `/api/v1/transactions/uncategorized` | lista paginada sem categoria |
| GET | `/api/v1/transactions/summary` | totais no intervalo |
| GET | `/api/v1/transactions/projection` | média mensal projetada |
| GET | `/api/v1/transactions/:id` | obtém lançamento |
| PATCH | `/api/v1/transactions/:id` | altera, inclusive relações com `null` explícito |
| DELETE | `/api/v1/transactions/:id` | remove lançamento |

Filtros da lista: `type`, `source`, `fromDate`, `toDate`, `accountId`, `creditCardId`, `categoryId`, `page`, `limit`.

Resumo exige `from` e `to`. Projeção aceita `months`. Create/PATCH usam `date` civil e exatamente uma origem, `accountId` ou `creditCardId`.

## Dashboard

| Método | Caminho | Resultado |
|---|---|---|
| GET | `/api/v1/dashboard` | visão agregada da janela |

Query:

- `period=week|month|year|custom`;
- `referenceDate=YYYY-MM-DD`;
- `from` e `to` obrigatórios em `custom`.

A resposta contém janela resolvida, totais atual/anterior, tendências, saldos separados, cartões no ciclo, últimas transações, pendências, 12 meses e contagem sem categoria.

## Lançamentos recorrentes

### Modelos

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/fixed-transactions` | cria modelo mensal |
| GET | `/api/v1/fixed-transactions` | lista paginada |
| GET | `/api/v1/fixed-transactions/:id` | obtém modelo |
| PATCH | `/api/v1/fixed-transactions/:id` | altera modelo e snapshots futuros elegíveis |
| POST | `/api/v1/fixed-transactions/:id/archive` | arquiva |
| POST | `/api/v1/fixed-transactions/:id/restore` | restaura |
| DELETE | `/api/v1/fixed-transactions/:id` | arquiva; não apaga histórico |

Query: `page`, `limit`, `isActive`, `type`.

Payload principal: `type`, `value`, `referenceDay`, `marginDays?`, `categoryId`, uma origem e `description?`. Criar, trocar vínculos ou restaurar exige recursos ativos e categoria compatível.

### Ocorrências

| Método | Caminho | Resultado |
|---|---|---|
| GET | `/api/v1/fixed-transactions/occurrences` | lista snapshots paginados |
| GET | `/api/v1/fixed-transactions/occurrences/:id` | obtém ocorrência |
| POST | `/api/v1/fixed-transactions/occurrences/:id/confirm` | confirma e cria transação |
| POST | `/api/v1/fixed-transactions/occurrences/:id/skip` | ignora ocorrência |

Filtros: `year`, `month`, `status`, `fixedTransactionId`, `page`, `limit`. Confirmação aceita `realDate?` e `value?`.

## Investimentos e ativos

### Ativos manuais

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/market-assets` | cria cadastro do ativo |
| GET | `/api/v1/market-assets` | lista paginada |
| GET | `/api/v1/market-assets/:id` | obtém ativo |
| PATCH | `/api/v1/market-assets/:id` | altera ativo |
| DELETE | `/api/v1/market-assets/:id` | remove se não usado |

Campos: `symbol`, `type`, `exchange`, `name?`. A rota não consulta preços.

### Posições

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/investments` | registra posição/aporte manual |
| GET | `/api/v1/investments` | lista paginada |
| GET | `/api/v1/investments/summary` | custo total e agrupamento por tipo |
| GET | `/api/v1/investments/:id` | obtém posição |
| PATCH | `/api/v1/investments/:id` | altera posição |
| DELETE | `/api/v1/investments/:id` | remove posição |

Filtros: `type`, `marketAssetId`, `page`, `limit`. Valores representam custo de aquisição, não preço atual.

## Metas

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/goals` | cria meta |
| GET | `/api/v1/goals` | lista paginada |
| GET | `/api/v1/goals/:id/progress` | lê progresso manual |
| PATCH | `/api/v1/goals/:id/progress` | altera `currentAmount` |
| GET | `/api/v1/goals/:id` | obtém meta |
| PATCH | `/api/v1/goals/:id` | altera meta |
| DELETE | `/api/v1/goals/:id` | remove meta |

Campos: `name`, `type`, `targetAmount`, `currentAmount?`, `deadline?`, `relatedCategoryId?`, `relatedAccountId?`. A resposta usa `progressSource: manual`.

## Importação

| Método | Caminho | Resultado |
|---|---|---|
| POST | `/api/v1/imports/preview` | upload multipart e prévia persistida |
| POST | `/api/v1/imports/:batchId/confirm` | confirma linhas do batch |
| GET | `/api/v1/imports` | histórico paginado |
| GET | `/api/v1/imports/:batchId` | consulta batch/prévia |

Preview recebe `file` e `origin=inter|generic`. Tipos reconhecidos: CSV, OFX/QFX e XLSX/XLS/XLSM, sujeitos à inspeção do conteúdo.

Confirmação recebe exatamente um destino (`accountId` ou `creditCardId`) e `rowNumbers?`. Ela não aceita lançamentos arbitrários enviados pelo cliente.

## Backup

| Método | Caminho | Resultado |
|---|---|---|
| GET | `/api/v1/backup/export` | baixa JSON versionado |
| POST | `/api/v1/backup/restore` | restaura o grafo do usuário |

Restore recebe:

```json
{
  "mode": "merge",
  "data": { "schemaVersion": 1 }
}
```

A confirmação destrutiva de `replace` pertence à interface. A API valida o arquivo e executa toda a restauração numa transação.

## Respostas comuns

- criação: normalmente 201;
- consulta/alteração/ação: 200;
- remoção sem corpo: 204;
- DTO inválido: 400;
- sessão ausente/inválida: 401;
- CSRF inválido: 403;
- outro tenant ou ID inexistente: 404;
- estado/duplicidade/concorrência: 409;
- payload grande: 413;
- formato não aceito: 415 ou 422;
- limite: 429;
- banco indisponível na readiness: 503.

Veja [`api-conventions.md`](api-conventions.md) para os envelopes completos.
