# Interface consolidada — feat/rebranch-ui

Implementação baseada na página [UI Refresh · Screens do Figma](https://www.figma.com/design/vgZuzDQPedWwwRj1VptSou/My-Finance-App?node-id=129-286). Foram usadas as telas consolidadas mais recentes da página, preservando as rotas legadas como acesso compatível, sem criar cópias independentes do produto.

## Mapa Figma → aplicativo

| Figma | Aplicativo | Fluxo |
| --- | --- | --- |
| `231:540` Dashboard | `/dashboard` | Caixa, receitas/despesas, comparação anterior, contas/patrimônio, 12 meses e pendências |
| `231:745` Movimentações | `/transactions` | Busca, filtros, paginação, resumo, projeção, criar/editar/excluir |
| `251:1586` Sem categoria | `/transactions?view=uncategorized` | Categorização sequencial com seleção por teclado e próxima pendência |
| `253:1653` Categorias | `/transactions?view=categories` | Lista, formulário lateral, cor, busca, tipo, arquivar/restaurar |
| `231:897` Contas e cartões | `/accounts` | Visão geral, contas e cartões lado a lado, criação contextual |
| Gestão de patrimônio | `/accounts?view=accounts`, `/accounts?view=cards` | Paginação, edição, arquivo e restauração |
| `232:987` Recorrentes | `/fixed-transactions` | Nova recorrência, regras mensais, ocorrências, confirmar/ignorar, ver lançamento |
| `232:1101` Investimentos | `/investments` | Posições, alocação e histórico de aportes reais |
| `232:1215` Metas | `/goals` | Progresso manual, indicadores globais, criar/editar/atualizar |
| `233:1320` Importações | `/imports` | Arquivo, prévia, destino, seleção de linhas, retomada e histórico |
| `233:1434` Configurações | `/settings` | Visão geral de perfil, categorias, backup e segurança |
| Seções de configurações | `/settings?view=profile`, `?view=security`, `?view=data` | Edição de perfil/senha, exclusão reforçada, exportação e restauração |
| `262:1720`, `233:1548` Acesso | `/login`, `/register` | Navegação entre formulários, validação e erros reais |
| `255:1720` Diálogos críticos | Diálogos das telas acima | Transação, confirmação de ocorrência, restauração e progresso de meta |
| `188:281`, `256:1720` Mobile | Mesmas rotas | Menu móvel, navegação inferior e conteúdo fluido desde 320 px |

Os SVGs exportados do Figma estão em `apps/frontend/public/assets/figma`. Paleta, fonte Urbanist, superfícies e componentes compartilhados continuam centralizados no frontend.

## Decisões de implementação

- Valores, nomes e gráficos vêm da API. Nenhum saldo demonstrativo foi copiado do protótipo.
- Investimentos mostram custo de aquisição e aportes, não cotação/rendimento ao vivo. Cartões mostram fechamento e ciclo real; não há número final ou vencimento fictício.
- Os filtros de busca são aplicados no servidor antes da paginação. Agregações de carteira/metas percorrem todas as páginas; totais de caixa/cartões vêm dos agregados da API.
- A cor de categoria é persistida, validada como `#RRGGBB` e incluída no backup. Campo ausente em backup anterior continua aceito; `null` limpa a cor.
- “Nova recorrência” fica visível tanto em Ocorrências quanto em Modelos. Modelo é a regra mensal; ocorrência é a pendência de um mês. Criação/reativação já materializa o mês atual, mas só a confirmação cria a transação. O cron mantém meses seguintes/backfill.
- A prévia de importação fica no servidor. A aba guarda apenas um `batchId` separado por usuário em `sessionStorage`; nenhum extrato ou credencial é persistido ali. Ao recarregar, use “Retomar prévia”. Fechar a aba pode apagar esse atalho; lotes expirados exigem novo envio.
- Restauração `replace` exige digitar `SUBSTITUIR`, além da confirmação explícita. A exclusão da conta continua exigindo senha, literal `EXCLUIR MINHA CONTA` e confirmação final.
- O formulário de acesso preserva a política de sessão existente. Não há checkbox fictício de “manter conectado”, consentimento para termos ainda inexistentes, notificações simuladas ou controles sem efeito. Os valores são reais, não máscaras estáticas do mockup.
- Tutorial passo a passo preservado, com retorno pelo perfil lateral ou Configurações. Diálogos mantêm Escape, foco preso e retorno ao acionador; a digitação não reinicia o foco quando um callback muda.

## Atualização local

Após atualizar a branch, gere o cliente e aplique a migration aditiva antes de iniciar a API:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm dev
```

`pnpm db:migrate` usa o banco configurado no ambiente; confira a URL e faça backup antes de qualquer atualização de produção. Não use reset. Para banco local em arquivos, veja `pnpm db:local` no README. O ajuste anterior para ngrok foi preservado; produção é tratada em [production-deployment.md](production-deployment.md).

## Verificação

`pnpm test:browser` usa portas 3100/3101 e saídas `.next-e2e` no frontend e `dist-e2e` no backend, separadas do servidor local 3000/3001 e dos artefatos de produção. O backend usa `tsconfig.browser.json`, impedindo que sua compilação limpe o `dist` de produção. As portas são configuráveis por `E2E_FRONTEND_PORT` e `E2E_BACKEND_PORT`. O PostgreSQL do browser é descartável. Não forneça uma URL de banco pessoal à suíte.

`e2e/rebranch-ui.spec.ts` percorre as telas consolidadas em 320, 375, 768, 1024 e 1440 px e produz capturas em `test-results/playwright`. `core-flow.spec.ts` cobre lançamentos, categorização, recorrência confirmada e meta manual; `import-backup.spec.ts` cobre prévia retomada e restauração. As suítes de sessão/layout e tutorial continuam compondo o aceite.

Capturas, relatórios, builds, ambientes e cliente Prisma gerado não são versionados. A presença dos testes não implica aprovação: consulte o resultado da execução no candidato que está sendo publicado.

### Validação desta entrega — 04/09/2026

Resultados locais após os ajustes, com Node.js 22, pnpm 10 e PostgreSQL 16 descartável nas suítes de banco:

| Comando | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | Aprovado, sem alteração do lockfile |
| `pnpm db:generate` | Cliente Prisma atualizado |
| `pnpm format:check` | Aprovado |
| `pnpm lint` | Aprovado |
| `pnpm typecheck` | Contratos, backend e frontend aprovados |
| `pnpm test` | 414 testes backend e 82 frontend aprovados |
| `pnpm test:e2e` | 151 testes HTTP aprovados |
| `pnpm test:integration` | 28 testes PostgreSQL aprovados |
| `pnpm test:migration:upgrade` | Upgrade do fixture pré-V1 aprovado, incluindo a quarta migration e preservação das categorias |
| `pnpm build` | Backend e frontend aprovados; `dist/main.js` presente |
| `pnpm build:backend` | Build repetido com artefato presente |
| `pnpm test:smoke` | 28 checks aprovados sobre o artefato de produção e banco vazio com as quatro migrations |
| `pnpm test:browser` | 9 testes aprovados; navegação, formulários, sessão, importação, backup, tutorial e cinco larguras |
| `pnpm audit --audit-level high` | Nenhuma vulnerabilidade conhecida reportada |

As capturas finais foram revisadas em desktop e mobile. A revisão corrigiu filtros com largura excessiva, sobreposição de rótulos no gráfico e overflow em Configurações. Os testes de navegador têm saídas de compilação isoladas para não disputar o `dist` e o `.next` normais.

Esses resultados são locais e específicos desta entrega. Não representam execução da stack Docker, aprovação da CI remota ou deploy em produção.
