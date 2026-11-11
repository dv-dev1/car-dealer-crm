# Banco no Neon e Hyperdrive

Roteiro para aplicar a migração no Neon e ligar o Worker a ele. Rode tudo de dentro de `repo/`.
As URLs ficam em `secrets/neon.local.json` do workspace, fora do repo. Passe-as por variável de
ambiente e nunca cole URL ou senha neste arquivo, em log ou no chat.

## 1. Ensaio numa branch do Neon

O dono do banco no Neon não é superusuário, e a migração e o `create-app-login` rodam com ele.
Por isso, primeiro numa branch descartável, nunca direto na principal:

```bash
neon branches create --project-id gentle-math-15516382 --name ensaio-fundacao --no-secrets
export MIGRATE_DATABASE_URL="$(neon connection-string ensaio-fundacao --project-id gentle-math-15516382)"
node db/migrate.ts                                                        # applied: 0001_stores_and_memberships.sql
node db/migrate.ts                                                        # nothing to apply
node scripts/create-app-login.ts --out ../secrets/neon-ensaio.local.json  # cria o crm_app
node scripts/create-app-login.ts --out ../secrets/neon-ensaio.local.json  # troca a senha
psql "$MIGRATE_DATABASE_URL" -c "select lower('É')"
```

Os dois `create-app-login` precisam terminar com `App login URL written to ...`: o script entra
com o login novo e confere que ele não é superusuário, não tem `BYPASSRLS` e não vê nenhuma linha.
O `select lower('É')` deve devolver `é`, como o `toLowerCase()` do app. Anote o resultado no
`current-state.md` do workspace; se vier outra coisa, pare e avise. Deu tudo certo? Apague o ensaio:

```bash
neon branches delete ensaio-fundacao --project-id gentle-math-15516382
rm ../secrets/neon-ensaio.local.json
unset MIGRATE_DATABASE_URL
```

## 2. Na branch principal

```bash
MIGRATE_DATABASE_URL="<url_unpooled>" node db/migrate.ts      # applied: 0001_stores_and_memberships.sql
MIGRATE_DATABASE_URL="<url_unpooled>" node db/migrate.ts      # nothing to apply
MIGRATE_DATABASE_URL="<url_unpooled>" node scripts/create-app-login.ts --out ../secrets/neon-app.local.json
npx wrangler hyperdrive create car-dealer-crm --caching-disabled --connection-string="<url from neon-app.local.json>"
```

O Hyperdrive é criado sempre com `--caching-disabled`. Cole o `id` que ele devolve no lugar dos
zeros em `hyperdrive[0].id` do `wrangler.jsonc`. `npx wrangler hyperdrive list` deve mostrar
`car-dealer-crm`.

## Regras

- Nunca defina `APP_DATABASE_URL` no Worker, nem por `wrangler secret`: ela passa na frente do
  Hyperdrive (`src/shared/db/connection.ts`). Ela existe só para testes e scripts.
- WorkOS: deixe ligados só Magic Auth e Google. Cadastre o redirecionamento de saída (sign-out
  redirect): `http://localhost:8787/entrar` no Worker local e, depois, o `/entrar` de produção.
- Turnstile: em produção, use as chaves reais do site, nunca as de teste.

## Trocar a senha do login do app

```bash
MIGRATE_DATABASE_URL="<url_unpooled>" node scripts/create-app-login.ts --out ../secrets/neon-app.local.json
npx wrangler hyperdrive update <id do Hyperdrive> --connection-string="<url from neon-app.local.json>"
```

A senha antiga para de valer na hora: o app fica fora do ar até o `hyperdrive update`.
