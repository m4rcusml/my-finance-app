# 📚 User Stories — Aplicação de Finanças Pessoais

Este documento contém o conjunto oficial de *User Stories* do sistema, servindo como base para requisitos funcionais, arquitetura, modelagem de dados e implementação.
As histórias estão organizadas por domínio funcional para facilitar versionamento, priorização e refinamento.

## 🟦 1. Visualização Geral / Dashboard

### **1.1 Saldo total**

**Como usuário**, quero ver o saldo total somando todas as minhas contas bancárias (sem incluir investimentos), **para saber quanto dinheiro líquido tenho disponível**.

### **1.2 Saldo por conta**

**Como usuário**, quero ver o saldo individual de cada conta bancária, **para entender onde meu dinheiro está distribuído**.

### **1.3 Separação de saldo investido**

**Como usuário**, quero visualizar separadamente o saldo em conta corrente e o saldo investido, **para não confundir o dinheiro disponível com o que está aplicado**.

### **1.4 Limite total de cartão**

**Como usuário**, quero ver o limite total de cartão utilizado e disponível, **para saber quanto ainda posso gastar no crédito**.

### **1.5 Limite individual de cartão**

**Como usuário**, quero ver o limite usado e disponível de cada cartão, **para acompanhar meu endividamento com precisão**.

### **1.6 Gastos por período**

**Como usuário**, quero ver o total de gastos por semana, mês e ano, **para entender meus hábitos de consumo ao longo do tempo**.

## 🟩 2. Transações (Ganhos e Gastos)

### **2.1 Registrar transações**

**Como usuário**, quero registrar ganhos e gastos manualmente, **para manter meu controle financeiro atualizado**.

### **2.2 Categorizar transações**

**Como usuário**, quero atribuir uma categoria às transações, **para saber em que áreas estou gastando mais**.

### **2.3 Página de transações sem categoria**

**Como usuário**, quero visualizar transações que não possuem categoria atribuída, **para categorizá-las rapidamente**.

### **2.4 Sugestão automática de categoria**

**Como usuário**, quero que o sistema sugira categorias com base na descrição, **para economizar tempo**.

### **2.5 Editar e excluir transações**

**Como usuário**, quero editar e excluir transações, **para corrigir erros ou ajustar valores**.

### **2.6 Filtrar por período**

**Como usuário**, quero filtrar transações por semana, mês, ano ou intervalo customizado, **para facilitar análises**.

### **2.7 Filtrar por categoria**

**Como usuário**, quero filtrar transações por categoria, **para entender o impacto de cada área nas minhas finanças**.

### **2.8 Projeção de gastos**

**Como usuário**, quero projetar gastos do próximo mês com base em padrões observados, **para antecipar meu orçamento**.

### **2.9 Cadastrar transações fixas com margem de dias**

**Como usuário**, quero cadastrar ganhos e gastos fixos com **margem de dias** em vez de uma data única, **para confirmar a data real próximo ao vencimento**.

### **2.10 Notificação de transação fixa próxima**

**Como usuário**, quero ser notificado quando estiver na margem de dias de uma transação fixa, **para confirmar a ocorrência real**.

### **2.11 Confirmar ou rejeitar transação fixa**

**Como usuário**, quero confirmar a ocorrência e data exata da transação fixa ou rejeitá-la, **para manter precisão no histórico**.

### **2.12 Registro automático após confirmação**

**Como usuário**, quero que o sistema gere automaticamente a transação normal após a confirmação, **para não cadastrá-la manualmente**.

### **2.13 Histórico de transações fixas**

**Como usuário**, quero visualizar o histórico de confirmações e rejeições de transações fixas, **para acompanhar atrasos e padrões**.

## 🟧 3. Contas, Cartões e Investimentos

### **3.1 Cadastrar contas bancárias**

**Como usuário**, quero cadastrar contas com nome, instituição e saldo, **para acompanhar minhas fontes de dinheiro**.

### **3.2 Cadastrar cartões de crédito**

**Como usuário**, quero registrar meus cartões, **para acompanhar limite, fatura e dívidas**.

### **3.3 Cadastrar investimentos manualmente**

**Como usuário**, quero registrar meus investimentos manualmente, **para acompanhar aportes e posições**.

### **3.4 Diferenciar contas de investimentos**

**Como usuário**, quero que o sistema trate contas bancárias e investimentos como entidades separadas, **para evitar confusão no saldo total**.

## 🟨 4. Importação de Arquivos (Bancos e Corretoras)

### **4.1 Importar extratos**

**Como usuário**, quero importar arquivos de extrato (CSV, OFX, XLSX etc.), **para não inserir transações manualmente**.

### **4.2 Importar de bancos específicos**

**Como usuário**, quero importar extratos do Inter, Mercado Pago e BTG, **para configurar rapidamente minhas contas**.

### **4.3 Importar de corretoras**

**Como usuário**, quero importar extratos do Binance, Bipa, Coinbase e outras, **para registrar investimentos automaticamente**.

### **4.4 Detectar duplicatas**

**Como usuário**, quero que o sistema identifique transações duplicadas durante importações, **para evitar inconsistências**.

### **4.5 Pré-visualizar importação**

**Como usuário**, quero visualizar previamente os dados antes de confirmar a importação, **para validar se tudo está correto**.

## 🟫 5. Dados do Mercado Financeiro

### **5.1 Preço de ações**

**Como usuário**, quero ver preços atualizados de ações, **para acompanhar minhas posições**.

### **5.2 Preço de FIIs**

**Como usuário**, quero visualizar cotações de FIIs, **para monitorar minha carteira imobiliária**.

### **5.3 Preço de criptomoedas**

**Como usuário**, quero ver preços atualizados de criptomoedas, **para monitorar volatilidade**.

### **5.4 Atualização periódica dos preços**

**Como usuário**, quero que os preços se atualizem automaticamente, **para não precisar atualizar manualmente**.

## 🟪 6. Metas e Planejamento Financeiro

### **6.1 Criar metas**

**Como usuário**, quero criar metas financeiras (economia, limite de gastos, objetivos), **para me planejar melhor**.

### **6.2 Acompanhar progresso**

**Como usuário**, quero acompanhar graficamente o progresso das metas, **para saber se estou no caminho certo**.

### **6.3 Alertas de meta**

**Como usuário**, quero receber alertas quando estiver perto de ultrapassar uma meta, **para ajustar meu comportamento a tempo**.

## 🟪 7. Otimizador de Investimentos (Futuro)

### **7.1 Comparar oportunidades**

**Como usuário**, quero ver alternativas de investimento para o dinheiro disponível, **para otimizar minha carteira**.

### **7.2 Recomendações personalizadas**

**Como usuário**, quero recomendações com base no meu histórico financeiro, **para tomar decisões mais inteligentes**.

### **7.3 Simulações financeiras**

**Como usuário**, quero simular rendimentos futuros (CDB, Tesouro, ETFs, staking), **para entender impactos no longo prazo**.

## 🟦 8. Infraestrutura e Qualidade

### **8.1 Backup**

**Como usuário**, quero fazer backup dos meus dados localmente ou na nuvem, **para evitar perda de informação**.

### **8.2 Segurança de dados**

**Como usuário**, quero que meus dados sejam protegidos e criptografados, **porque são informações sensíveis**.

### **8.3 Modo offline**

**Como usuário**, quero conseguir usar o aplicativo offline e sincronizar depois, **para funcionar mesmo sem internet**.
