# Requisitos funcionais da V1

Este é o escopo funcional implementado pela V1. Itens posteriores ficam exclusivamente em [`backlog.md`](backlog.md).

## RF-1 — Conta e sessão

### RF-1.1 Cadastro e login

O usuário pode se cadastrar e entrar com e-mail e senha. O sistema normaliza o e-mail e não diferencia, na resposta de erro, conta inexistente de senha inválida.

### RF-1.2 Continuidade da sessão

O sistema renova a sessão por refresh token opaco em cookie `HttpOnly`, com rotação, CSRF e recuperação automática de uma chamada protegida que recebeu 401.

### RF-1.3 Encerramento e isolamento

Logout encerra a sessão atual. Logout, 401 terminal e troca de usuário limpam token em memória e cache privado.

### RF-1.4 Perfil e credenciais

O usuário pode alterar nome e e-mail, trocar senha informando a atual e excluir a conta após senha e confirmação textual reforçada.

## RF-2 — Contas, cartões e categorias

### RF-2.1 Contas

O usuário pode criar, listar, editar, arquivar e restaurar contas com nome, instituição, tipo e saldo inicial. O saldo é calculado a partir do ledger.

### RF-2.2 Cartões

O usuário pode criar, listar, editar, arquivar e restaurar cartões com limite e dia de fechamento opcional.

### RF-2.3 Ciclo de cartão

O uso considera somente despesas do ciclo aberto do cartão. Fechamentos de 28 a 31 respeitam meses curtos e anos bissextos.

### RF-2.4 Categorias

O usuário pode manter categorias `income`, `expense` ou `both`. Uma categoria precisa ser `both` ou corresponder ao tipo do lançamento; a API rejeita alterações de tipo que tornariam transações, modelos ou ocorrências históricas incompatíveis. Categorias arquivadas permanecem no histórico e não recebem novos lançamentos.

### RF-2.5 Preservação de histórico

Ao excluir conta, cartão ou categoria, o sistema remove fisicamente apenas se não houver dependências; caso contrário, arquiva. A interface permite incluir arquivados e restaurá-los.

## RF-3 — Transações

### RF-3.1 Lançamento manual

O usuário pode criar receita ou despesa com valor, data civil, descrição e categoria opcional.

### RF-3.2 Origem única

Toda transação pertence exatamente a uma conta ou a um cartão. A regra é validada na API e em PostgreSQL.

### RF-3.3 Consulta e paginação

A lista oferece paginação e filtros por tipo, origem de criação, período, conta, cartão e categoria, com nomes das relações.

### RF-3.4 Edição e remoção

O usuário pode editar e excluir transações. PATCH aceita `null` explícito para limpar categoria ou trocar a origem sem manter a anterior.

### RF-3.5 Sem categoria

Há uma fila paginada dedicada para categorizar lançamentos um a um.

### RF-3.6 Resumo e projeção

O sistema calcula receitas, despesas, saldo e contagem em intervalo inclusivo. A projeção usa a média de meses completos, incluindo meses sem movimento no denominador.

## RF-4 — Dashboard

### RF-4.1 Períodos

O usuário pode consultar semana, mês, ano ou intervalo personalizado. O backend devolve a janela resolvida e a janela anterior comparável.

### RF-4.2 Saldos separados

O dashboard mostra separadamente caixa em contas não-investimento, saldo em contas do tipo `investment` e custo da carteira manual.

### RF-4.3 Cartões

Exibe limite total, uso agregado dos ciclos abertos e disponível.

### RF-4.4 Histórico e pendências

Exibe os 12 meses terminando no mês de referência, últimas transações com nomes, ocorrências pendentes e quantidade sem categoria.

### RF-4.5 Estados de interface

Consultas apresentam loading, vazio, erro e retry; mutations apresentam sucesso ou erro.

## RF-5 — Lançamentos recorrentes

### RF-5.1 Modelo mensal

O usuário pode criar modelo com tipo, valor, dia de referência, margem, categoria, descrição e uma origem. Criação, alteração de vínculos e restauração exigem conta/cartão/categoria ativos e categoria compatível com o tipo.

### RF-5.2 Geração

Um job diário cria no máximo uma ocorrência por modelo/competência e recupera períodos recentes que não foram processados.

### RF-5.3 Snapshot

A ocorrência copia os dados do modelo. Editar o modelo não reescreve ocorrências passadas ou finalizadas.

### RF-5.4 Confirmação

Uma ocorrência pendente pode ser confirmada com data/valor real. A confirmação cria exatamente uma transação `fixed` de forma atômica.

### RF-5.5 Ignorar

Uma ocorrência pendente pode mudar para `skipped`. Estados finais não podem ser reabertos.

### RF-5.6 Arquivamento

Modelos podem ser arquivados/restaurados. Nenhuma rota apaga definitivamente o histórico recorrente.

## RF-6 — Investimentos manuais

### RF-6.1 Catálogo

O usuário pode cadastrar ativos por símbolo, tipo, exchange e nome. O catálogo não busca preços.

### RF-6.2 Posições

O usuário registra corretora, tipo, quantidade, preço de compra, total investido e data civil.

### RF-6.3 Sumário

A carteira soma custo de aquisição e agrupa por tipo. Não exibe valor de mercado, lucro ou rentabilidade.

## RF-7 — Metas manuais

### RF-7.1 Cadastro

O usuário pode criar, editar e remover metas com tipo, valor alvo, prazo e relações opcionais.

### RF-7.2 Progresso

O usuário informa o valor atual. O sistema calcula a razão limitada entre zero e um e identifica a fonte como `manual`.

## RF-8 — Importação

### RF-8.1 Formatos e layouts

O sistema aceita CSV, OFX/QFX e planilhas XLSX/XLS/XLSM, interpretados pelos layouts `inter` ou `generic`.

### RF-8.2 Prévia

Upload gera batch persistido, expiração, contadores e erros por linha. Nenhuma transação é criada nessa etapa.

### RF-8.3 Confirmação segura

O cliente seleciona destino e números de linha. A API recarrega a prévia, valida ownership e origem XOR e grava tudo numa transação.

### RF-8.4 Idempotência

Cada linha importável recebe `externalId` determinístico. Duplicatas existentes, internas ou concorrentes não viram lançamentos repetidos.

### RF-8.5 Histórico

O usuário pode consultar os arquivos confirmados e reabrir a prévia pelo batch enquanto disponível.

## RF-9 — Backup local

### RF-9.1 Exportação

O usuário baixa um JSON versionado do grafo durável, inclusive ocorrências, sem credenciais ou tokens.

### RF-9.2 Replace

Após confirmação explícita na interface, `replace` remove somente o grafo financeiro do usuário e restaura o arquivo de forma atômica.

### RF-9.3 Merge

`merge` preserva o estado existente, reconcilia chaves únicas de categorias/ativos e evita duplicar transações importadas pelo `externalId`.

### RF-9.4 Integridade

O restore valida versão, forma, limites, referências e ownership antes de confirmar. Qualquer falha desfaz a operação.

## RF-10 — Operação e acessibilidade

### RF-10.1 Saúde

Liveness não depende do banco. Readiness consulta PostgreSQL e devolve 503 quando indisponível.

### RF-10.2 Navegação

Todas as rotas privadas usam uma guarda e shell únicos. A navegação funciona a partir de 320 px.

### RF-10.3 Diálogos

Diálogos possuem nome acessível, foco inicial, Escape, focus trap e restauração de foco.

### RF-10.4 Erros

A API usa envelope uniforme com `requestId`; a interface mostra mensagens seguras e não expõe UUID como rótulo.

## Requisitos não funcionais associados

- Node.js 22, pnpm 10 e PostgreSQL 16;
- pt-BR e timezone padrão `America/Sao_Paulo`;
- isolamento por usuário e 404 cross-tenant;
- HTTPS e cookies seguros em produção;
- build determinístico e artefato iniciável;
- migrations verificadas em banco vazio e upgrade pré-V1;
- CI, smoke, integração real e Playwright como gates de release.

Os comandos de aceite estão em [`backend_tests.md`](backend_tests.md).
