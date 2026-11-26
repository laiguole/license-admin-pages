import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.LICENSE_CONFIG || {};
const $ = (id) => document.getElementById(id);
const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const state = {
  products: Array.isArray(cfg.products) ? cfg.products : [],
  productId: localStorage.getItem("license_product") || "",
  accounts: {},
  pending: [],
  updated: "",
  dirty: false,
  editingIsNew: false,
  client: null,
  session: null,
  loading: false,
};

function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
  el.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add("hidden"), 2800);
}

function showLogin(message = "") {
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginError").textContent = message;
  setTimeout(() => $("loginPassword").focus(), 40);
}

function showApp() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
}

function currentProduct() {
  return state.products.find((p) => p.id === state.productId) || null;
}

function markDirty(dirty) {
  state.dirty = dirty;
  $("saveState").textContent = dirty ? "有未保存修改" : "已同步";
  $("btnSave").classList.toggle("save-dirty", dirty);
  $("btnSave").textContent = dirty ? "保存并发布 *" : "保存并发布";
}

function updateStats() {
  const items = Object.values(state.accounts);
  $("statTotal").textContent = items.length;
  $("statActive").textContent = items.filter((a) => a.active !== false).length;
  $("statDisabled").textContent = items.filter((a) => a.active === false).length;
}

function accountMatches(id, item) {
  const q = $("searchInput").value.trim().toLowerCase();
  const filter = $("statusFilter").value;
  if (filter === "active" && item.active === false) return false;
  if (filter === "disabled" && item.active !== false) return false;
  if (!q) return true;
  return `${id} ${item.name || ""} ${item.note || ""}`.toLowerCase().includes(q);
}

function renderAccounts() {
  const body = $("accountBody");
  body.innerHTML = "";
  const ids = Object.keys(state.accounts).sort((a, b) => a.localeCompare(b));
  let shown = 0;
  for (const id of ids) {
    const item = state.accounts[id];
    if (!accountMatches(id, item)) continue;
    shown += 1;
    const tr = document.createElement("tr");

    const idCell = document.createElement("td");
    const idSpan = document.createElement("span");
    idSpan.className = "mono";
    idSpan.textContent = id;
    idCell.appendChild(idSpan);

    const nameCell = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = item.name || "";
    nameInput.placeholder = "名称";
    nameInput.addEventListener("input", () => {
      item.name = nameInput.value;
      markDirty(true);
    });
    nameCell.appendChild(nameInput);

    const noteCell = document.createElement("td");
    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.value = item.note || "";
    noteInput.placeholder = "备注";
    noteInput.addEventListener("input", () => {
      item.note = noteInput.value;
      markDirty(true);
    });
    noteCell.appendChild(noteInput);

    const statusCell = document.createElement("td");
    const label = document.createElement("label");
    label.className = "switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.active !== false;
    const badge = document.createElement("span");
    badge.className = `badge ${checkbox.checked ? "on" : "off"}`;
    badge.textContent = checkbox.checked ? "启用" : "停用";
    checkbox.addEventListener("change", () => {
      item.active = checkbox.checked;
      badge.className = `badge ${checkbox.checked ? "on" : "off"}`;
      badge.textContent = checkbox.checked ? "启用" : "停用";
      markDirty(true);
      updateStats();
    });
    label.appendChild(checkbox);
    label.appendChild(badge);
    statusCell.appendChild(label);

    const updatedCell = document.createElement("td");
    updatedCell.className = "muted";
    updatedCell.textContent = item.updated || "";

    const actionCell = document.createElement("td");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-row";
    del.textContent = "删除";
    del.addEventListener("click", () => {
      if (!confirm(`删除账号 ${id}？保存后生效。`)) return;
      delete state.accounts[id];
      markDirty(true);
      updateStats();
      renderAccounts();
    });
    actionCell.appendChild(del);

    tr.append(idCell, nameCell, noteCell, statusCell, updatedCell, actionCell);
    body.appendChild(tr);
  }
  $("emptyState").classList.toggle("hidden", shown !== 0);
  updateStats();
}

function renderProductOptions() {
  const select = $("productSelect");
  select.innerHTML = "";
  for (const p of state.products) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name || p.id;
    select.appendChild(opt);
  }
  if (!state.products.some((p) => p.id === state.productId)) {
    state.productId = state.products.length ? state.products[0].id : "";
  }
  if (state.productId) select.value = state.productId;
  const product = currentProduct();
  $("productTitle").textContent = product ? product.name : "授权列表";
  $("productDesc").textContent = product
    ? product.description || "管理该软件的登录账号授权。"
    : "请先在 config.js 中配置产品。";
}

function publicUrl(product) {
  return `${cfg.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(product.bucket)}/${product.object
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?t=${Date.now()}`;
}

async function loadAccounts() {
  const product = currentProduct();
  if (!product) return;
  $("btnSave").disabled = true;
  try {
    const res = await fetch(publicUrl(product), { cache: "no-store" });
    if (!res.ok) throw new Error(`读取授权文件失败（HTTP ${res.status}）`);
    const data = await res.json();
    state.accounts = data.accounts && typeof data.accounts === "object" ? data.accounts : {};
    state.updated = data.updated || "";
    $("updatedAt").textContent = state.updated ? `最后发布：${state.updated}` : "";
    markDirty(false);
    renderAccounts();
    await loadPending();
  } catch (err) {
    toast(err.message, true);
  } finally {
    $("btnSave").disabled = false;
  }
}

function openAccountDialog() {
  state.editingIsNew = true;
  $("accountId").value = "";
  $("accountId").readOnly = false;
  $("accountName").value = "";
  $("accountNote").value = "";
  $("accountActive").checked = true;
  $("accountDialog").showModal();
  setTimeout(() => $("accountId").focus(), 50);
}

async function saveAccounts() {
  const product = currentProduct();
  if (!product || !state.session) return;
  $("btnSave").disabled = true;
  markDirty(false);
  try {
    const accounts = {};
    for (const [id, item] of Object.entries(state.accounts)) {
      const key = String(id).trim();
      if (!key) continue;
      accounts[key] = {
        active: item.active !== false,
        ...(item.name ? { name: String(item.name).slice(0, 80) } : {}),
        ...(item.note ? { note: String(item.note).slice(0, 200) } : {}),
        updated: today(),
      };
    }
    const doc = { updated: today(), accounts };
    const body = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const { error } = await state.client.storage.from(product.bucket).upload(product.object, body, {
      upsert: true,
      cacheControl: "no-cache",
      contentType: "application/json",
    });
    if (error) throw error;
    state.accounts = accounts;
    state.updated = doc.updated;
    $("updatedAt").textContent = `最后发布：${doc.updated}`;
    renderAccounts();
    markDirty(false);
    toast("已保存并发布");
    return true;
  } catch (err) {
    markDirty(true);
    toast(`发布失败：${err.message || err}`, true);
    return false;
  } finally {
    $("btnSave").disabled = false;
  }
}

function downloadExport() {
  const product = currentProduct();
  if (!product) return;
  const doc = { updated: today(), accounts: state.accounts };
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${product.id}-accounts.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function loadPending() {
  const product = currentProduct();
  const list = $("pendingList");
  if (!product || !state.client) return;
  try {
    const { data, error } = await state.client
      .from("license_requests")
      .select("*")
      .eq("product_id", product.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    if (error) throw error;
    state.pending = data || [];
    renderPending();
  } catch (err) {
    state.pending = [];
    $("pendingCount").textContent = "0";
    list.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "pending-empty";
    empty.textContent = "待审核列表不可用：" + (err.message || err);
    list.appendChild(empty);
  }
}

function renderPending() {
  const list = $("pendingList");
  list.innerHTML = "";
  $("pendingCount").textContent = String(state.pending.length);
  if (!state.pending.length) {
    const empty = document.createElement("div");
    empty.className = "pending-empty";
    empty.textContent = "暂无待审核申请";
    list.appendChild(empty);
    return;
  }
  for (const req of state.pending) {
    const row = document.createElement("div");
    row.className = "pending-row";
    const main = document.createElement("div");
    main.className = "pending-main";
    const id = document.createElement("div");
    id.className = "pending-id";
    id.textContent = req.account_id || "";
    const meta = document.createElement("div");
    meta.className = "pending-meta";
    const when = req.requested_at ? new Date(req.requested_at).toLocaleString("zh-CN", { hour12: false }) : "";
    meta.textContent = [req.name, when].filter(Boolean).join(" · ") || "无附加信息";
    main.append(id, meta);

    const actions = document.createElement("div");
    actions.className = "pending-actions";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "primary";
    ok.textContent = "通过";
    ok.addEventListener("click", () => approvePending(req));
    const no = document.createElement("button");
    no.type = "button";
    no.className = "danger";
    no.textContent = "拒绝";
    no.addEventListener("click", () => rejectPending(req));
    actions.append(ok, no);
    row.append(main, actions);
    list.appendChild(row);
  }
}

async function approvePending(req) {
  const product = currentProduct();
  if (!product || !req.account_id) return;
  if (!confirm(`通过账号 ${req.account_id} 的授权申请？`)) return;
  state.accounts[req.account_id] = {
    ...(state.accounts[req.account_id] || {}),
    active: true,
    name: req.name || "",
    note: req.note || "申请通过",
    updated: today(),
  };
  markDirty(true);
  renderAccounts();
  const saved = await saveAccounts();
  if (!saved) return;
  try {
    const { error } = await state.client
      .from("license_requests")
      .delete()
      .eq("product_id", product.id)
      .eq("account_id", req.account_id);
    if (error) throw error;
    toast("已通过并发布");
    await loadPending();
  } catch (err) {
    toast(`账号已发布，但申请记录删除失败：${err.message || err}`, true);
  }
}

async function rejectPending(req) {
  const product = currentProduct();
  if (!product || !req.account_id) return;
  if (!confirm(`拒绝账号 ${req.account_id} 的授权申请？`)) return;
  try {
    const { error } = await state.client
      .from("license_requests")
      .delete()
      .eq("product_id", product.id)
      .eq("account_id", req.account_id);
    if (error) throw error;
    toast("已拒绝");
    await loadPending();
  } catch (err) {
    toast(`操作失败：${err.message || err}`, true);
  }
}

async function enterApp(session) {
  if (!session || !session.user) {
    showLogin();
    return;
  }
  if (session.user.app_metadata?.role !== "license_admin") {
    await state.client.auth.signOut();
    showLogin("该账号没有授权管理权限。");
    return;
  }
  state.session = session;
  showApp();
  renderProductOptions();
  if (state.productId) await loadAccounts();
  else renderAccounts();
}

async function initAuth() {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseAnonKey.startsWith("REPLACE_")) {
    $("setupBanner").classList.remove("hidden");
    showLogin("请先在 config.js 中填写 Supabase anon key。");
    return;
  }
  state.client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const { data } = await state.client.auth.getSession();
  if (data.session) await enterApp(data.session);
  else showLogin();

  state.client.auth.onAuthStateChange(async (_event, session) => {
    if (session) await enterApp(session);
    else {
      state.session = null;
      showLogin();
    }
  });
}

async function doLogin(event) {
  event.preventDefault();
  if (!state.client) return;
  const button = $("loginButton");
  button.disabled = true;
  $("loginError").textContent = "";
  try {
    const { data, error } = await state.client.auth.signInWithPassword({
      email: $("loginEmail").value.trim(),
      password: $("loginPassword").value,
    });
    if (error) throw error;
    $("loginPassword").value = "";
    await enterApp(data.session);
  } catch (err) {
    let msg = err.message || "登录失败";
    if (/invalid login credentials/i.test(msg)) msg = "邮箱或密码不正确";
    if (/email not confirmed/i.test(msg)) msg = "邮箱尚未验证";
    $("loginError").textContent = msg;
  } finally {
    button.disabled = false;
  }
}

function bindEvents() {
  $("loginForm").addEventListener("submit", doLogin);
  $("btnLogout").addEventListener("click", async () => {
    if (state.dirty && !confirm("当前修改尚未发布，退出会丢失修改。继续？")) return;
    await state.client.auth.signOut();
    showLogin();
  });
  $("btnRefresh").addEventListener("click", async () => {
    if (state.dirty && !confirm("刷新会丢失未发布的修改。继续？")) return;
    await loadAccounts();
  });
  $("btnAddAccount").addEventListener("click", openAccountDialog);
  $("btnRefreshPending").addEventListener("click", loadPending);
  $("btnSave").addEventListener("click", saveAccounts);
  $("searchInput").addEventListener("input", renderAccounts);
  $("statusFilter").addEventListener("change", renderAccounts);
  $("btnExport").addEventListener("click", (event) => {
    event.preventDefault();
    downloadExport();
  });

  $("productSelect").addEventListener("change", async (event) => {
    if (state.dirty && !confirm("当前修改尚未发布，切换产品会丢失修改。继续？")) {
      event.target.value = state.productId;
      return;
    }
    state.productId = event.target.value;
    localStorage.setItem("license_product", state.productId);
    state.accounts = {};
    state.updated = "";
    markDirty(false);
    renderProductOptions();
    await loadAccounts();
  });

  $("accountForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("accountId").value.trim();
    if (!id) return;
    if (state.editingIsNew && state.accounts[id]) {
      toast("账号 ID 已存在", true);
      return;
    }
    state.accounts[id] = {
      ...(state.accounts[id] || {}),
      name: $("accountName").value.trim(),
      note: $("accountNote").value.trim(),
      active: $("accountActive").checked,
      updated: today(),
    };
    markDirty(true);
    $("accountDialog").close();
    renderAccounts();
  });
  $("accountCancel").addEventListener("click", () => $("accountDialog").close());

  $("btnPassword").addEventListener("click", () => {
    $("passwordForm").reset();
    $("passwordDialog").showModal();
  });
  $("passwordCancel").addEventListener("click", () => $("passwordDialog").close());
  $("passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if ($("newPassword").value !== $("confirmPassword").value) {
      toast("两次输入的新密码不一致", true);
      return;
    }
    try {
      const { error } = await state.client.auth.updateUser({ password: $("newPassword").value });
      if (error) throw error;
      $("passwordDialog").close();
      toast("密码已修改");
    } catch (err) {
      toast(`修改失败：${err.message || err}`, true);
    }
  });

  $("btnImport").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const accounts = data.accounts || data;
      if (!accounts || typeof accounts !== "object" || Array.isArray(accounts)) {
        throw new Error("文件中没有 accounts 对象");
      }
      if (!confirm(`导入 ${Object.keys(accounts).length} 个账号并替换当前列表？`)) return;
      state.accounts = {};
      for (const [id, item] of Object.entries(accounts)) {
        state.accounts[id] = {
          active: item.active !== false,
          name: item.name || "",
          note: item.note || "",
          updated: item.updated || today(),
        };
      }
      markDirty(true);
      renderAccounts();
      toast("已导入，点击“保存并发布”生效");
    } catch (err) {
      toast(`导入失败：${err.message}`, true);
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await initAuth();
});
