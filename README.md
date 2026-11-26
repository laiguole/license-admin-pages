# 软件授权管理网站（GitHub Pages + Supabase）

静态管理后台：GitHub Pages 托管页面，Supabase Auth 负责管理员登录，Supabase Storage 保存各软件的 `accounts.json`。

## 一次性配置

### 1. Supabase Storage 写权限 + 申请审核表

打开 Supabase Dashboard → SQL Editor，依次执行：

1. [supabase-setup.sql](supabase-setup.sql)：允许管理员写入 `wlxy` 桶
2. [supabase-requests.sql](supabase-requests.sql)：创建 `license_requests` 申请审核表

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

当前线上地址：

```text
https://laiguole.github.io/license-admin-pages/
```

已使用 **Deploy from a branch**：`main` → `/(root)`。

以后更新：

1. 修改 `config.js` 或页面文件；
2. 推送到 `main`；
3. GitHub Pages 会自动重新构建。

不需要额外的构建命令或 workflow。

## 日常使用

1. 未授权用户登录软件后，点顶部 **申请授权**，客户端提交账号 ID 到“待审核申请”。
2. 管理员打开授权站，待审核列表会显示账号 ID 和所属软件，点“通过”或“拒绝”。
3. 通过后账号自动写入对应软件的 `accounts.json`，客户端 30 秒内自动放行。
4. 也可以手动“新增账号”，不经过申请。
5. 停用/删除账号后，客户端 5 分钟内自动失效。

## 新增后续软件

完整的统一授权说明见 [AUTH-SYSTEM.md](AUTH-SYSTEM.md)。简短流程：

1. 在 [config.js](config.js) 的 `products` 增加产品（推荐复用 `wlxy` 桶，对象用 `<产品ID>/accounts.json`）。
2. 在 Supabase 执行一次 [supabase-requests-generic.sql](supabase-requests-generic.sql)，让新软件也能提交申请。
3. 新软件客户端按 [INTEGRATION.md](INTEGRATION.md) 接入账号检查和申请。
4. 管理员在授权站“待审核申请”里通过，自动写入对应产品的 `accounts.json`。

## 安全

- GitHub Pages 只能放 **anon public key**；绝不能放 service_role / sb_secret。
- 管理员登录由 Supabase Auth 负责；只有 `app_metadata.role = license_admin` 的账号能进入管理页。
- Storage 写策略同时校验管理员角色；普通用户即使拿到 anon key 也不能改授权文件。
- 公共 `accounts.json` 仍然可读，客户端无需登录。
- 建议在 Supabase Auth 设置里关闭公开注册（Disable signup），只保留手工创建的管理员。
