# 统一软件授权系统说明

适用于后续所有软件的统一账号授权方案。客户端只读取公开授权文件，管理员在网页审核，不需要每个软件各做一套后台。

## 一、组成

```text
软件客户端
  ├─ 读取 public accounts.json 判断 active
  └─ 未授权时提交 license_requests 申请
          │
          ▼
Supabase
  ├─ Storage 公共桶：授权名单 accounts.json
  ├─ 表 license_requests：待审核申请
  └─ Auth：管理员登录
          │
          ▼
GitHub Pages 授权站
  ├─ 管理员登录
  ├─ 查看全部软件的待审核申请
  ├─ 通过：写入对应软件的 accounts.json
  └─ 停用/删除：立即撤销授权
```

## 二、固定资源

- 授权站：`https://laiguole.github.io/license-admin-pages/`
- Supabase：`https://vrpplnwjmevqvbdnsygg.supabase.co`
- 公共桶：`wlxy`
- 公开 key：`sb_publishable_qAttmbMgurwqyMS7AWKtdA_Nl5Ic76t`
- **service_role / `sb_secret_...` 只能留在管理员本机，绝不能进客户端。**

## 三、推荐的软件目录结构

后续软件不需要新建桶，直接复用 `wlxy` 桶，用产品 ID 作为对象前缀：

```text
wlxy/
├─ accounts.json                 # 现有网院学习助手
├─ myapp/accounts.json           # 新软件 A
└─ otherapp/accounts.json        # 新软件 B
```

公开读取地址：

```text
https://vrpplnwjmevqvbdnsygg.supabase.co/storage/v1/object/public/wlxy/myapp/accounts.json
```

这样不需要改 Storage 写策略；管理员角色本来就能写 `wlxy` 桶。

## 四、授权文件格式

```json
{
  "updated": "2026-11-26",
  "accounts": {
    "账号ID": {
      "active": true,
      "name": "可选",
      "note": "可选",
      "updated": "2026-11-26"
    }
  }
}
```

判断规则：

- `accounts[当前账号ID].active === true` 才放行
- 账号不存在、`active=false`、字段缺失都视为未授权
- 主键必须是平台稳定用户 ID，不能用昵称/手机号

## 五、客户端标准流程

1. 登录后获取稳定账号 ID。
2. 启动时请求公共 `accounts.json`，加 `?t=<时间戳>` 破缓存，超时 8 秒。
3. 命中且 `active=true`：放行。
4. 未命中或停用：
   - 显示“未授权”
   - 显示账号 ID
   - 提供 **申请授权** 按钮，由用户主动提交
5. 提交申请：

```http
POST https://vrpplnwjmevqvbdnsygg.supabase.co/rest/v1/license_requests
apikey: sb_publishable_qAttmbMgurwqyMS7AWKtdA_Nl5Ic76t
Authorization: Bearer sb_publishable_qAttmbMgurwqyMS7AWKtdA_Nl5Ic76t
Content-Type: application/json
Prefer: return=minimal

{
  "product_id": "myapp",
  "account_id": "账号ID",
  "name": "可选",
  "status": "pending"
}
```

`201` 成功；`409` 表示已有申请，按成功处理。

6. 客户端每 30 秒复查未授权账号，管理员通过后自动放行。
7. 已授权账号每 5 分钟复查；停用/删除后 5 分钟内失效。
8. 网络失败只信 24 小时内的同账号缓存；没有缓存按未授权处理，不要默认放行。

## 六、管理员新增软件

1. 在 `config.js` 的 `products` 增加：

```js
{
  id: "myapp",
  name: "新软件",
  bucket: "wlxy",
  object: "myapp/accounts.json",
  description: "新软件账号授权"
}
```

2. 推送到 GitHub `main`，Pages 自动更新。
3. 打开授权站，确认产品出现。
4. 新用户点客户端“申请授权”后，待审核列表会显示：

```text
账号ID
软件：新软件 · 2026/11/26 10:00:00
```

5. 点 **通过**，自动写入 `wlxy/myapp/accounts.json`；点 **拒绝**，只删除申请。

## 七、需要执行一次的 SQL（让新软件也能提交申请）

当前申请表策略只允许 `product_id='wlxy'`。为了让后续软件也能提交，管理员在 Supabase SQL Editor 执行一次 [supabase/requests-generic.sql](../supabase/requests-generic.sql)，或粘贴下面的 SQL：

```sql
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
```

Storage 写策略保持现状即可，因为新软件复用 `wlxy` 桶。

## 八、新软件验收清单

- [ ] 能取得稳定账号 ID
- [ ] 未登录时禁用受保护功能
- [ ] 未授权时显示账号 ID 和“申请授权”
- [ ] 点击申请后，授权站待审核列表出现该账号，并标明软件
- [ ] 管理员通过后，客户端 30 秒内自动放行
- [ ] 管理员停用/删除后，客户端 5 分钟内失效
- [ ] 断网且无缓存时按未授权处理
- [ ] 缓存按账号 ID 隔离
- [ ] 客户端包内没有 `service_role` / `sb_secret_...`
- [ ] 日志不记录密码、Token、手机号、身份证

## 九、参考实现

- Windows/WPF/WinForms：`D:\我的项目\wlxy-study-app\src\AccountService.cs`
- Windows 客户端门禁和账号探测：`D:\我的项目\wlxy-study-app\src\MainForm.cs`
- 麒麟 Electron：`D:\我的项目\wlxy-study-kylin\renderer.js`
- 跨项目接入提示词：`docs/INTEGRATION.md`
- 授权站源码：`D:\我的项目\license-admin-site`

核心逻辑：

```text
getAccountId()
  -> GET public accounts.json?t=...
  -> accounts[accountId]?.active === true ? 放行 : 拦截
  -> 未授权时用户点“申请授权”
  -> POST license_requests
  -> 管理员审核
  -> 客户端 30 秒复查自动放行
```
