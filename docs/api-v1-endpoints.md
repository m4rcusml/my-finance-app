# 🌐 API v1 — Mapa de Endpoints

Base de todos os endpoints:

```text
/ api / v1 / ...
```

Todas as rotas (exceto `auth`) requerem:

```http
Authorization: Bearer <jwt>
```

Paginação quando aplicável:

* `?page=` (default: 1)
* `?limit=` (default: 20, máx: 100)

## 1. 🔑 Auth & User

### 1.1. Auth

**POST `/api/v1/auth/login`**
Autentica o usuário e retorna um JWT.

* Body: `{ email, password }`
* Respostas:

  * `200 OK` com token e dados básicos do usuário
  * `401 AUTHENTICATION_ERROR` se credenciais inválidas

> *Opcional/futuro: `/auth/register`, `/auth/refresh`.*

### 1.2. User

**GET `/api/v1/auth/me`**
Retorna informações do usuário autenticado.

* Respostas:

  * `200 OK` com dados do user
  * `401 AUTHENTICATION_ERROR` se token inválido/ausente

## 2. 🧾 Accounts (Contas Bancárias)

### 2.1. Listar contas

**GET `/api/v1/accounts`**
Lista todas as contas do usuário (paginação opcional).

* Query: `page`, `limit`
* Resposta: `200 OK` com `{ data, meta }`

### 2.2. Obter conta por ID

**GET `/api/v1/accounts/:id`**

### 2.3. Criar conta

**POST `/api/v1/accounts`**

* Body: name, institution, type, initialBalance…

### 2.4. Atualizar conta

**PATCH `/api/v1/accounts/:id`**

### 2.5. Desativar/remover conta

**DELETE `/api/v1/accounts/:id`**
Provavelmente marcará como `isActive = false` em vez de apagar de fato (decisão sua depois).

## 3. 💳 Credit Cards (Cartões de Crédito)

### 3.1. Listar cartões

**GET `/api/v1/credit-cards`**

### 3.2. Obter cartão por ID

**GET `/api/v1/credit-cards/:id`**

### 3.3. Criar cartão

**POST `/api/v1/credit-cards`**

### 3.4. Atualizar cartão

**PATCH `/api/v1/credit-cards/:id`**

### 3.5. Desativar/remover cartão

**DELETE `/api/v1/credit-cards/:id`**

## 4. 🏷 Categories (Categorias)

### 4.1. Listar categorias

**GET `/api/v1/categories`**

### 4.2. Obter categoria por ID

**GET `/api/v1/categories/:id`**

### 4.3. Criar categoria

**POST `/api/v1/categories`**

### 4.4. Atualizar categoria

**PATCH `/api/v1/categories/:id`**

### 4.5. Remover categoria

**DELETE `/api/v1/categories/:id`**

## 5. 💸 Transactions (Transações)

### 5.1. Listar transações

**GET `/api/v1/transactions`**

* Query:

  * `page`, `limit`
  * Filtros:

    * `type` (income/expense)
    * `accountId`
    * `creditCardId`
    * `categoryId`
    * `fromDate`, `toDate` (ISO)
* Resposta: `200 OK` com `{ data, meta }`

### 5.2. Listar transações sem categoria

**GET `/api/v1/transactions/uncategorized`**

* Mesmo esquema de paginação/ filtros de período.

### 5.3. Obter transação por ID

**GET `/api/v1/transactions/:id`**

### 5.4. Criar transação

**POST `/api/v1/transactions`**

* Body: type, value, date, accountId/creditCardId, categoryId?, description, etc.

### 5.5. Atualizar transação

**PATCH `/api/v1/transactions/:id`**

### 5.6. Excluir transação

**DELETE `/api/v1/transactions/:id`**

### 5.7. Total de gastos por período

**GET `/api/v1/transactions/summary`**

* Query:

  * `granularity` = `week` | `month` | `year`
  * `fromDate`, `toDate` (opcional)
* Retorno: agregados por período (ex.: total por semana/mês/ano)

### 5.8. Projeção de gastos

**GET `/api/v1/transactions/projection`**

* Query: ex.: `nextMonths=1` (ou outro parâmetro que você definir)
* Retorno: projeção de gastos do mês seguinte com base em padrão histórico.

## 6. 🔁 Fixed Transactions (Transações Fixas)

### 6.1. Listar transações fixas

**GET `/api/v1/fixed-transactions`**

### 6.2. Obter transação fixa por ID

**GET `/api/v1/fixed-transactions/:id`**

### 6.3. Criar transação fixa

**POST `/api/v1/fixed-transactions`**

* Body: type, value, referenceDay, marginDays, accountId/creditCardId, categoryId, description, isActive

### 6.4. Atualizar transação fixa

**PATCH `/api/v1/fixed-transactions/:id`**

### 6.5. Ativar/desativar transação fixa

**PATCH `/api/v1/fixed-transactions/:id/status`**

* Body: `{ isActive: boolean }` (opcional ter um endpoint específico)

### 6.6. Remover transação fixa

**DELETE `/api/v1/fixed-transactions/:id`**

### 6.7. Ocorrências de transações fixas

**GET `/api/v1/fixed-transactions/occurrences`**

* Lista ocorrências por:

  * `status` (pending/confirmed/skipped)
  * `year`, `month`
* Útil para tela de “transações fixas do mês” e histórico.

**PATCH `/api/v1/fixed-transactions/occurrences/:id/confirm`**

* Confirma ocorrência → cria `Transaction` real e vincula.

**PATCH `/api/v1/fixed-transactions/occurrences/:id/skip`**

* Marca a ocorrência como “pulada” (não será gerada transação naquele período).

## 7. 📈 Investments & Market Assets

### 7.1. Investimentos

**GET `/api/v1/investments`**

* Lista investimentos do usuário (pode ter filtros por tipo, corretora etc.)

**GET `/api/v1/investments/:id`**

**POST `/api/v1/investments`**

**PATCH `/api/v1/investments/:id`**

**DELETE `/api/v1/investments/:id`**

### 7.2. Market Assets (se você quiser expor)

**GET `/api/v1/market-assets`**

* Lista de ativos cadastrados (ações, FIIs, criptos).

**POST `/api/v1/market-assets`**
(criar manualmente ativos se não vierem de API, opcional)

## 8. 💹 Market Data (Dados de Mercado)

### 8.1. Consultar preços atuais

**GET `/api/v1/market-data/prices`**

* Query:

  * `symbols=PETR4,MXRF11,BTC`
* Resposta:

  * Lista de `{ symbol, type, price, currency, lastUpdate }`

> Internamente, esse módulo chama a API externa de mercado / usa cache.

### 8.2. Atualizar cache manualmente (admin/futuro)

**POST `/api/v1/market-data/refresh`**
(opcional, pode ser usado apenas por jobs e não exposto ao frontend)

## 9. 🎯 Goals (Metas)

### 9.1. Listar metas

**GET `/api/v1/goals`**

### 9.2. Obter meta por ID

**GET `/api/v1/goals/:id`**

### 9.3. Criar meta

**POST `/api/v1/goals`**

* Body: name, type, targetAmount, deadline, relatedCategoryId?, relatedAccountId?, etc.

### 9.4. Atualizar meta

**PATCH `/api/v1/goals/:id`**

### 9.5. Remover meta

**DELETE `/api/v1/goals/:id`**

### 9.6. Detalhes / progresso de uma meta

**GET `/api/v1/goals/:id/progress`**

* Retorno:

  * valores atuais calculados (com base em transactions/contas/investments)
  * percentual atingido
  * eventualmente previsões (se você implementar).

## 10. 📊 Dashboard

### 10.1. Resumo geral

**GET `/api/v1/dashboard`**

* Query:

  * `referenceDate` (opcional, ex.: `2025-11-01`) para dashboard focado em um mês específico
* Retorno típico:

  * saldo total (sem investimentos)
  * saldo por conta
  * saldo investido
  * limite de cartão (total e por cartão)
  * gastos por período (semana/mês/ano)
  * algum resumo de metas/investimentos

> Este endpoint é um agregador: ele consome `Accounts`, `Transactions`, `CreditCards`, `Investments`, `Goals` internamente.

## 11. 📥 Imports (Importação de Arquivos)

### 11.1. Upload + pré-visualização (2-step flow recomendado)

**POST `/api/v1/imports/preview`**

* Upload do arquivo de extrato (Inter, MP, BTG, Binance, etc.)
* Body: multipart/form-data com arquivo + metadados de origem

  * `origin` = `'inter' | 'mercado_pago' | 'btg' | 'binance' | ...`
  * `accountId` ou `creditCardId` ou `broker` (dependendo do tipo)
* Retorno:

  * Lista de registros parseados em formato padronizado
  * Sinalização de possíveis duplicatas (com base em `externalId`, valor, data)

**POST `/api/v1/imports/confirm`**

* Body:

  * ID do arquivo/preview
  * itens que devem ser importados (se você quiser permitir desmarcar alguns)
* Ação:

  * Cria `Transactions` e/ou `Investments` no banco
* Resposta:

  * Resumo: quantos registros criados, quantos ignorados, quantos considerados duplicados.

### 11.2. Histórico de imports (opcional, mas útil)

**GET `/api/v1/imports`**

* Lista de arquivos importados (para debug, auditoria, etc.)

**GET `/api/v1/imports/:id`**

* Detalhes de um import específico (origem, quantidade de registros, status).

## 12. 💾 Backup

### 12.1. Exportar dados

**GET `/api/v1/backup/export`**

* Ação:

  * Gera um arquivo JSON com todos os dados do usuário (accounts, cards, categories, transactions, fixedTransactions, investments, goals, etc.)
* Retorno:

  * Download de um JSON estruturado.

### 12.2. Importar dados (restore)

**POST `/api/v1/backup/import`**

* Body:

  * Arquivo JSON exportado anteriormente
* Ação:

  * Restaura os dados no sistema (com regras que você vai definir: sobrescrever, mergear, etc.)

## 13. 🕒 Jobs & Notificações (sem endpoints diretos, por enquanto)

* **JobsModule**:

  * Roda em background (cron) para:

    * gerar ocorrências de transações fixas
    * atualizar preços de mercado
    * recalcular projeções/metas (se for pesado)

* **NotificationsModule (futuro)**:

  * Pode expor algo como:

    * `GET /api/v1/notifications` (listar notificações)
    * Mas inicialmente será apenas interno (sem endpoints).
