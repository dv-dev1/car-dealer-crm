# Banco no Neon e Hyperdrive

Roteiro para aplicar a migração no Neon e ligar o Worker a ele. Rode tudo de dentro de `repo/`.
Nenhum comando leva URL ou senha digitada: a do administrador vem do `neon connection-string` para uma
variável de ambiente; a do app fica só no arquivo `--out` (JSON `{ "url": ... }`, modo 0600, em `secrets/`).
O Neon só aceita senha em texto puro no `create/alter role`, então a do `crm_app` pode aparecer nos logs
do servidor dele; na dúvida, troque-a. Nunca cole URL ou senha aqui, em log ou no chat.

## 1. Ensaio numa branch do Neon

A migração e o `create-app-login` rodam com o dono do banco, que no Neon não é superusuário: ensaie
numa branch descartável, nunca direto na principal.

```bash
neon branches create --project-id gentle-math-15516382 --name ensaio-fundacao --no-secrets
export MIGRATE_DATABASE_URL="$(neon connection-string ensaio-fundacao --project-id gentle-math-15516382)"
node db/migrate.ts                                                        # applied: 0001_stores_and_memberships.sql
node db/migrate.ts                                                        # nothing to apply
node scripts/create-app-login.ts --out ../secrets/neon-ensaio.local.json  # cria o crm_app
node scripts/create-app-login.ts --out ../secrets/neon-ensaio.local.json  # troca a senha
node --input-type=module -e 'import { createPool } from "./db/migrate.ts"; const pool = createPool(process.env.MIGRATE_DATABASE_URL); console.log((await pool.query("select lower($1::text) as lower, current_setting($2) as version", ["É", "server_version"])).rows[0]); await pool.end()'
```

Os dois `create-app-login` precisam terminar com `App login URL written to ...`: o script entra com o
login novo e confere que ele não é superusuário, não tem `BYPASSRLS` e não vê nenhuma linha. A última
linha usa o `createPool` do repo (WebSocket): a porta 5432 pode estar bloqueada e o `psql` não serve.
Em 2026-11-11 devolveu `é` e PostgreSQL 18.6, como o `toLowerCase()` do app; se vier outra coisa, pare.
Deu tudo certo? Apague o ensaio:

```bash
neon branches delete ensaio-fundacao --project-id gentle-math-15516382
rm ../secrets/neon-ensaio.local.json
unset MIGRATE_DATABASE_URL
```

## 2. Na branch principal

```bash
export MIGRATE_DATABASE_URL="$(neon connection-string main --project-id gentle-math-15516382)"
node db/migrate.ts                                                        # applied: 0001_stores_and_memberships.sql
node db/migrate.ts                                                        # nothing to apply
node scripts/create-app-login.ts --out ../secrets/neon-app.local.json
unset MIGRATE_DATABASE_URL
npx wrangler hyperdrive create car-dealer-crm --caching-disabled --connection-string="$(node -p 'JSON.parse(require("fs").readFileSync("../secrets/neon-app.local.json","utf8")).url')"
```

O Hyperdrive é criado sempre com `--caching-disabled`. Cole o `id` que ele devolve no lugar dos zeros
em `hyperdrive[0].id` do `wrangler.jsonc`. `npx wrangler hyperdrive list` deve mostrar `car-dealer-crm`.

## Regras

- Nunca defina `APP_DATABASE_URL` no Worker, nem por `wrangler secret`: ela passa na frente do
  Hyperdrive (`src/shared/db/connection.ts`). Ela existe só para testes e scripts.
- WorkOS: deixe ligados só Magic Auth e Google. Cadastre o redirecionamento de saída (sign-out
  redirect): `http://localhost:8787/entrar` no Worker local e, depois, o `/entrar` de produção.
- Turnstile: em produção, use as chaves reais do site, nunca as de teste.

## Trocar a senha do login do app

```bash
export MIGRATE_DATABASE_URL="$(neon connection-string main --project-id gentle-math-15516382)"
node scripts/create-app-login.ts --out ../secrets/neon-app.local.json
unset MIGRATE_DATABASE_URL
npx wrangler hyperdrive update <id do Hyperdrive> --connection-string="$(node -p 'JSON.parse(require("fs").readFileSync("../secrets/neon-app.local.json","utf8")).url')"
```

A senha antiga para de valer na hora: o app fica fora do ar até o `hyperdrive update`. Se o `create-app-login`
falhar depois de trocar a senha (a autoverificação não passou), rode-o de novo e só então o
`hyperdrive update`: o arquivo ainda guarda a senha antiga.
