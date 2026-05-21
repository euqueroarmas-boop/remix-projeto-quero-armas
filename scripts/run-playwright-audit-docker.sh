#!/usr/bin/env bash
# Executa a auditoria Playwright do Quero Armas dentro do container oficial
# do Playwright, garantindo que todas as libs nativas do Chromium estejam
# disponíveis (libglib, libnss, etc).
#
# A imagem é fixada na MESMA versão do @playwright/test instalada no projeto
# (atualmente 1.58.2) para evitar incompatibilidades entre client e browsers.
#
# Uso:
#   bash scripts/run-playwright-audit-docker.sh
#   npm run audit:docker
#
# Requisitos no host: apenas Docker.

set -euo pipefail

PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-1.58.2}"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker não está instalado neste host." >&2
  echo "   Instale Docker ou rode a auditoria via GitHub Actions (.github/workflows/playwright-audit.yml)." >&2
  exit 127
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "▶ Playwright version: ${PLAYWRIGHT_VERSION}"
echo "▶ Image:              ${IMAGE}"
echo "▶ Project dir:        ${PROJECT_DIR}"

# --ipc=host evita crashes de Chromium em /dev/shm pequeno.
# --init garante reaping correto de processos zombie do browser.
docker run --rm --init --ipc=host \
  -v "${PROJECT_DIR}:/work" \
  -w /work \
  -e CI=1 \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  "${IMAGE}" \
  /bin/bash -lc '
    set -euo pipefail
    echo "▶ Node:       $(node --version)"
    echo "▶ NPM:        $(npm --version)"
    echo "▶ Playwright: $(npx playwright --version)"
    npm ci
    npm run typecheck
    npm run audit:routes
    npm run audit:journey
  '

echo "✅ Auditoria concluída. Relatórios em test-results/."