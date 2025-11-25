# 📄 Requisitos Funcionais (RF)

Este documento descreve os **Requisitos Funcionais** do Sistema de Gestão Financeira, derivados das User Stories e alinhados ao modelo de domínio e à arquitetura definida.
Os requisitos abaixo definem **o que o sistema deve fazer**, independentemente da implementação técnica.

Os requisitos estão agrupados por domínio funcional.

## 🟦 1. Visualização Geral / Dashboard

### **RF-1.1 – Cálculo de saldo total (sem investimentos)**

O sistema deve calcular e exibir o saldo total somando todas as contas bancárias cadastradas, **excluindo valores referentes a investimentos**.

### **RF-1.2 – Exibição de saldo por conta**

O sistema deve exibir para o usuário uma lista com saldos individuais de cada conta bancária.

### **RF-1.3 – Separação de saldo corrente e investido**

O sistema deve exibir separadamente:

* Saldo de contas correntes e semelhantes.
* Saldo total em investimentos.

Esses valores não devem ser agregados no cálculo do saldo líquido.

### **RF-1.4 – Limite total de cartão de crédito**

O sistema deve exibir:

* Limite total disponível em todos os cartões.
* Valor total utilizado.
* Valor total disponível.

### **RF-1.5 – Limite individual de cartão de crédito**

O sistema deve exibir, para cada cartão:

* Limite total.
* Valor utilizado.
* Valor restante.

### **RF-1.6 – Total de gastos por período**

O sistema deve permitir escolher um período (semana, mês, ano) e exibir o total de gastos registrados naquele intervalo.

## 🟩 2. Transações (Ganhos e Gastos)

### **RF-2.1 – Cadastro de transações**

O sistema deve permitir cadastrar transações de ganho e gasto, com:

* tipo (ganho/gasto),
* valor,
* data,
* conta/cartão,
* descrição opcional.

### **RF-2.2 – Associação de transações a categorias**

O sistema deve permitir associar cada transação a uma categoria existente.

### **RF-2.3 – Listagem de transações sem categoria**

O sistema deve exibir uma lista de transações que não possuem categoria atribuída.

### **RF-2.4 – Alteração de categoria (individual ou em sequência)**

O sistema deve permitir alterar a categoria diretamente a partir da lista de “sem categoria”, possibilitando ajustar várias transações em sequência.

### **RF-2.5 – Sugestão automática de categoria**

Ao cadastrar ou importar transações, o sistema deve:

* analisar a descrição e/ou origem,
* sugerir automaticamente uma categoria adequada,
* permitir confirmação ou alteração pelo usuário.

### **RF-2.6 – Edição de transações**

O sistema deve permitir editar:

* valor,
* data,
* conta/cartão,
* categoria,
* descrição.

### **RF-2.7 – Exclusão de transações**

O sistema deve permitir excluir transações, removendo-as de cálculos e relatórios.

### **RF-2.8 – Filtro por período**

O sistema deve permitir filtrar transações por:

* semana,
* mês,
* ano,
* período customizado.

### **RF-2.9 – Filtro por categoria**

O sistema deve permitir filtrar transações por uma ou mais categorias.

### **RF-2.10 – Projeção de gastos**

O sistema deve calcular e exibir projeções de gastos futuros com base em padrões históricos.

## 🟩 2.1. Transações Fixas (Recorrentes)

### **RF-2.11 – Cadastro de transações fixas com margem de dias**

O sistema deve permitir cadastrar transações fixas contendo:

* tipo (ganho/gasto),
* valor,
* dia de referência,
* margem de dias (janela de tolerância),
* conta/cartão,
* categoria,
* descrição.

### **RF-2.12 – Notificação de transações fixas dentro da margem**

Quando a data atual estiver dentro da janela definida, o sistema deve notificar o usuário para confirmação.

### **RF-2.13 – Confirmação manual de transação fixa**

O sistema deve permitir:

* confirmar a ocorrência da transação fixa,
* registrar a data real,
* ou informar que ela não ocorreu.

### **RF-2.14 – Registro automático após confirmação**

Ao confirmar, o sistema deve:

* criar automaticamente uma transação normal correspondente,
* marcar a ocorrência do período como “confirmada”.

### **RF-2.15 – Histórico de transações fixas**

O sistema deve registrar e exibir:

* confirmações,
* rejeições,
* data real de ocorrência,
* ocorrências passadas.

### **RF-2.16 – Edição e exclusão de transações fixas**

O sistema deve permitir editar ou excluir transações fixas, garantindo:

* preservação do histórico,
* aplicação das alterações apenas para futuras ocorrências.

## 🟧 3. Contas, Cartões e Investimentos

### **RF-3.1 – Cadastro de contas bancárias**

O sistema deve permitir cadastrar contas bancárias com: nome, instituição, tipo e saldo inicial.

### **RF-3.2 – Edição e remoção de contas**

O sistema deve permitir editar contas ou desativá-las (mantendo histórico).

### **RF-3.3 – Cadastro de cartões de crédito**

O sistema deve permitir cadastrar cartões com nome, instituição, limite total e opcionalmente data de fechamento.

### **RF-3.4 – Edição e remoção de cartões**

O sistema deve permitir editar ou desativar cartões.

### **RF-3.5 – Cadastro de investimentos**

O sistema deve permitir cadastrar investimentos com tipo de ativo, corretora, valor investido e data.

### **RF-3.6 – Separação de contas e investimentos**

O sistema deve tratar contas e investimentos como entidades distintas e não adicionar investimentos ao saldo líquido.

## 🟨 4. Importação de Arquivos (Bancos e Corretoras)

### **RF-4.1 – Upload de arquivos**

O sistema deve aceitar arquivos em formatos: CSV, OFX, XLSX.

### **RF-4.2 – Suporte a formatos por origem**

O sistema deve suportar parsing de extratos de:

* Banco Inter,
* Mercado Pago,
* BTG.

### **RF-4.3 – Importação de extratos de corretoras**

O sistema deve processar extratos de Binance, Bipa, Coinbase e outros, convertendo linhas em transações ou investimentos.

### **RF-4.4 – Detecção de duplicatas**

Durante o parse, o sistema deve:

* comparar valores, datas, descrições e IDs externos,
* indicar possíveis duplicatas,
* evitar inserir registros repetidos.

### **RF-4.5 – Pré-visualização antes da importação**

O sistema deve exibir uma prévia dos dados parseados antes do usuário confirmar a importação.

### **RF-4.6 – Associação de conta/corretora**

O sistema deve permitir selecionar manualmente a conta ou corretora alvo do extrato importado.

## 🟫 5. Dados de Mercado Financeiro

### **RF-5.1 – Consulta de preços de ações**

O sistema deve exibir preços atualizados de ações (ticker, preço e variação).

### **RF-5.2 – Consulta de preços de FIIs**

O sistema deve exibir preços atualizados de FIIs.

### **RF-5.3 – Consulta de preços de criptomoedas**

O sistema deve exibir preços atualizados de criptomoedas cadastradas pelo usuário.

### **RF-5.4 – Atualização periódica**

O sistema deve atualizar preços automaticamente em intervalos definidos.

### **RF-5.5 – Associação entre investimentos e ativos**

O sistema deve permitir relacionar investimentos cadastrados a ativos do mercado.

## 🟪 6. Metas e Planejamento Financeiro

### **RF-6.1 – Cadastro de metas**

O sistema deve permitir criar metas financeiras com valor alvo, prazo e categoria/conta opcional.

### **RF-6.2 – Cálculo de progresso da meta**

O sistema deve calcular o progresso automaticamente com base em dados financeiros.

### **RF-6.3 – Visualização de progresso**

O sistema deve exibir gráficos ou indicadores visuais do progresso.

### **RF-6.4 – Alertas de meta**

O sistema deve gerar alertas quando o usuário estiver prestes a ultrapassar uma meta.

## 🟪 7. Otimizador de Investimentos (Futuro)

### **RF-7.1 – Comparação de alternativas**

O sistema deve comparar oportunidades (CDB, Tesouro, ETFs, cripto etc.) com base em parâmetros financeiros.

### **RF-7.2 – Recomendações personalizadas**

O sistema deve sugerir realocações baseadas no histórico do usuário.

### **RF-7.3 – Simulação de rendimento futuro**

O sistema deve permitir simular aportes, taxas e prazos, exibindo projeções.

## 🟦 8. Infraestrutura e Qualidade

### **RF-8.1 – Backup local**

O sistema deve permitir exportar dados completos do usuário para backup.

### **RF-8.2 – Restauração de backup**

O sistema deve permitir restaurar backups gerados pelo próprio sistema.

### **RF-8.3 – Criptografia de dados sensíveis**

Dados sensíveis devem ser guardados de forma criptografada.

### **RF-8.4 – Modo offline (futuro)**

O sistema deve permitir uso básico offline e sincronizar posteriormente quando houver conexão.
