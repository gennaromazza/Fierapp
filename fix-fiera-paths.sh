#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
HEADER_TSX="$ROOT/client/src/components/Header.tsx"
ADMIN_TSX="$ROOT/client/src/pages/Admin.tsx"
ADMIN_LOGIN_TSX="$ROOT/client/src/pages/AdminLogin.tsx"
INDEX_HTML="$ROOT/client/index.html"

backup() {
  if [ -f "$1" ]; then cp "$1" "$1.bak.$(date +%Y%m%d%H%M%S)"; fi
}

backup "$HEADER_TSX"
backup "$ADMIN_TSX"
backup "$ADMIN_LOGIN_TSX"
backup "$INDEX_HTML"

# Header.tsx -> href="/admin"
if [ -f "$HEADER_TSX" ]; then
  perl -0777 -i -pe 's/href=\s*\{\s*[^}]*includes\((["\'])\/fiera\1\)\s*\?\s*(["\'])\/fiera\/admin\2\s*:\s*(["\'])\/admin\3\s*\}/href="\/admin"/g' "$HEADER_TSX" || true
fi

# Admin.tsx -> setLocation("/admin/login") e setLocation("/")
if [ -f "$ADMIN_TSX" ]; then
  perl -0777 -i -pe 's/setLocation\(\s*[^)]*\?\s*(["\'])\/fiera\/admin\/login\1\s*:\s*(["\'])\/admin\/login\2\s*\)/setLocation("\/admin\/login")/g; s/setLocation\(\s*[^)]*\?\s*(["\'])\/fiera\1\s*:\s*(["\'])\/\2\s*\)/setLocation("\/")/g' "$ADMIN_TSX" || true
fi

# AdminLogin.tsx -> setLocation("/admin")
if [ -f "$ADMIN_LOGIN_TSX" ]; then
  perl -0777 -i -pe 's/setLocation\(\s*[^)]*\?\s*(["\'])\/fiera\/admin\1\s*:\s*(["\'])\/admin\2\s*\)/setLocation("\/admin")/g' "$ADMIN_LOGIN_TSX" || true
fi

# index.html -> manifest con %BASE_URL% (opzionale)
if [ -f "$INDEX_HTML" ]; then
  perl -0777 -i -pe 's/href=(["\'])\/fiera\/manifest\.webmanifest\1/href="%BASE_URL%manifest.webmanifest"/g' "$INDEX_HTML" || true
fi

echo "==> Residui /fiera nei sorgenti:"
grep -RIn --line-number '/fiera' "$ROOT/client" --include='*.{tsx,ts,jsx,js,html}' || true
echo "FATTO"
