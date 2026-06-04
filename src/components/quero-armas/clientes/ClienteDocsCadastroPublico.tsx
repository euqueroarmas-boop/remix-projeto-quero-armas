import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileImage, Loader2, ShieldAlert, IdCard, Home, User } from "lucide-react";
import { toast } from "sonner";
import DocumentoViewerModal, { useDocumentoViewer } from "@/components/quero-armas/DocumentoViewerModal";

/**
 * Bloco somente-leitura: documentos enviados durante o CADASTRO PÚBLICO
 * (selfie, identidade, comprovante de endereço). Estes arquivos vivem em
 * `qa_cadastro_publico` e no bucket privado `qa-cadastro-selfies` —
 * NÃO em `qa_documentos_cliente`. Por isso precisam de um leitor próprio
 * para aparecer no detalhe do cliente sem mexer no Hub Documental.
 *
 * Resolve por (em ordem):
 *   1. cliente.cadastro_publico_id  (vínculo direto e canônico)
 *   2. qa_cadastro_publico.cliente_id_vinculado = cliente.id  (fallback p/ legados)
 */

const BUCKET = "qa-cadastro-selfies";

type CadastroDocs = {
  id: string;
  selfie_path: string | null;
  documento_identidade_path: string | null;
  comprovante_endereco_path: string | null;
  created_at: string | null;
  status: string | null;
};

const TIPOS: Array<{
  key: keyof CadastroDocs;
  label: string;
  Icon: any;
}> = [
  { key: "documento_identidade_path", label: "Documento de Identidade (RG/CNH)", Icon: IdCard },
  { key: "comprovante_endereco_path", label: "Comprovante de Endereço", Icon: Home },
  { key: "selfie_path", label: "Selfie do Titular", Icon: User },
];

function formatDateTime(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return d;
  }
}

export default function ClienteDocsCadastroPublico({ cliente }: { cliente: any }) {
  const clienteId = Number(cliente?.id) || null;
  const cadastroPublicoId: string | null = cliente?.cadastro_publico_id || null;
  const viewer = useDocumentoViewer();

  const queryKey = useMemo(
    () => ["cliente-docs-cadastro-publico", clienteId, cadastroPublicoId] as const,
    [clienteId, cadastroPublicoId],
  );

  const { data, isLoading } = useQuery<CadastroDocs | null>({
    queryKey,
    enabled: Boolean(clienteId || cadastroPublicoId),
    queryFn: async () => {
      const cols = "id, selfie_path, documento_identidade_path, comprovante_endereco_path, created_at, status";
      // 1) Vínculo direto via cadastro_publico_id
      if (cadastroPublicoId) {
        const { data: row } = await supabase
          .from("qa_cadastro_publico" as any)
          .select(cols)
          .eq("id", cadastroPublicoId)
          .maybeSingle();
        if (row) return row as unknown as CadastroDocs;
      }
      // 2) Fallback por cliente_id_vinculado (cobre clientes vinculados antes
      //    de termos `cadastro_publico_id` populado em qa_clientes)
      if (clienteId) {
        const { data: row } = await supabase
          .from("qa_cadastro_publico" as any)
          .select(cols)
          .eq("cliente_id_vinculado", clienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (row) return row as unknown as CadastroDocs;
      }
      return null;
    },
  });

  function handleOpen(path: string) {
    const fileName = path.split("/").pop() || "documento";
    viewer.abrirStorage(BUCKET, path, { fileName, title: fileName });
  }

  if (!clienteId && !cadastroPublicoId) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[10px] uppercase tracking-wider">
          Carregando documentos do cadastro público…
        </span>
      </div>
    );
  }

  if (!data) return null;

  const arquivos = TIPOS.filter((t) => Boolean(data[t.key]));
  if (arquivos.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#E5C2C6] bg-[#FBF3F4] p-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <FileImage className="h-4 w-4 text-[#7A1F2B]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            Documentos do Cadastro Público
          </span>
          <span className="text-[10px] text-slate-500">
            · {arquivos.length} arquivo(s)
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#7A1F2B]">
          <ShieldAlert className="h-3 w-3" /> Somente leitura
        </span>
      </div>

      <div className="grid gap-2">
        {arquivos.map(({ key, label, Icon }) => {
          const path = data[key] as string;
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide truncate">
                    {label}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {path.split("/").pop()}
                    {data.created_at && (
                      <span className="ml-2">· enviado em {formatDateTime(data.created_at)}</span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] shrink-0"
                onClick={() => handleOpen(path)}
                title="Visualizar / baixar"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Visualizar
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[9px] text-slate-500 leading-snug">
        Estes arquivos vieram do formulário público de cadastro e ficam preservados como evidência.
        Para o fluxo de aprovação (CR, CRAF, GT/GTE, AC) use o Hub do Cliente abaixo.
      </p>
      <DocumentoViewerModal
        open={viewer.open}
        onClose={viewer.fechar}
        source={viewer.source}
        title={viewer.title}
      />
    </div>
  );
}
