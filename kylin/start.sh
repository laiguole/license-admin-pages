#!/usr/bin/env bash
# 麒麟/桌面 Linux 快速打开授权管理站
set -e
URL="https://laiguole.github.io/license-admin-pages/"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
else
  echo "请在浏览器打开：$URL"
fi
