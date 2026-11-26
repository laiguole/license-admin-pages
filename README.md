# 软件授权管理网站（GitHub Pages + Supabase）

静态管理后台：GitHub Pages 托管页面，Supabase Auth 负责管理员登录，Supabase Storage 保存各软件的 `accounts.json`。

## 一次性配置

### 1. Supabase Storage 写权限

打开 Supabase Dashboard → SQL Editor，执行 [supabase-setup.sql](supabase-setup.sql)。

### 2. 管理员账号

管理员账号必须带：

```json
{
  "app_metadata": {
    "role": "license_admin"
  }
}
```

可以在 Supabase Dashboard → Authentication → Users 新建用户，然后用 SQL 设置：

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"license_admin"}'::jsonb
where email = '你的管理员邮箱';
```

### 3. 填 anon key

在 Supabase Dashboard → Project Settings → API 复制 **anon public** key，填入 [config.js](config.js)：

```js
supabaseAnonKey: "粘贴 anon public key"
```

不要填 `service_role` / `sb_secret_...`。静态网站里的 key 是公开的。

### 4. 发布到 GitHub Pages

1. 新建 GitHub 仓库，把本目录全部文件推送到 `main` 分支。
2. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
3. 推送后 Actions 会自动部署，地址形如：

```text
https://<用户名>.github.io/<仓库名>/
```

也可以手动运行 `Deploy GitHub Pages` workflow。

如果不想用 Actions，也可以在 Pages 里选择 **Deploy from a branch** → `main` → `/(root)`，GitHub 会直接托管静态文件。

## 日常使用

1. 打开 GitHub Pages 地址，用管理员邮箱/密码登录。
2. 选择产品，新增/停用/删除账号。
3. 点 **保存并发布**，写入 Supabase Storage 的 `accounts.json`。
4. 客户端刷新后读取新的授权列表。

## 新增后续软件

编辑 [config.js](config.js) 的 `products` 数组：

```js
{
  id: "newapp",
  name: "新软件",
  bucket: "newapp",
  object: "accounts.json",
  description: "新软件账号授权"
}
```

要写入新的桶，还需要在 SQL policy 的 `bucket_id in (...)` 中加入该桶，或把 policy 改为只校验管理员角色。

## 安全

- GitHub Pages 只能放 **anon public key**；绝不能放 service_role / sb_secret。
- 管理员登录由 Supabase Auth 负责；只有 `app_metadata.role = license_admin` 的账号能进入管理页。
- Storage 写策略同时校验管理员角色；普通用户即使拿到 anon key 也不能改授权文件。
- 公共 `accounts.json` 仍然可读，客户端无需登录。
- 建议在 Supabase Auth 设置里关闭公开注册（Disable signup），只保留手工创建的管理员。
