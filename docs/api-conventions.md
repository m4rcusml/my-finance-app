# Convenções da API V1

## Endereços

- base de negócio: `/api/v1`;
- Swagger, quando habilitado: `/api/v1/docs`;
- liveness pública: `/health/live`;
- readiness pública: `/health/ready`.

Clientes devem configurar a base já com `/api/v1`. Não concatene o prefixo duas vezes.

## Autenticação

Rotas privadas recebem:

```http
Authorization: Bearer <access-token>
```

O access token é retornado no JSON e não deve ser persistido no navegador. O refresh token nunca aparece no corpo: ele é um cookie `HttpOnly`.

Fluxo de renovação:

```text
GET  /api/v1/auth/csrf
  -> Set-Cookie: csrf_token=...
  -> { "csrfToken": "..." }

POST /api/v1/auth/refresh
Cookie: refresh_token=...; csrf_token=...
X-CSRF-Token: <valor recebido acima>
  -> novo access token e cookies rotacionados
```

Possíveis respostas do refresh:

- 200: sessão renovada;
- 403: par CSRF ausente ou divergente;
- 409: outra chamada legítima já reivindicou o token na janela de concorrência;
- 401: sessão inválida, expirada ou reuso conhecido fora da janela;
- 429: limite de tentativas.

Cadastro, login e refresh têm limite específico de 10 tentativas por minuto por IP, além do limite global.

## JSON, multipart e codificação

- JSON usa UTF-8 e `Content-Type: application/json`;
- upload de importação usa `multipart/form-data`; o cliente não define o boundary manualmente;
- nomes e mensagens de interface estão em pt-BR;
- IDs são UUIDs e não devem ser apresentados como rótulo humano.

## Enums

Valores fechados são minúsculos, conforme `packages/contracts/src/enums.ts`. Exemplos:

```json
{
  "accountType": "checking",
  "categoryType": "expense",
  "transactionSource": "imported",
  "occurrenceStatus": "pending",
  "investmentType": "fixed_income"
}
```

A API não normaliza variantes maiúsculas.

## Datas

Uma data financeira é uma string civil, sem horário ou timezone:

```json
{ "date": "2026-09-03" }
```

Formato aceito: `YYYY-MM-DD`, com validação de calendário, inclusive ano bissexto. O intervalo `fromDate`/`toDate` é inclusivo.

Instantes de auditoria usam ISO-8601:

```json
{ "createdAt": "2026-09-03T18:42:00.000Z" }
```

Nunca converta uma data civil para meia-noite local antes de enviá-la.

## Dinheiro e quantidades

Dinheiro é número JSON com até duas casas:

```json
{ "value": 1234.56 }
```

O banco usa `numeric(15,2)`. Quantidades de investimento aceitam até oito casas e usam `numeric(15,8)`.

Não envie valores monetários como strings formatadas, símbolos de moeda ou separador de milhar.

## Paginação

Toda rota de coleção retorna:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

Regras:

- `page` começa em 1;
- `limit` padrão é 20;
- `limit` máximo é 100;
- filtros não alteram o formato;
- resposta vazia não é um array solto.

Listas pequenas embutidas no dashboard não são endpoints de coleção e, portanto, são arrays.

## PATCH e `null`

Em atualizações:

- campo omitido: preserva o valor atual;
- campo com `null`: limpa uma relação/campo opcional, quando o contrato permite;
- valor presente: substitui.

Exemplo de troca de conta para cartão:

```json
{
  "accountId": null,
  "creditCardId": "9ce4c771-e228-43c9-947f-e6493ca75e64"
}
```

O estado final continua sujeito ao XOR de origem.

## Origem única

Transação, modelo recorrente e snapshot de ocorrência exigem exatamente uma origem:

```text
accountId preenchido  + creditCardId nulo
ou
accountId nulo        + creditCardId preenchido
```

Zero ou duas origens retornam 400. PostgreSQL também possui constraints `CHECK`.

## Arquivamento

`DELETE` de conta, cartão ou categoria:

- remove se o recurso não possui dependências;
- arquiva se há histórico.

As rotas explícitas `POST /:id/archive` e `POST /:id/restore` controlam o estado. Recursos arquivados podem aparecer com `includeArchived=true`, mas não aceitam novos lançamentos.

Categorias `income`/`expense` só podem ser ligadas ao mesmo tipo de lançamento; `both` aceita ambos. A alteração de tipo de uma categoria retorna 409 quando vínculos históricos se tornariam incompatíveis.

Para recorrências, `DELETE` equivale sempre a arquivar.

## Erros

Qualquer erro HTTP usa:

```json
{
  "statusCode": 400,
  "error": "validation_failed",
  "message": "Alguns campos estão inválidos.",
  "details": ["date deve ser uma data válida no formato YYYY-MM-DD."],
  "timestamp": "2026-09-03T18:42:00.000Z",
  "path": "/api/v1/transactions",
  "requestId": "3dd5032d-52b8-40a7-a24a-853984248b2d"
}
```

Códigos possíveis:

- `bad_request`;
- `validation_failed`;
- `unauthorized`;
- `forbidden`;
- `not_found`;
- `conflict`;
- `payload_too_large`;
- `unsupported_media_type`;
- `unprocessable_entity`;
- `too_many_requests`;
- `internal_error`.

`message` é segura para exibição. Detalhes internos ficam nos logs e são correlacionados por `requestId`. O cliente pode enviar `X-Request-Id`; se não enviar, a API cria um.

## Tenancy

Todo acesso usa o usuário do access token. Um recurso de outro usuário retorna o mesmo 404 de um ID inexistente. Consultas globais de ativos legados não são expostas como recursos de outro usuário.

## Concorrência e idempotência

- refresh: lock de linha e um único sucessor;
- confirmação de ocorrência: claim condicional sobre `status: pending`;
- importação: batch persistido, `externalId` determinístico e índice único parcial;
- backup: uma transação cobre purge, inserção e auditoria de referências;
- geração de ocorrência: chave única por modelo/ano/mês e `upsert`.

409 sinaliza conflito de estado ou corrida legítima; não deve ser convertido automaticamente em logout.

## Health

`GET /health/live` prova apenas que o processo responde. `GET /health/ready` executa `SELECT 1`:

```json
{ "status": "ok", "checks": { "database": "ok" } }
```

Sem banco, readiness retorna HTTP 503 e corpo com status de erro, sem detalhes de conexão.

## Fonte canônica

Tipos e formatos: `packages/contracts`. Validação concreta e exemplos Swagger: DTOs em `apps/backend/src`. A lista de endpoints está em [`api-v1-endpoints.md`](api-v1-endpoints.md).
