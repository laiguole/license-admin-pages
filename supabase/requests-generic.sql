-- 已有 license_requests 表时，只需执行这一条，让后续软件也能提交申请。
-- 在 Supabase SQL Editor 执行一次。

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
