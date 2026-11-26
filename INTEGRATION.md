# 统一账号授权接入指令

把下面整段发给其他项目（替换方括号内容）。

---

你正在开发 **[项目名称]**。请把本项目接入统一账号授权中心，只允许已授权账号使用受保护功能。

## 授权中心信息

- 授权中心后台：`https://laiguole.github.io/license-admin-pages/`
- Supabase 项目：`https://vrpplnwjmevqvbdnsygg.supabase.co`
- 本项目产品 ID：`[PRODUCT_ID]`
- 授权文件桶：`[BUCKET]`
- 授权文件对象：`[OBJECT]`（通常是 `accounts.json`）
- 公共只读地址：

```text
https://vrpplnwjmevqvbdnsygg.supabase.co/storage/v1/object/public/[BUCKET]/[OBJECT]
```

## 授权文件格式

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

规则：

- 只以 `accounts[当前账号ID].active === true` 作为授权通过。
- 账号不存在、`active` 为 `false`、字段缺失，一律视为未授权。
- 不要使用昵称、手机号、姓名作为主键；必须使用平台提供的稳定用户 ID。
- 不要把 Supabase service_role / `sb_secret_...` 写进客户端；读取公共 JSON 不需要密钥。

## 客户端接入要求

1. 确定“当前登录账号 ID”
   - 优先使用平台登录接口/本地登录态中的稳定用户 ID。
   - 本项目的账号 ID 获取函数：`[GET_ACCOUNT_ID_FUNCTION]`
   - 如果暂时没有稳定 ID，先停下来向负责人确认，不要用昵称代替。

2. 启动时检查授权
   - 请求公共授权地址，追加时间戳破缓存：`?t=<毫秒时间戳>`
   - 请求头带 `Cache-Control: no-cache`
   - 超时 8 秒
   - 成功：读取 `accounts[账号ID].active`
   - 失败：读取本地缓存；缓存必须绑定同一个账号 ID，且不超过 24 小时；否则按未授权处理（不要默认放行）

3. 本地缓存
   - 位置：应用数据目录下 `license.cache.json`
   - 内容至少包含：账号 ID、active、checkedAt
   - 禁止把账号密码、手机号、身份证等写进缓存

4. 功能限制
   - 未登录：提示“请先登录”，禁用受保护功能
   - 已登录但未授权：提示“当前账号未授权”，显示账号 ID，提示联系管理员
   - 未授权时不要启动自动任务、批量操作、定时任务或收费功能
   - 不要删除用户已有数据；只禁用功能

5. 账号切换
   - 登录账号变化时立即重新检查
   - 长时间运行时每 5-10 分钟或每次开始任务前重新检查一次
   - 检查结果必须按账号 ID 隔离，不能把 A 账号的缓存给 B 账号用

6. 日志与隐私
   - 日志只记录账号 ID 的脱敏形式（例如前 6 位 + `***`）
   - 不要记录密码、Token、手机号、身份证、完整姓名
   - 不要在界面或日志里暴露 Supabase service key

7. 错误处理
   - 授权服务不可达且无有效缓存：按未授权处理，给出可重试提示
   - 授权文件格式错误：按未授权处理，不要崩溃
   - 不要因为授权失败而反复弹窗；每个账号每次启动最多提示一次

## 管理员侧配置

1. 在授权中心后台确认产品已添加：
   - 产品 ID：`[PRODUCT_ID]`
   - 桶：`[BUCKET]`
   - 对象：`[OBJECT]`
2. 如果使用新桶，需要在 Supabase Storage policy 的 `bucket_id` 列表中加入 `[BUCKET]`，并重新执行 SQL。
3. 在后台新增账号 ID，勾选“启用”，点“保存并发布”。
4. 客户端刷新或重启后生效。

## 验收清单

- [ ] 未登录时受保护功能不可用
- [ ] 账号不在列表时不可用，并显示账号 ID
- [ ] `active=false` 时不可用
- [ ] `active=true` 时可用
- [ ] 后台停用后，客户端重新检查即失效
- [ ] 后台删除账号后，客户端失效
- [ ] 网络失败且无缓存时按未授权处理
- [ ] 缓存绑定账号 ID，切换账号不会串用
- [ ] 客户端包内没有 service_role / `sb_secret_...`
- [ ] 日志不包含密码、Token、手机号、身份证

## 参考实现

Windows/WebView2 项目可参考现有：

```text
D:\我的项目\wlxy-study-app\src\AccountService.cs
D:\我的项目\wlxy-study-app\src\MainForm.cs（账号探测与授权门禁部分）
```

核心逻辑：

```text
getAccountId()
  -> fetch(publicUrl + "?t=" + Date.now())
  -> accounts[accountId]?.active === true ? 放行 : 拦截
  -> 网络失败时只信 24 小时内的同账号缓存
```

不要复制任何后台账号密码或 service key 到新项目。
