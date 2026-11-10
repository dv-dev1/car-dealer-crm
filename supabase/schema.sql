-- ============================================================
-- Cassiano Veículos — Schema do banco (Supabase / PostgreSQL)
-- ------------------------------------------------------------
-- Este é o CONTRATO compartilhado entre o site público e o
-- sistema/admin. O site lê `veiculos`; o admin faz CRUD em
-- `veiculos`, registra `vendas` e gerencia `leads` (Kanban).
--
-- Como aplicar: Supabase Dashboard > SQL Editor > cole e rode.
-- ============================================================

-- Extensão pra gerar UUIDs
create extension if not exists "pgcrypto";

-- ─── VEÍCULOS (estoque) ──────────────────────────────────────
create table if not exists veiculos (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,               -- usado na URL /carro/[slug]
  marca         text not null,                      -- ex: "Chevrolet"
  modelo        text not null,                      -- ex: "Tracker 1.2 Premier Turbo"
  titulo        text not null,                      -- nome completo exibido
  ano           int  not null,
  km            int  not null default 0,
  preco         numeric(12,2) not null,
  cambio        text not null default 'Automática', -- Automática | Manual
  combustivel   text not null default 'Flex',       -- Gasolina e álcool | Flex | Diesel...
  cor           text,
  portas        int  default 4,
  carroceria    text,                               -- SUV | Sedã | Hatch...
  potencia      text,                               -- ex: "132 hp"
  motor         text,                               -- ex: "1.2"
  descricao     text,
  fotos         text[] default '{}',                -- URLs das fotos (1ª = capa)
  equipamentos  text[] default '{}',                -- opcionais/equipamentos
  ficha_tecnica jsonb  default '{}'::jsonb,          -- pares chave/valor livres
  status        text not null default 'disponivel', -- disponivel | reservado | vendido
  destaque      boolean not null default false,     -- aparece em "Destaques do estoque"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_veiculos_status   on veiculos(status);
create index if not exists idx_veiculos_destaque on veiculos(destaque);

-- ─── VENDAS (dashboard) ──────────────────────────────────────
create table if not exists vendas (
  id             uuid primary key default gen_random_uuid(),
  veiculo_id     uuid references veiculos(id) on delete set null,
  valor          numeric(12,2) not null,
  data_venda     date not null default current_date,
  forma_pagamento text,                             -- À vista | Financiamento | Consórcio...
  vendedor       text,
  cliente_nome   text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_vendas_data on vendas(data_venda);

-- ─── LEADS (Kanban de clientes) ──────────────────────────────
create table if not exists leads (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  contato            text,                          -- telefone/whatsapp
  email              text,
  veiculo_interesse  uuid references veiculos(id) on delete set null,
  temperatura        text not null default 'frio',  -- frio | morno | quente
  estagio            text not null default 'novo',  -- coluna do Kanban (novo | contato | negociacao | fechamento | ganho | perdido)
  ordem              int default 0,                 -- ordenação dentro da coluna
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_leads_estagio on leads(estagio);

-- ─── updated_at automático ───────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_veiculos_updated on veiculos;
create trigger trg_veiculos_updated before update on veiculos
  for each row execute function set_updated_at();

drop trigger if exists trg_leads_updated on leads;
create trigger trg_leads_updated before update on leads
  for each row execute function set_updated_at();

-- ─── RLS (Row Level Security) ────────────────────────────────
-- Site público: leitura de veículos liberada. Escrita e as tabelas
-- de vendas/leads só via admin autenticado (a definir na Fase 2).
alter table veiculos enable row level security;
alter table vendas   enable row level security;
alter table leads    enable row level security;

drop policy if exists "leitura pública de veículos" on veiculos;
create policy "leitura pública de veículos"
  on veiculos for select
  using (true);

-- (As policies de escrita/admin entram na Fase 2, junto com o auth.)
