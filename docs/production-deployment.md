# Deploy em produção

Este documento descreve como publicar a V1 do My Finance App. Ele é independente de provedor, mas assume a arquitetura e os artefatos existentes no repositório:

- Node.js 22 e pnpm 10;
- frontend Next.js em `apps/frontend`;
- API NestJS em `apps/backend`;
- PostgreSQL 16;
- imagens Docker construídas a partir da raiz do monorepo;
- HTTPS obrigatório no acesso público.

O `docker-compose.yml` do repositório é uma stack de desenvolvimento local. Ele contém credenciais de exemplo, usa cookies não seguros e publica o PostgreSQL no host. Não o utilize como configuração de produção.

## Arquitetura recomendada

Use um único domínio público e faça o balanceador, ingress ou reverse proxy encaminhar as rotas:

```text
https://finance.example.com
├── /api/v1/*       -> backend:3001
├── /health/live    -> backend:3001
├── /health/ready   -> backend:3001
└── demais rotas    -> frontend:3000

backend -> PostgreSQL 16 em rede privada
```

Essa topologia mantém frontend e API na mesma origem, simplifica cookies e evita expor o banco. O PostgreSQL nunca deve possuir uma porta pública.

O rewrite existente em `apps/frontend/next.config.ts`, apontando para `127.0.0.1:3001`, é apenas uma conveniência para desenvolvimento local e ngrok. Em produção, o ingress deve interceptar `/api/v1/*` antes que a requisição chegue ao Next.js. Se a plataforma não oferecer roteamento por caminho, parametrize o destino do rewrite com uma variável de servidor, como `API_INTERNAL_URL`, antes do deploy; dentro de containers separados, `127.0.0.1` não aponta para o backend.

## Alternativa com dois domínios

Também é possível publicar, por exemplo:

```text
https://finance.example.com     -> frontend
https://api.finance.example.com -> backend
```

Nesse caso:

- construa o frontend com `NEXT_PUBLIC_API_URL=https://api.finance.example.com/api/v1`;
- configure `CORS_ORIGINS=https://finance.example.com`;
- use `COOKIE_SECURE=true`; mantenha `COOKIE_SAMESITE=lax` quando ambos forem HTTPS sob o mesmo domínio registrável. Somente origens realmente cross-site precisam de `none`, sujeito ao bloqueio de cookies de terceiros do navegador;
- mantenha `COOKIE_DOMAIN` vazio para criar um cookie host-only na API;
- confirme que o provedor encaminha cabeçalhos `Origin`, `Set-Cookie` e `X-Forwarded-Proto` sem removê-los.

A topologia de origem única é preferível porque reduz a superfície de configuração de CORS, CSRF e cookies.

## Pré-requisitos

Antes de publicar:

1. escolha um serviço de PostgreSQL 16 com armazenamento persistente, backups e conexão privada;
2. crie serviços separados para frontend e backend, ou dois containers no mesmo ambiente;
3. configure DNS e um certificado TLS válido;
4. armazene segredos no cofre de segredos do provedor, nunca em arquivos versionados;
5. execute todos os gates da branch que será publicada.

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:integration
pnpm test:migration:upgrade
pnpm build
pnpm test:smoke
pnpm test:browser
pnpm audit --audit-level high
```

`pnpm verify:all` reúne os gates depois da instalação e da geração do Prisma Client. Não publique uma revisão cuja CI esteja vermelha.

## Variáveis do backend

Exemplo para a topologia recomendada de origem única:

```env
NODE_ENV=production
PORT=3001

DATABASE_URL=postgresql://USUARIO:SENHA@HOST_PRIVADO:5432/finance?schema=public&sslmode=require
JWT_SECRET=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000

CORS_ORIGINS=https://finance.example.com
APP_TIMEZONE=America/Sao_Paulo

COOKIE_DOMAIN=
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

MAX_UPLOAD_BYTES=5242880
MAX_IMPORT_ROWS=5000
IMPORT_BATCH_TTL_MINUTES=60
MAX_BACKUP_BYTES=20971520

ENABLE_CRON=true
ENABLE_SWAGGER=false
RUN_MIGRATIONS=false
```

Observações:

- gere `JWT_SECRET` com um gerador criptograficamente seguro; por exemplo, `openssl rand -base64 48`;
- use a opção TLS exigida pelo provedor na `DATABASE_URL`; `sslmode=require` é apenas um exemplo comum;
- `CORS_ORIGINS` aceita origens exatas separadas por vírgula e sem caminhos;
- `COOKIE_SECURE=true` é validado como obrigatório quando `NODE_ENV=production`;
- deixe `COOKIE_DOMAIN` vazio, exceto quando houver uma necessidade comprovada de compartilhar o cookie entre subdomínios;
- mantenha Swagger desabilitado publicamente, salvo se ele for protegido por autenticação e houver uma necessidade operacional;
- ajuste também o limite de corpo do ingress para aceitar os valores configurados em `MAX_UPLOAD_BYTES` e `MAX_BACKUP_BYTES`.

Nunca reutilize os valores de Compose ou CI em produção.

## Variáveis e build do frontend

Na topologia de origem única:

```env
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_APP_NAME=My Finance App
```

`NEXT_PUBLIC_API_URL` é incorporada ao bundle durante o build. Alterar essa variável somente no container já construído não modifica o JavaScript entregue ao navegador; reconstrua a imagem quando seu valor mudar.

O arquivo `.env.local` é ignorado pelo Git e serve ao desenvolvimento. Configure as variáveis de produção no provedor ou como argumentos do build.

## Construção das imagens

Execute os builds a partir da raiz do monorepo.

Backend:

```bash
docker build \
  -f apps/backend/Dockerfile \
  -t registry.example.com/my-finance-backend:REVISAO .
```

Frontend com origem única:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=/api/v1 \
  -f apps/frontend/Dockerfile \
  -t registry.example.com/my-finance-frontend:REVISAO .
```

Use uma tag imutável, de preferência o SHA do commit. Não use apenas `latest`, pois isso torna o rollback ambíguo.

As imagens executam como usuário sem privilégios e usam `tini`. O backend inicia `dist/main.js`; o frontend usa o bundle standalone gerado pelo Next.js.

## Banco e migrations

As migrations são progressivas e não existe um fluxo automático de downgrade.

Procedimento recomendado:

1. faça um backup verificável do banco;
2. execute `prisma migrate deploy` como um release job único usando a nova imagem do backend;
3. somente depois da migration bem-sucedida, atualize as instâncias da API;
4. mantenha `RUN_MIGRATIONS=false` nas instâncias normais para evitar que cada réplica tente migrar ao iniciar.

Exemplo dentro da imagem do backend:

```bash
pnpm exec prisma migrate deploy
```

O `docker-entrypoint.sh` executa esse comando automaticamente quando `RUN_MIGRATIONS=true`. Essa opção é conveniente em um único container, mas um job de release separado é mais previsível em ambientes com múltiplas réplicas.

Nunca execute `prisma migrate reset` em produção. Não use bancos de produção nas suítes de integração, migration ou browser; esses testes possuem operações destrutivas e aceitam apenas bancos identificados como descartáveis.

## Ordem do deploy

Use esta sequência:

1. confirme a CI verde para a revisão;
2. construa e publique imagens imutáveis;
3. crie e teste o backup do PostgreSQL;
4. execute o release job de migrations;
5. publique o backend e aguarde a readiness;
6. publique o frontend;
7. atualize o ingress/DNS, se necessário;
8. execute os testes pós-deploy.

Durante rollout gradual, mantenha migrations compatíveis com a versão anterior da aplicação. Alterações destrutivas de schema devem ser divididas em mais de uma versão: expandir, migrar dados, trocar consumidores e somente depois remover estruturas antigas.

## Healthchecks

A API fornece:

```text
GET /health/live
GET /health/ready
```

- liveness comprova que o processo responde;
- readiness consulta o PostgreSQL e retorna 503 enquanto o banco estiver indisponível.

Configure o balanceador para enviar tráfego somente quando `/health/ready` retornar 200. Use `/health/live` para decidir se o processo precisa ser reiniciado. Não use a página inicial ou uma rota autenticada como healthcheck.

O frontend pode usar uma verificação HTTP simples em `/`, esperando 200.

## Recorrências e processos sempre ativos

O job que gera ocorrências recorrentes está embutido no backend e roda diariamente às 03:00 em `APP_TIMEZONE`. Criar ou reativar uma recorrência já prepara a ocorrência do mês vigente, atomicamente e sem duplicar. Isso cria uma pendência, não uma transação confirmada.

Consequências operacionais da implementação atual:

- pelo menos uma instância com `ENABLE_CRON=true` precisa permanecer ativa às 03:00;
- não use scale-to-zero nessa instância;
- em múltiplas réplicas, prefira habilitar o cron em apenas uma delas;
- o processamento é idempotente e recupera períodos recentes, mas somente quando o job efetivamente executa.

Não há geração no startup ou na leitura das telas. Para meses seguintes e backfill de períodos ausentes, a disponibilidade do processo das 03:00 continua sendo requisito de produção.

## Segurança e rede

- exponha somente HTTPS nas portas públicas;
- mantenha PostgreSQL e a porta 3001 em rede privada quando o ingress fizer o roteamento público;
- restrinja a conexão do banco às identidades ou redes do backend;
- rotacione `JWT_SECRET` por um procedimento planejado, pois a troca invalida access tokens existentes;
- não registre cookies, tokens, senhas, payloads de backup ou conteúdo integral de importações;
- aplique rate limiting também no ingress quando disponível;
- proteja backups com criptografia, retenção e controle de acesso;
- mantenha dependências e imagens-base atualizadas após passar novamente pelos gates.

Ngrok é adequado para demonstrações temporárias, não é parte da topologia de produção. Remova domínios ngrok de `allowedDevOrigins` e de qualquer variável de produção. Nunca crie um túnel TCP público para o PostgreSQL.

## Observabilidade

Colete pelo menos:

- logs estruturados do frontend, backend e ingress;
- código HTTP, latência e volume por rota;
- erros 5xx e falhas de autenticação sem dados sensíveis;
- disponibilidade de `/health/ready`;
- uso de CPU e memória;
- conexões, espaço, latência e backups do PostgreSQL;
- execução e resultado do job de recorrências.

Os erros da API incluem `requestId`. Preserve `X-Request-Id` no ingress para correlacionar uma falha vista pelo usuário com os logs do backend.

## Testes pós-deploy

Depois de cada publicação, valide em HTTPS:

1. página inicial e assets do Next.js;
2. cadastro, login, refresh e logout;
3. `/health/live` e `/health/ready`;
4. criação de conta, categoria e transação;
5. consulta do dashboard;
6. upload de uma importação pequena até o preview, sem confirmar dados indevidos;
7. exportação de backup por um usuário de teste;
8. ausência de erros de CORS, mixed content e cookies no navegador;
9. navegação móvel e carregamento dos chunks;
10. logs sem segredos ou dados financeiros completos.

Exemplos mínimos:

```bash
curl --fail --show-error https://finance.example.com/health/live
curl --fail --show-error https://finance.example.com/health/ready
curl --fail --show-error https://finance.example.com/api/v1/auth/csrf
```

## Rollback

Mantenha as imagens das revisões anteriores disponíveis. Se o problema estiver somente na aplicação e a migration for compatível, reverta frontend e backend para as tags anteriores.

Não reverta o schema automaticamente. Quando a migration não for compatível com a versão anterior:

1. retire a aplicação de tráfego ou ative manutenção;
2. preserve o banco atual;
3. avalie uma migration corretiva para frente;
4. restaure um backup apenas quando a perda das alterações posteriores for compreendida e aceita.

Registre revisão, horário, operador, migrations aplicadas e resultado dos testes em cada deploy.

## Checklist final

- [ ] CI e auditoria aprovadas.
- [ ] Imagens identificadas por SHA do commit.
- [ ] PostgreSQL 16 privado, persistente e com backup testado.
- [ ] Migrations executadas uma única vez antes do rollout.
- [ ] `NODE_ENV=production` e `COOKIE_SECURE=true`.
- [ ] `JWT_SECRET` forte armazenado como segredo.
- [ ] `NEXT_PUBLIC_API_URL` definido durante o build.
- [ ] HTTPS e DNS válidos.
- [ ] Roteamento de `/api/v1`, liveness e readiness conferido.
- [ ] Swagger desabilitado ou protegido.
- [ ] Pelo menos uma instância do cron ativa às 03:00.
- [ ] Nenhum domínio ngrok ou credencial de desenvolvimento na configuração.
- [ ] Smoke pós-deploy concluído.
- [ ] Procedimento de rollback e responsáveis definidos.
