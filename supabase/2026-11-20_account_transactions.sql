-- Retraits, dépôts et payouts par compte.
-- À coller une fois dans Supabase > SQL Editor > New query > Run. Peut être relancé sans danger.

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
