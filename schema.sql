create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists accounts (
    id uuid primary key default gen_random_uuid(),
    email citext not null unique,
    password_hash text not null,
    full_name text not null,
    role text not null check (role in ('admin', 'user')),
    merchant_id text,
    is_active boolean not null default true,
    token_version integer not null default 0,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_role on accounts(role);
create index if not exists idx_accounts_merchant_id on accounts(merchant_id);
create index if not exists idx_accounts_active_role on accounts(is_active, role);

create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_accounts_updated_at on accounts;
create trigger trg_accounts_updated_at
before update on accounts
for each row
execute function set_updated_at();

-- Run automatically only if the CSV transaction table already exists.
-- These indexes keep role-scoped queries fast for merchant/user accounts.
do $$
begin
    if to_regclass('public.transactions') is not null
       and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'transactions'
             and column_name = 'merchant_id'
       ) then
        create index if not exists idx_transactions_merchant_id
            on transactions(merchant_id);
    end if;

    if to_regclass('public.transactions') is not null
       and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'transactions'
             and column_name = 'merchant_id'
       )
       and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'transactions'
             and column_name = 'transaction_time'
       ) then
        create index if not exists idx_transactions_merchant_created_at
            on transactions(merchant_id, transaction_time desc);
    end if;
end $$;
