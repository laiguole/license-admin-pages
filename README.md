# 软件授权管理站

独立项目：GitHub Pages 静态授权后台 + Supabase Auth/Storage。

- 线上站点：https://laiguole.github.io/license-admin-pages/
- GitHub 仓库：https://github.com/laiguole/license-admin-pages
- Supabase 项目：https://vrpplnwjmevqvbdnsygg.supabase.co

## 功能

- 管理员邮箱/密码登录（Supabase Auth）
- 多软件产品切换
- 账号新增、名称/备注修改、启用/停用、删除
- 待审核申请：显示账号 ID、所属软件、申请时间
- 通过申请后自动写入对应软件的 `accounts.json`
- 搜索、状态筛选、导入/导出
- 修改管理员密码

## 目录

```text
license-admin-site/
├─ index.html / app.js / styles.css   # GitHub Pages 静态页面
├─ config.js                          # Supabase public key 和产品列表
├─ docs/
│  ├─ AUTH-SYSTEM.md                  # 统一授权架构、客户端标准流程
│  └─ INTEGRATION.md                  # 发给其他项目的接入指令
├─ supabase/
│  ├─ storage-policy.sql              # Storage 管理员写权限
│  ├─ requests.sql                    # 申请表+策略（首次初始化）
│  └─ requests-generic.sql            # 已有表时放开产品限制
├─ ADMIN_LOGIN.txt                    # 本地登录信息，已 gitignore
└─ .nojekyll
```

## 授权数据

存储桶：`wlxy`（公共读）

```text
wlxy/
├─ accounts.json                 # 网院学习助手
├─ myapp/accounts.json           # 后续软件
└─ otherapp/accounts.json
```

格式：

```json
{
  "updated": "2026-11-26",
  "accounts": {
    "账号ID": {
      "active": true,
      "name": "可选",
      "note": "可选"
    }
  }
}
```

## 部署

当前使用 GitHub Pages 的 **Deploy from a branch**：

- 分支：`main`
- 目录：`/(root)`

推送到 `main` 后自动重建。

本机也可以用项目自带脚本发布：

```powershell
$env:GITHUB_TOKEN = "ghp_..."
python -I tools\deploy_github_pages.py
```

脚本会创建/更新仓库 `laiguole/license-admin-pages` 并开启 Pages。

## 麒麟系统

授权站是网页，麒麟系统直接用浏览器打开即可，不需要单独安装：

https://laiguole.github.io/license-admin-pages/

也可以把 [kylin/license-admin.desktop](kylin/license-admin.desktop) 放到桌面双击打开，或运行：

```bash
bash kylin/start.sh
```

## 新增软件

1. 在 [config.js](config.js) 的 `products` 增加产品：

```js
{
  id: "myapp",
  name: "新软件",
  bucket: "wlxy",
  object: "myapp/accounts.json",
  description: "新软件账号授权"
}
```

2. 如果还没放开申请表产品限制，在 Supabase 执行一次 [supabase/requests-generic.sql](supabase/requests-generic.sql)。
3. 按 [docs/INTEGRATION.md](docs/INTEGRATION.md) 接入客户端。
4. 用户在客户端点“申请授权”，管理员在网站待审核列表通过。

详细架构见 [docs/AUTH-SYSTEM.md](docs/AUTH-SYSTEM.md)。

## 安全

- 前端只能使用 `sb_publishable_...`。
- `service_role` / `sb_secret_...` 只用于管理员本机配置，绝不进仓库或客户端。
- 管理员账号必须有 `app_metadata.role = license_admin`。
- 建议关闭 Supabase 公开注册。
- `ADMIN_LOGIN.txt` 已被 `.gitignore` 排除，不要提交或分享。
