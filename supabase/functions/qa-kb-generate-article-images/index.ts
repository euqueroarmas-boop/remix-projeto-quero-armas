// BLOQUEIO PERMANENTE — Geração de imagens por IA é PROIBIDA por regra de negócio.
// Mantemos a função apenas para compatibilidade: qualquer chamada retorna erro 410 (Gone).
// Ver mem://constraints/quero-armas-diretriz-global e regra do produto.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const body = {
    error: "Geração de imagens por IA está proibida por regra de negócio. Utilize apenas imagens reais auditáveis (screenshot real, upload manual, documento real).",
    code: "AI_IMAGE_GENERATION_DISABLED",
  };
  return new Response(JSON.stringify(body), {
    status: 410,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});