#!/usr/bin/env bash
# Publica as edge functions no Supabase.
#
# POR QUE ISTO EXISTE
# O Lovable publica apenas as funções que ELE mesmo escreve. Função que chega
# pelo GitHub fica no repositório e nunca sobe: o botão do site existe, mas o
# servidor não tem o que responder. Descoberto em 17/08/2026, quando
# qa-emu-sessao falhou com "Failed to send a request to the Edge Function" e
# qa-recurso-gerar não aparecia na lista de funções do painel.
#
# Colar no painel do Supabase resolve uma função por vez e não resolve as que
# só foram ALTERADAS (essas existem lá, rodando código velho). Este script
# resolve as duas situações de uma vez, e ainda leva junto a pasta _shared,
# que o editor do painel não sabe resolver.
#
# USO
#   npx supabase login          # uma vez, abre o navegador
#   ./scripts/publicar-edge-functions.sh            # só as afetadas (padrão)
#   ./scripts/publicar-edge-functions.sh --todas    # todas as ~200
#
set -euo pipefail

PROJECT_REF="ogkltfqvzweeqkfmrzts"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

# Funções que chegaram pelo GitHub — criadas fora do Lovable (nunca subiram)
# ou pré-existentes com o código alterado (no ar está a versão velha).
AFETADAS=(
  # nunca publicadas
  qa-emu-sessao
  qa-manifestacao-analisar
  qa-montar-juntada
  qa-recurso-aprovar
  qa-recurso-gerar
  qa-senha-gov-cliente
  qa-sofer-dossie
  # publicadas, porém desatualizadas
  qa-checkout-criar-venda
  qa-checkout-iniciar-pagamento
  qa-contratar-publico
  qa-efetiva-aprovar
  qa-efetiva-narrativa
  qa-processo-checar-conclusao-checklist
  qa-processo-dispensas
  qa-processo-doc-reaproveitar
  qa-processo-doc-validar-ia
  qa-processo-etapa-auto-liberar
  qa-processo-set-condicao
)

if [[ "${1:-}" == "--todas" ]]; then
  echo "▶ Publicando TODAS as edge functions em $PROJECT_REF"
  npx supabase functions deploy --project-ref "$PROJECT_REF"
  exit $?
fi

echo "▶ Publicando ${#AFETADAS[@]} funções afetadas em $PROJECT_REF"
echo

falhas=()
for fn in "${AFETADAS[@]}"; do
  if [[ ! -d "supabase/functions/$fn" ]]; then
    echo "  ⚠  $fn — pasta não existe, pulando"
    continue
  fi
  printf '  → %s ... ' "$fn"
  # Uma por vez de propósito: se uma quebrar, dá para ver qual foi em vez de
  # perder o lote inteiro num erro genérico.
  if npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" >/tmp/deploy-$fn.log 2>&1; then
    echo "ok"
  else
    echo "FALHOU (log: /tmp/deploy-$fn.log)"
    falhas+=("$fn")
  fi
done

echo
if (( ${#falhas[@]} )); then
  echo "✖ Falharam: ${falhas[*]}"
  echo "  Veja o log de cada uma em /tmp/deploy-<nome>.log"
  exit 1
fi
echo "✔ Todas publicadas."
echo "  Confira em: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
