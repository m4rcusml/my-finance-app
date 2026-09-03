# Histórias de usuário da V1

Estas histórias descrevem somente comportamentos da V1. Ideias futuras não são histórias aceitas nesta versão; ficam em [`backlog.md`](backlog.md).

## Sessão e perfil

### US-1 — Criar conta

Como pessoa usuária, quero criar uma conta com e-mail e senha para começar meu controle financeiro.

Critérios:

- e-mail é normalizado;
- credenciais inválidas não revelam se o e-mail existe;
- a sessão é aberta sem persistir o access token no armazenamento do navegador.

### US-2 — Continuar e encerrar a sessão

Como pessoa usuária, quero que a sessão seja renovada com segurança e que o logout remova meus dados privados do navegador.

Critérios:

- refresh opaco, rotativo e protegido por CSRF;
- concorrência legítima não invalida o token vencedor;
- logout, sessão terminal e troca de usuário limpam cache.

### US-3 — Gerenciar perfil

Como pessoa usuária, quero alterar perfil/senha ou excluir minha conta com confirmação forte.

## Ledger

### US-4 — Manter contas

Como pessoa usuária, quero cadastrar contas e ver o saldo derivado dos lançamentos para saber quanto dinheiro tenho disponível.

Critérios:

- saldo de conta do tipo investimento fica separado do caixa;
- recurso com histórico é arquivado em vez de apagado;
- arquivados continuam legíveis no histórico.

### US-5 — Acompanhar cartões

Como pessoa usuária, quero registrar cartões e ver limite usado no ciclo atual para não confundir faturas antigas com a atual.

Critérios:

- ciclo respeita o dia de fechamento;
- meses curtos e ano bissexto são calculados;
- cartão arquivado não recebe lançamento novo.

### US-6 — Organizar categorias

Como pessoa usuária, quero manter categorias de receita, despesa ou ambas para identificar os lançamentos.

### US-7 — Registrar e corrigir transações

Como pessoa usuária, quero criar, editar, filtrar e excluir receitas/despesas para manter o ledger fiel.

Critérios:

- data permanece o mesmo dia em qualquer timezone;
- há exatamente uma origem: conta ou cartão;
- a edição consegue limpar categoria e trocar origem;
- listas são paginadas e mostram nomes, não UUIDs.

### US-8 — Categorizar pendências

Como pessoa usuária, quero percorrer lançamentos sem categoria em sequência para organizar rapidamente o histórico.

### US-9 — Entender totais e projeção

Como pessoa usuária, quero um resumo por período e uma média projetada baseada em meses completos para planejar gastos.

## Visão geral

### US-10 — Comparar períodos

Como pessoa usuária, quero alternar semana, mês, ano ou intervalo próprio e comparar com o período anterior.

### US-11 — Ver patrimônios separados

Como pessoa usuária, quero distinguir saldo em caixa, saldo de conta-investimento e custo da carteira manual.

### US-12 — Ver atividade relevante

Como pessoa usuária, quero ver cartões no ciclo, últimos 12 meses, transações recentes, recorrências pendentes e fila sem categoria em um painel.

## Recorrências

### US-13 — Criar modelo mensal

Como pessoa usuária, quero cadastrar uma receita ou despesa recorrente com dia, margem, categoria e origem.

### US-14 — Confirmar a ocorrência real

Como pessoa usuária, quero informar data e valor reais para que o sistema crie exatamente um lançamento.

Critérios:

- só uma ocorrência pending pode ser confirmada;
- duas confirmações concorrentes geram uma única transação;
- o histórico guarda o snapshot do período.

### US-15 — Ignorar e consultar histórico

Como pessoa usuária, quero ignorar uma ocorrência que não aconteceu e consultar estados passados sem que editar/arquivar o modelo os altere.

## Investimentos e metas

### US-16 — Registrar carteira manual

Como pessoa usuária, quero cadastrar ativos e aportes por custo de aquisição para reunir minhas posições sem depender de cotação externa.

### US-17 — Acompanhar meta manual

Como pessoa usuária, quero definir objetivo e atualizar seu valor alcançado manualmente para visualizar o progresso sem cálculo enganoso.

## Importação

### US-18 — Pré-visualizar extrato

Como pessoa usuária, quero enviar CSV, OFX ou planilha do Inter/formato genérico e revisar erros e duplicatas antes de gravar.

### US-19 — Confirmar linhas selecionadas

Como pessoa usuária, quero escolher conta/cartão e linhas válidas para importar somente o que revisei.

Critérios:

- o servidor usa a prévia persistida;
- destino e ownership são revalidados;
- repetição ou concorrência não duplica `externalId`;
- falha desfaz o lote.

## Backup

### US-20 — Exportar meus dados

Como pessoa usuária, quero baixar um JSON versionado com todo o meu histórico financeiro e sem credenciais.

### US-21 — Restaurar com segurança

Como pessoa usuária, quero mesclar ou substituir meu ledger, com confirmação explícita no modo destrutivo e rollback se algo falhar.

## Uso em diferentes telas

### US-22 — Usar pelo celular e teclado

Como pessoa usuária, quero navegar desde 320 px e operar diálogos por teclado.

Critérios:

- menu móvel disponível;
- foco não escapa do diálogo;
- Escape fecha;
- o foco retorna ao acionador;
- loading, vazio e erro não são confundidos.

## Limite do compromisso

A V1 não promete cotação, integração direta com instituições, sugestão automática, alerta externo, recomendação, offline ou nuvem. A interface e a documentação devem comunicar isso sem “em breve” implícito.
