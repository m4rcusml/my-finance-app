# 🏛️ **Arquitetura do Sistema — Resumo Geral**

Este documento descreve a arquitetura atual do sistema de controle financeiro, incluindo decisões tecnológicas, organização de domínios, comunicação entre camadas, infraestrutura e diretrizes de segurança. O objetivo é estabelecer uma visão clara e escalável para o desenvolvimento do frontend, backend e funcionalidades futuras.

# 1. 🎯 **Visão Geral da Arquitetura**

O sistema será composto por duas aplicações principais:

* **Frontend Web**: construído com **Next.js + TypeScript**, consumindo APIs REST e atuando inicialmente como *online-only*.
* **Backend**: implementado em **Node.js + NestJS + TypeScript**, servindo endpoints REST, executando regras de negócio, acessando o banco de dados e agendando tarefas recorrentes.

Além disso, o backend integra-se a:

* **PostgreSQL** (persistência principal)
* **APIs externas** de mercado financeiro
* **Jobs internos** (tarefas agendadas)
* **Sistema de upload e parsing de arquivos**

A arquitetura é orientada a **domínios (DDD light)**, com módulos independentes responsáveis pelas funcionalidades centrais.

# 2. 🔹 **Domínios Principais**

O backend é organizado em módulos refletindo o domínio da aplicação:

* **Accounts** — Contas bancárias
* **CreditCards** — Cartões de crédito
* **Transactions** — Transações de ganhos e gastos
* **FixedTransactions** — Transações recorrentes
* **Categories** — Categorias de gasto/ganho
* **Investments** — Investimentos cadastrados
* **MarketData** — Dados externos de ações, FIIs e criptomoedas
* **Goals** — Metas financeiras
* **Imports** — Importação de extratos bancários/corretoras
* **Backup** — Exportação/importação de dados
* **Auth** — Autenticação via JWT

Esses módulos são independentes, mas se comunicam por meio de **services** e **regras de negócio compartilhadas**.

# 3. 🧱 **Backend (NestJS) — Camadas**

A arquitetura do backend segue uma **estrutura modular e em camadas**:

### **3.1. Controllers**

* Exposição de endpoints HTTP.
* Validação inicial dos inputs.
* Não contém regras de negócio.

### **3.2. Services / Use Cases**

* Implementam toda a lógica da aplicação.
* São responsáveis por:

  * cálculos financeiros
  * regras de importação
  * projeções
  * geração de transações fixas
  * agregação de dados

### **3.3. Repositories**

* Acessam o banco de dados via Prisma.
* Não implementam regras de negócio.

### **3.4. Entidades / Modelos de Domínio**

* Classes ou interfaces representando objetos do domínio.

### **3.5. Jobs (Tarefas em Background)**

* Usados para automatizar rotinas:

  * verificação diária de transações fixas
  * atualização periódica de dados de mercado
  * processamento de importações pesadas
* Inicialmente implementados com `@nestjs/schedule` (cron).
* Futuramente podem rodar em um **worker separado** usando Redis + BullMQ.

# 4. 🗄️ **Banco de Dados (PostgreSQL + Prisma)**

O banco de dados é relacional devido à natureza financeira do sistema.
As tabelas principais incluem:

* `accounts`
* `credit_cards`
* `categories`
* `transactions`
* `fixed_transactions`
* `fixed_transaction_occurrences`
* `investments`
* `market_assets`
* `goals`

O Prisma é utilizado para:

* gerar o client de acesso ao banco
* cuidar de migrations
* fornecer tipagem estática no domínio

# 5. 🌐 **Frontend (Next.js)**

O frontend será uma aplicação web estruturada em:

* **Next.js + TypeScript**
* **React Query** para comunicação com a API + cache
* **Zustand** para estado global simples (tema, filtros, UI)
* **SSR/CSR híbrido** quando necessário

Páginas principais:

* Dashboard
* Transações
* Contas
* Cartões
* Investimentos
* Metas
* Importação
* Configurações

O frontend consome apenas a API e não contém regras de negócio complexas.

# 6. 🔁 **Comunicação Front ↔ Backend**

A comunicação entre frontend e backend ocorre totalmente via **REST API**.

Exemplos de endpoints (conceituais):

* `GET /accounts`
* `POST /transactions`
* `GET /dashboard?month=2025-11`
* `POST /imports/preview`
* `POST /imports/confirm`
* `GET /market/prices?ticker=PETR4`
* `POST /auth/login`

O frontend nunca acessa o banco diretamente.

# 7. 🔐 **Segurança**

Mesmo sendo um sistema pessoal, a arquitetura segue boas práticas:

### **7.1. Autenticação**

* Autenticação via **JWT**
* Rotas protegidas com guardas no NestJS
* Refresh tokens podem ser implementados futuramente

### **7.2. Criptografia**

* Senhas: `bcrypt` ou `argon2`
* Secrets: variáveis de ambiente, nunca commitadas
* Tokens de APIs externas armazenados criptografados no banco (opcional)

### **7.3. TLS**

* HTTPS garantido pela hospedagem (Vercel, Railway, Render)

### **7.4. Controle de Acesso**

* Middleware no backend que garante que cada request possui JWT válido

# 8. 📦 **Importação de Arquivos**

A importação de extratos (Inter, MP, BTG, Binance, etc.) segue um pipeline:

1. **Upload** (frontend → backend)
2. **Reader** (interpreta CSV, OFX, XLSX)
3. **Parser especializado** (por origem)
4. **Normalizer** (padroniza campos)
5. **DuplicateChecker**
6. **Preview** (usuário confirma ou cancela)
7. **Importer** (salva no banco via domínios)

Essa separação facilita a adição de novos formatos no futuro.

# 9. 📈 **Dados de Mercado Financeiro**

Módulo **MarketData**:

* Obtém preços de ações, FIIs e criptos através de APIs externas.
* Armazena cache de resultados no banco (opcional).
* Um job pode atualizar valores periodicamente.

Esse módulo é **desacoplado do módulo Investments**, permitindo trocar de API externa facilmente.

# 10. 🔁 **Transações Fixas**

O sistema usa dois conceitos:

### **FixedTransaction**

* É o “template” da transação recorrente
* Define valor, dia, margem, categoria, conta/cartão

### **FixedTransactionOccurrence**

* Registro mensal da ocorrência
* Pode estar:

  * “pendente”
  * “confirmada”
  * “pulada”

Um **job diário** identifica ocorrências na janela e cria registros pendentes.

# 11. 💾 **Backup**

O sistema suporta dois modos:

### **11.1. Backup local**

* Exportação de todas as entidades em JSON
* Importação manual pelo usuário

### **11.2. Backup em nuvem (futuro)**

* Upload do backup criptografado para backend
* Possibilidade de restaurar em outro dispositivo

# 12. 🏗️ **Infraestrutura e Deploy**

### **12.1. Frontend**

* Hospedado no **Vercel** (free tier)
* Deploy automático a cada push para GitHub

### **12.2. Backend**

Opções:

* **Railway** (sugerido)
* Render (alternativa)
* Fly.io (alternativa avançada)
* Koyeb (alternativa experimental)

### **12.3. Banco**

* Railway Postgres
* Render Postgres
* Neon (Postgres serverless gratuito)

# 13. 🌍 **Modo Offline**

O sistema começará como **online-only**, para reduzir complexidade inicial.

No futuro, poderá ser estendido para:

* PWA
* Cache local com IndexedDB
* Sincronização inteligente de dados

# ✔️ **Resumo Final da Arquitetura**

* Frontend: **Next.js + TS, React Query, Zustand**
* Backend: **NestJS + TS, módulos por domínio**
* Banco: **Postgres + Prisma**
* Jobs: **Nest Scheduler (cron)**, futuros workers
* Importação estruturada em pipeline
* Dados externos isolados em módulo próprio
* Auth JWT, HTTPS, criptografia
* Infra: **Vercel + Railway/Render/Neon**
* Online-only na primeira versão
* Arquitetura modular, escalável e fácil de evoluir
