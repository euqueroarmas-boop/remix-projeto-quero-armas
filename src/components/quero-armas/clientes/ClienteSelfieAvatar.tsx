import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Buckets distintos por origem da imagem:
// - upload manual antigo (cliente.imagem) → bucket "qa-documentos" (mesma origem da listagem)
// - selfie do cadastro público (qa_cadastro_publico.selfie_path) → bucket "qa-cadastro-selfies"
const BUCKET_MANUAL = "qa-documentos";
const BUCKET_SELFIE = "qa-cadastro-selfies";

/**
 * Avatar do cliente no cabeçalho do detalhe.
 * Resolve a foto na seguinte ordem:
 *   1) cliente.imagem (upload manual antigo, se existir)
 *   2) qa_cadastro_publico.selfie_path via cadastro_publico_id
 *   3) qa_cadastro_publico.selfie_path via cliente_id_vinculado
 *
 * Renderiza com cantos arredondados (rounded-2xl) — "arestas aparadas".
 * Fallback: iniciais do nome em círculo azul.
 */
export default function ClienteSelfieAvatar({
  cliente,
  size = "md",
}: {
  cliente: any;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg" ? "w-16 h-16" : size === "sm" ? "w-9 h-9" : "w-12 h-12";

  const clienteId = Number(cliente?.id) || null;
  const cadastroPublicoId: string | null = cliente?.cadastro_publico_id || null;
  const imagemManual: string | null = cliente?.imagem || null;
  // Override opcional: quando a tela já carrega o selfie_path em batch (lista de clientes),
  // evita uma query por linha.
  const selfiePathInline: string | null = cliente?.selfie_path || null;

  // 1) Busca o selfie_path no cadastro público quando NÃO há foto manual nem inline
  const { data: selfiePath } = useQuery<string | null>({
    queryKey: ["cliente-selfie-path", clienteId, cadastroPublicoId],
    enabled: !imagemManual && !selfiePathInline && Boolean(clienteId || cadastroPublicoId),
    staleTime: 60_000,
    queryFn: async () => {
      if (cadastroPublicoId) {
        const { data: row } = await supabase
          .from("qa_cadastro_publico" as any)
          .select("selfie_path")
          .eq("id", cadastroPublicoId)
          .maybeSingle();
        const p = (row as any)?.selfie_path;
        if (p) return p as string;
      }
      if (clienteId) {
        const { data: row } = await supabase
          .from("qa_cadastro_publico" as any)
          .select("selfie_path")
          .eq("cliente_id_vinculado", clienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const p = (row as any)?.selfie_path;
        if (p) return p as string;
      }
      return null;
    },
  });

  // 2) Gera signed URL para o path correto, usando o bucket adequado.
  //    Tenta primeiro o bucket esperado e, em caso de falha, faz fallback p/ o outro.
  const resolvedPath = imagemManual || selfiePathInline || selfiePath || null;
  const primaryBucket = imagemManual ? BUCKET_MANUAL : BUCKET_SELFIE;
  const fallbackBucket = imagemManual ? BUCKET_SELFIE : BUCKET_MANUAL;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    setUrl(null);
    if (!resolvedPath) return;
    if (/^https?:\/\//i.test(resolvedPath)) {
      setUrl(resolvedPath);
      return;
    }
    (async () => {
      const trySign = async (bucket: string) => {
        try {
          const { data } = await supabase.storage
            .from(bucket)
            .createSignedUrl(resolvedPath, 3600);
          return data?.signedUrl || null;
        } catch {
          return null;
        }
      };
      let signed = await trySign(primaryBucket);
      if (!signed) signed = await trySign(fallbackBucket);
      if (!abort && signed) setUrl(signed);
    })();
    return () => {
      abort = true;
    };
  }, [resolvedPath, primaryBucket, fallbackBucket]);

  const iniciais = (cliente?.nome_completo || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  if (url) {
    return (
      <img
        src={url}
        alt={cliente?.nome_completo || "Selfie do titular"}
        className={`${dim} rounded-2xl object-cover shrink-0 border border-slate-200 shadow-sm bg-white`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-2xl shrink-0 flex items-center justify-center text-white text-xs font-bold bg-[#2563EB] border border-blue-700/20 shadow-sm`}
      aria-label={cliente?.nome_completo || "Sem foto"}
      title={cliente?.nome_completo || ""}
    >
      {iniciais || "?"}
    </div>
  );
}
