#!/bin/bash
# ============================================================================
# SessionStart — prepara o ambiente do Claude Code na web.
#
# Problema real (15/08/2026): os lockfiles do projeto vinham com as URLs dos
# pacotes apontando para o cache privado do Lovable
# (europe-westN-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache). Esse host
# devolve 403 fora da infraestrutura do Lovable, então a instalação de
# dependências travava por horas e nenhuma sessão conseguia rodar typecheck,
# lint ou teste.
#
# O cache é um espelho do npm público: mesmo caminho, mesmo tarball, mesmo
# hash de integridade. Trocar o prefixo pelo registry.npmjs.org resolve sem
# mexer em versão nenhuma.
# ============================================================================
set -euo pipefail

# Só na web. Em máquina local o ambiente é do dono do repositório.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Binarios de navegador nao vem do npm e a rede daqui corta o download:
# o Cypress (~200 MB) derruba a instalacao inteira no pos-install, e o
# Chromium do Playwright ja vem pronto na imagem (PLAYWRIGHT_BROWSERS_PATH).
# Sem isso a instalacao falha no fim e nada de node_modules utilizavel.
export CYPRESS_INSTALL_BINARY=0
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export CYPRESS_INSTALL_BINARY=0' >> "$CLAUDE_ENV_FILE"
  echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "$CLAUDE_ENV_FILE"
fi

CACHE_PRIVADO='https://europe-west[0-9]+-npm\.pkg\.dev/lovable-core-prod/sandbox-npm-cache/'

# Idempotente: se o Lovable reescrever os lockfiles com o cache privado de
# novo, a sessão seguinte normaliza sozinha. Se já estiver limpo, não faz nada.
for lockfile in bun.lock package-lock.json; do
  if [ -f "$lockfile" ] && grep -qE "$CACHE_PRIVADO" "$lockfile"; then
    sed -i -E "s#${CACHE_PRIVADO}#https://registry.npmjs.org/#g" "$lockfile"
    echo "[session-start] $lockfile: URLs do cache privado trocadas pelo npm publico"
  fi
done

# bun e o gerenciador de verdade do projeto — o bun.lock acompanha o
# package.json, o package-lock.json esta defasado e nao serve para `npm ci`.
if command -v bun >/dev/null 2>&1; then
  echo "[session-start] bun install"
  bun install
else
  echo "[session-start] bun ausente, caindo para npm install"
  npm install --no-audit --no-fund
fi

echo "[session-start] pronto: typecheck, lint e teste ja podem rodar"
