import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function csvEscape(val: any): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function exportClientes() {
  const { data } = await supabase.from("qa_clientes" as any).select("*").order("nome_completo");
  if (!data?.length) { toast.error("Nenhum cliente"); return; }
  const headers = ["Nome", "CPF", "RG", "Celular", "Email", "Cidade", "UF", "Status", "Lions"];
  const rows = (data as any[]).map(c => [c.nome_completo, c.cpf, c.rg, c.celular, c.email, c.cidade, c.estado, c.status, c.cliente_lions ? "Sim" : "Não"]);
  downloadCsv("clientes_queroarmas.csv", headers, rows);
  toast.success("CSV exportado");
}

export async function exportCrafs(clienteId: number, nomeCliente: string) {
  const { data } = await supabase.from("qa_crafs" as any).select("*").eq("cliente_id", clienteId);
  if (!data?.length) { toast.info("Nenhum CRAF"); return; }
  const headers = ["Arma", "CRAF", "Nº Arma", "SIGMA", "Validade"];
  const rows = (data as any[]).map(c => [c.nome_arma, c.nome_craf, c.numero_arma, c.numero_sigma, c.data_validade]);
  downloadCsv(`crafs_${nomeCliente.replace(/\s/g, "_")}.csv`, headers, rows);
  toast.success("CRAFs exportados");
}

export async function exportGtes(clienteId: number, nomeCliente: string) {
  const { data } = await supabase.from("qa_gtes" as any).select("*").eq("cliente_id", clienteId);
  if (!data?.length) { toast.info("Nenhum GTE"); return; }
  const headers = ["Arma", "GTE", "Nº Arma", "SIGMA", "Validade"];
  const rows = (data as any[]).map(g => [g.nome_arma, g.nome_gte, g.numero_arma, g.numero_sigma, g.data_validade]);
  downloadCsv(`gtes_${nomeCliente.replace(/\s/g, "_")}.csv`, headers, rows);
  toast.success("GTEs exportados");
}

export async function exportCr(clienteId: number, nomeCliente: string) {
  const { data } = await supabase.from("qa_cadastro_cr" as any).select("*").eq("cliente_id", clienteId).limit(1);
  if (!data?.length) { toast.info("Nenhum CR"); return; }
  const cr = (data as any[])[0];
  const headers = ["Nº CR", "Validade CR", "Laudo Psicológico", "Exame Tiro", "Senha Gov"];
  const rows = [[cr.numero_cr, cr.validade_cr, cr.validade_laudo_psicologico, cr.validade_exame_tiro, cr.senha_gov]];
  downloadCsv(`cr_${nomeCliente.replace(/\s/g, "_")}.csv`, headers, rows);
  toast.success("CR exportado");
}

export async function exportVendas(clienteId: number, nomeCliente: string) {
  const { data } = await supabase.from("qa_vendas" as any).select("*").eq("cliente_id", clienteId).order("data_cadastro", { ascending: false });
  if (!data?.length) { toast.info("Nenhuma venda"); return; }
  const headers = ["ID", "Data", "Status", "Pagamento", "Valor", "Desconto", "Processo"];
  const rows = (data as any[]).map(v => [v.id_legado || v.id, v.data_cadastro, v.status, v.forma_pagamento, v.valor_a_pagar, v.desconto, v.numero_processo]);
  downloadCsv(`vendas_${nomeCliente.replace(/\s/g, "_")}.csv`, headers, rows);
  toast.success("Vendas exportadas");
}
