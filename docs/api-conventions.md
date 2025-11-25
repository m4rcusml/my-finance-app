# 🌐 Convenções da API

Esta seção define os padrões gerais adotados pela API, incluindo:

* Estrutura de URLs
* Versionamento
* Identificadores (IDs)
* Formato de datas
* Paginação
* Convenções de nomeação
* Modelo padrão de erros

O objetivo é garantir consistência, previsibilidade e facilitar a evolução futura da API (novas versões, novos clientes, etc.).

## 1. Base da API e Versionamento

Toda a API pública será exposta sob o prefixo:

```text
/api/v1
```

Exemplos de endpoints:

* `GET /api/v1/accounts`
* `POST /api/v1/transactions`
* `GET /api/v1/dashboard`
* `POST /api/v1/auth/login`

Futuramente, novas versões poderão ser adicionadas (`/api/v2`, etc.) sem breaking changes na v1.

## 2. Identificadores (IDs)

Todos os recursos principais da API utilizarão **UUIDs** como identificadores, tanto no banco quanto nas respostas da API.

* Tipo: UUID v4 (string)
* Exemplo: `"c0f3a229-7c39-4f25-9e2f-f1e6b0b118b2"`

Exemplos:

```json
{
  "id": "c0f3a229-7c39-4f25-9e2f-f1e6b0b118b2",
  "name": "Conta Inter"
}
```

## 3. Formato de datas e horários

Datas e horários serão sempre representados em **ISO 8601**, em formato de string.

* Exemplo de data e hora completa (UTC ou com offset):
  `2025-11-25T14:30:00Z`
  `2025-11-25T14:30:00-03:00`

* Exemplo de data (somente dia/mês/ano), quando fizer sentido:
  `2025-11-25`

A responsabilidade de conversão de fuso horário e formatação local é do frontend.

## 4. Formato de dados e JSON

Todas as requisições e respostas (quando houver corpo) utilizarão:

* **Content-Type**: `application/json`
* Convenção de campos: **camelCase**

  * Exemplo: `createdAt`, `accountId`, `totalSpent`

## 5. Convenção de URLs e Recursos

### 5.1. Recursos no plural

Endpoints de recursos seguirão o padrão em **plural**, em inglês:

* `/accounts`
* `/credit-cards`
* `/transactions`
* `/fixed-transactions`
* `/investments`
* `/goals`
* `/imports`
* `/market-data`

Sempre prefixados com `/api/v1`.

### 5.2. Operações padrão REST

Operações CRUD seguem a convenção:

* `GET /api/v1/resource` → listar
* `GET /api/v1/resource/:id` → buscar por ID
* `POST /api/v1/resource` → criar
* `PATCH /api/v1/resource/:id` → atualizar parcialmente
* `DELETE /api/v1/resource/:id` → remover

## 6. Autenticação

Inicialmente haverá apenas **um tipo de usuário**, mas a API já será preparada para evolução futura.

* Autenticação via **JWT** (Bearer Token).
* O token será enviado no header:

```http
Authorization: Bearer <token>
```

* Endpoints públicos:

  * `/api/v1/auth/login`
* Todos os demais endpoints serão protegidos por autenticação (salvo definição explícita em contrário no futuro).

## 7. Paginação

Para listagens potencialmente grandes (ex.: transações, investimentos), a API utilizará paginação baseada em **page** + **limit**, que é o padrão mais comum no ecossistema Node/Nest/REST.

### 7.1. Parâmetros de consulta

* `page`: número da página (inteiro ≥ 1).

  * Default: `1`
* `limit`: quantidade de itens por página.

  * Default: `20` (ou valor a ser definido)
  * Máximo sugerido: `100`

Exemplo de request:

```http
GET /api/v1/transactions?page=2&limit=50
```

### 7.2. Formato da resposta paginada

Respostas paginadas seguem o padrão:

```json
{
  "data": [
    {
      "id": "c0f3a229-7c39-4f25-9e2f-f1e6b0b118b2",
      "type": "expense",
      "value": 120.5,
      "date": "2025-11-25T14:30:00Z",
      "categoryId": "e67159cc-8dc9-4bb2-9f2a-32a5bb6c7d5d"
    }
    // ...
  ],
  "meta": {
    "page": 2,
    "limit": 50,
    "totalItems": 345,
    "totalPages": 7
  }
}
```

* `data`: lista de itens da página atual.
* `meta`: informações de paginação.

Mesmo que algumas listas não sejam inicialmente paginadas, a ideia é padronizar esse formato para facilitar a evolução futura.

## 8. Convenção de Sucesso (Respostas HTTP)

### 8.1. Códigos de status

* `200 OK` – requisição bem sucedida (GET, PATCH).
* `201 Created` – recurso criado com sucesso (POST).
* `204 No Content` – ação realizada sem corpo de resposta (DELETE, algumas operações de confirmação).
* `400 Bad Request` – erro de validação em entrada de dados.
* `401 Unauthorized` – token ausente ou inválido.
* `403 Forbidden` – acesso negado (caso existam regras de permissão no futuro).
* `404 Not Found` – recurso não encontrado.
* `409 Conflict` – conflitos de domínio (duplicatas, regras de negócio).
* `500 Internal Server Error` – erro inesperado do servidor.

# ❌ Modelo de Erros da API

Todas as respostas de erro seguirão um **formato padrão**, independentemente do módulo que gerou o erro.

## 1. Estrutura base de erro

Formato geral:

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Um ou mais campos são inválidos.",
  "details": null,
  "timestamp": "2025-11-25T14:30:00Z",
  "path": "/api/v1/transactions"
}
```

### Campos

* `statusCode` (number)
  Código HTTP correspondente ao erro (ex.: 400, 401, 404, 500).

* `error` (string)
  Um código curto e estável representando o tipo do erro. Exemplos:

  * `VALIDATION_ERROR`
  * `AUTHENTICATION_ERROR`
  * `AUTHORIZATION_ERROR`
  * `NOT_FOUND`
  * `CONFLICT`
  * `INTERNAL_SERVER_ERROR`
  * `IMPORT_PARSE_ERROR`
  * `DUPLICATE_TRANSACTION`
  * etc.

* `message` (string)
  Mensagem descritiva, legível para humanos.

* `details` (object | array | null)
  Detalhes adicionais opcionais, úteis para validação ou debug.
  Exemplo para erros de validação:

  ```json
  "details": [
    {
      "field": "value",
      "message": "O campo 'value' é obrigatório."
    },
    {
      "field": "date",
      "message": "A data informada é inválida."
    }
  ]
  ```

* `timestamp` (string)
  Data/hora do erro em formato ISO 8601.

* `path` (string)
  Caminho da requisição que gerou o erro (ex.: `/api/v1/transactions`).

## 2. Exemplos por tipo de erro

### 2.1. Erro de validação (`400 Bad Request`)

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Um ou mais campos são inválidos.",
  "details": [
    {
      "field": "value",
      "message": "O campo 'value' deve ser maior que zero."
    }
  ],
  "timestamp": "2025-11-25T14:30:00Z",
  "path": "/api/v1/transactions"
}
```

### 2.2. Erro de autenticação (`401 Unauthorized`)

```json
{
  "statusCode": 401,
  "error": "AUTHENTICATION_ERROR",
  "message": "Token de autenticação ausente ou inválido.",
  "details": null,
  "timestamp": "2025-11-25T14:30:00Z",
  "path": "/api/v1/accounts"
}
```

### 2.3. Recurso não encontrado (`404 Not Found`)

```json
{
  "statusCode": 404,
  "error": "NOT_FOUND",
  "message": "Transação não encontrada.",
  "details": null,
  "timestamp": "2025-11-25T14:30:00Z",
  "path": "/api/v1/transactions/c0f3a229-7c39-4f25-9e2f-f1e6b0b118b2"
}
```

### 2.4. Erro interno (`500 Internal Server Error`)

```json
{
  "statusCode": 500,
  "error": "INTERNAL_SERVER_ERROR",
  "message": "Ocorreu um erro inesperado. Tente novamente mais tarde.",
  "details": null,
  "timestamp": "2025-11-25T14:30:00Z",
  "path": "/api/v1/dashboard"
}
```

## 3. Comportamento esperado

* **Todos os erros** retornados pela API devem seguir essa estrutura.
* O frontend pode confiar que sempre receberá:

  * `statusCode`
  * `error`
  * `message`
  * `timestamp`
  * `path`
  * e opcionalmente `details`

Isso facilita o tratamento de erros de forma centralizada na aplicação cliente.
