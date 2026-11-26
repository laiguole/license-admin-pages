-- 在 Supabase SQL Editor 执行一次。
-- 作用：允许带 license_admin 角色的登录用户写入授权文件（accounts.json）。
-- 公共读取仍然走 Storage 的 public URL，不需要登录。

drop policy if exists "license_admin_storage_all" on storage.objects;

create policy "license_admin_storage_all"
on storage.objects
for all
to authenticated
using (
  bucket_id in ('wlxy')
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'license_admin'
)
with check (
  bucket_id in ('wlxy')
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'license_admin'
);
