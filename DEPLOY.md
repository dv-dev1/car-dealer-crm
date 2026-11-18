# Publicar

O app (site público e painel) sai num Worker só, no endereço `https://car-dealer-crm.<subdomínio>.workers.dev`
(`decisions/2026-11-17-publish-on-workers-dev.md`, no workspace). Rode tudo de dentro de `repo/`.
Nenhum valor de chave entra em arquivo versionado, log ou chat: cada um é digitado no `wrangler secret put`.

O `<subdomínio>` é o da conta: painel da Cloudflare, Workers & Pages, "Subdomain". Abaixo, `<endereço>` é
`https://car-dealer-crm.<subdomínio>.workers.dev`.

## 1. Banco (Neon)

Ensaio numa branch descartável e depois a principal, como em `db/README.md`:

```bash
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"
neon branches create --project-id gentle-math-15516382 --name ensaio-publicacao --no-secrets
export MIGRATE_DATABASE_URL="$(neon connection-string ensaio-publicacao --project-id gentle-math-15516382)"
node db/migrate.ts          # applied: 0003_... até 0013_login_attempts.sql
node db/migrate.ts          # nothing to apply
neon branches delete ensaio-publicacao --project-id gentle-math-15516382

export MIGRATE_DATABASE_URL="$(neon connection-string main --project-id gentle-math-15516382)"
node db/migrate.ts
npm run demo:store -- --store-id <uuid da Maré>     # refaz os dados da demo com o catálogo atual
unset MIGRATE_DATABASE_URL
```

Loja de demonstração para outra pessoa (o sócio, um lojista em teste):
`npm run demo:store -- --slug <slug> --owner-name "<nome>" --owner-email <e-mail>`, com o `MIGRATE_DATABASE_URL` da principal.

O site mostra a loja de `SITE_STORE_SLUG` (`vars` do `wrangler.jsonc`, hoje `mare-veiculos`). Se o slug da Maré
no Neon for outro, troque ali antes de publicar: com slug errado o site abre sem nenhum carro.

## 2. Fotos (R2)

```bash
npx wrangler r2 bucket create car-dealer-crm-photos
```

## 3. Contas de fora (só o fundador faz)

- **WorkOS, ambiente de produção.** Ligue só Magic Auth e Google. Redirecionamento: `<endereço>/callback`;
  saída (sign-out redirect): `<endereço>/entrar`. Gere a chave de API de produção. A chave `sk_test_` do
  staging foi colada num chat: troque-a também no painel do staging.
- **Google.** Cliente OAuth próprio ligado na WorkOS de produção (as credenciais compartilhadas da WorkOS só
  valem no staging).
- **Turnstile.** Um widget com o domínio `car-dealer-crm.<subdomínio>.workers.dev`. As chaves de teste do
  `.dev.vars.example` passam qualquer robô: nunca em produção.
- **OpenAI.** Uma chave nova (a antiga foi colada num chat). Sem ela o app funciona e a IA fica desligada.

## 4. Segredos do Worker

Um por vez; o comando pede o valor e não o mostra. No primeiro, aceite criar o Worker.

```bash
npx wrangler secret put WORKOS_API_KEY
npx wrangler secret put WORKOS_CLIENT_ID
npx wrangler secret put WORKOS_COOKIE_PASSWORD             # 32+ caracteres, novo: openssl rand -base64 32
npx wrangler secret put NEXT_PUBLIC_WORKOS_REDIRECT_URI    # <endereço>/callback
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put NEXT_PUBLIC_TURNSTILE_SITE_KEY
npx wrangler secret put OPENAI_API_KEY                     # opcional
```

## 5. Publicar

```bash
npm test && npx tsc --noEmit
npm run deploy
```

O `deploy` monta o app, confere que nenhum valor do `.dev.vars` foi parar no pacote e publica com o cookie da
sessão preso ao endereço (`__Host-wos-session`).

## 6. Conferir no ar

```bash
curl -sI <endereço>/ | grep -iE "^HTTP|x-content-type-options|x-frame-options|strict-transport|referrer-policy"
curl -s <endereço>/nossos-carros | grep -c "/carro/"      # mais que zero: o site lê o Neon
```

- Entrar em `<endereço>/entrar` com o e-mail do dono, por código e pelo Google.
- Numa página de carro, enviar "Tenho interesse" e ver o cliente em Clientes, com origem "Site".
- No DevTools, o cookie da sessão se chama `__Host-wos-session`, `Secure` e `HttpOnly`.
- `npx wrangler tail` mostra os erros do Worker.

## A confirmar na primeira publicação

- O Hyperdrive conecta no Neon sem `channel_binding` na URL (se falhar: `npx wrangler hyperdrive update` com a URL sem o parâmetro).
- O limite `LOGIN_RATE_LIMITER` (5 por minuto) conta por localidade da Cloudflare; o limite por e-mail no banco
  (`use_login_attempt`, 10 em 15 minutos) é o que vale no mundo inteiro.
- Cadastro de carro com foto num iPhone (o Safari manda JPEG).
- `wa.me/558390000000` (WhatsApp fictício da demo) não cai num celular de verdade.

## Tirar do ar

`"workers_dev": false` no `wrangler.jsonc` e `npm run deploy`: o endereço para de responder.
