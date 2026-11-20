-- Yassni Trading Hub : à coller en une fois dans Supabase > SQL Editor > New query > Run.
-- Le script peut être relancé sans danger.

-- 1) Cache des données de marché (prix Yahoo, COT, calendrier) partagé PC / téléphone
create table if not exists public.market_cache (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.market_cache enable row level security;
drop policy if exists "cache lecture/écriture si connecté" on public.market_cache;
create policy "cache lecture/écriture si connecté" on public.market_cache
  for all to authenticated using (true) with check (true);

-- 2) Comptes de trading (prop firm, réel, démo)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  type text not null check (type in ('prop', 'reel', 'demo')),
  currency text not null default 'USD',
  initial_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 3) Trades
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  market text not null,
  side text not null check (side in ('Long', 'Short')),
  opened_at timestamptz not null,
  closed_at timestamptz,
  lot numeric,
  entry numeric,
  exit numeric,
  sl numeric,
  tp numeric,
  pnl numeric not null default 0,       -- P&L net (frais déjà déduits)
  fees numeric not null default 0,
  setup text,
  mistakes text[] not null default '{}',
  emotion text,
  rating int check (rating between 1 and 5),
  notes text,
  screenshots text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists trades_user_date on public.trades (user_id, opened_at);

-- 4) Note du jour (calendrier P&L)
create table if not exists public.day_notes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  note text not null default '',
  primary key (user_id, day)
);

-- 5) Contenu de la page Stratégie ACR
create table if not exists public.strategy (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  content jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Chaque utilisateur ne voit que ses propres lignes
do $$
declare t text;
begin
  foreach t in array array['accounts', 'trades', 'day_notes', 'strategy'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "mes lignes" on public.%I', t);
    execute format(
      'create policy "mes lignes" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t);
  end loop;
end $$;

-- 6) Stockage privé des captures d'écran (un dossier par utilisateur)
insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do nothing;

drop policy if exists "captures : mes fichiers (lecture)" on storage.objects;
drop policy if exists "captures : mes fichiers (ajout)" on storage.objects;
drop policy if exists "captures : mes fichiers (suppression)" on storage.objects;
create policy "captures : mes fichiers (lecture)" on storage.objects for select to authenticated
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "captures : mes fichiers (ajout)" on storage.objects for insert to authenticated
  with check (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "captures : mes fichiers (suppression)" on storage.objects for delete to authenticated
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);

-- 7) Retraits, dépôts et payouts par compte
create table if not exists public.account_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  type text not null check (type in ('withdrawal', 'deposit', 'payout')),
  amount numeric not null check (amount > 0),  -- toujours positif : le type donne le sens
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists account_transactions_user_date on public.account_transactions (user_id, date);

-- RLS : chaque utilisateur ne voit et ne modifie que ses lignes, et seulement sur ses propres comptes.
alter table public.account_transactions enable row level security;
drop policy if exists "mes lignes" on public.account_transactions;
create policy "mes lignes" on public.account_transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );
