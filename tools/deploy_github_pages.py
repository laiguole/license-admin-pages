import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.github.com"
TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
REPO = os.environ.get("GITHUB_REPO", "license-admin-pages").strip()
OWNER = os.environ.get("GITHUB_OWNER", "").strip()


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "LicenseAdminDeploy/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        print("HTTP", e.code, path, raw[:800])
        raise


if not TOKEN:
    print("请先设置 GITHUB_TOKEN 环境变量（需要 repo 权限）。")
    sys.exit(1)
if not OWNER:
    status, user = request("GET", "/user")
    OWNER = user["login"]
    print("GitHub 用户:", OWNER)

status, repo = None, None
try:
    status, repo = request("GET", f"/repos/{OWNER}/{REPO}")
    print("仓库已存在:", repo["html_url"])
except urllib.error.HTTPError as e:
    if e.code != 404:
        raise
    status, repo = request(
        "POST",
        "/user/repos",
        {
            "name": REPO,
            "description": "软件授权管理网站",
            "private": False,
            "auto_init": True,
            "has_issues": False,
            "has_wiki": False,
        },
    )
    print("已创建仓库:", repo["html_url"])

branch = repo.get("default_branch") or "main"
print("默认分支:", branch)

files = []
for path in ROOT.rglob("*"):
    if not path.is_file():
        continue
    rel = path.relative_to(ROOT).as_posix()
    if rel == "ADMIN_LOGIN.txt":
        continue
    if rel.startswith(".github/"):
        continue
    files.append((rel, path))
files.sort()

for rel, path in files:
    content = base64.b64encode(path.read_bytes()).decode("ascii")
    payload = {
        "message": "deploy: " + rel,
        "content": content,
        "branch": branch,
    }
    try:
        status, existing = request(
            "GET", f"/repos/{OWNER}/{REPO}/contents/{urllib.parse.quote(rel)}?ref={branch}"
        )
        payload["sha"] = existing["sha"]
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    request("PUT", f"/repos/{OWNER}/{REPO}/contents/{urllib.parse.quote(rel)}", payload)
    print("uploaded", rel)

pages_body = {"source": {"branch": branch, "path": "/"}}
try:
    request("POST", f"/repos/{OWNER}/{REPO}/pages", pages_body)
    print("已启用 GitHub Pages")
except urllib.error.HTTPError as e:
    if e.code != 409:
        raise
    request("PUT", f"/repos/{OWNER}/{REPO}/pages", pages_body)
    print("已更新 GitHub Pages")

url = f"https://{OWNER}.github.io/{REPO}/"
print("Pages 地址:", url)
for _ in range(20):
    try:
        status, page = request("GET", f"/repos/{OWNER}/{REPO}/pages")
        print("Pages 状态:", page.get("status"), page.get("html_url"))
        if page.get("status") in ("built", "building"):
            break
    except Exception:
        pass
    time.sleep(6)
print("完成。如果首次构建，请等待 1-2 分钟。")
