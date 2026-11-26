-- 在 Supabase SQL Editor 执行一次。
-- 作用：允许客户端提交“账号授权申请”，管理员在授权站审核。

create table if not exists public.license_requests (
  product_id text not null,
  account_id text not null,
  name text,
  note text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, account_id)
);

alter table public.license_requests enable row level security;

drop policy if exists "license_request_insert" on public.license_requests;
create policy "license_request_insert"
on public.license_requests
for insert
to anon
with check (
  length(product_id) between 1 and 40
  and length(account_id) between 1 and 128
  and status = 'pending'
);

drop policy if exists "license_request_admin" on public.license_requests;
create policy "license_request_admin"
on public.license_requests
for all
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'license_admin'
)
with check (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'license_admin'
);

grant insert on public.license_requests to anon;
grant select, update, delete on public.license_requests to authenticated;
