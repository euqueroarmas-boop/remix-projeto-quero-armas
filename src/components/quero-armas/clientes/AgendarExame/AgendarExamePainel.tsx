// ============================================================================
// AgendarExamePainel — corpo da busca de credenciados da PF, sem chrome de
// modal. Usado embutido no checklist guiado (o cliente não sai do fluxo) e
// também dentro do AgendarExameModal.
// ============================================================================
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCredenciadosPsico, type CredenciadoPsico } from "./useCredenciadosPsico";
import { useCredenciadosIAT, type CredenciadoIAT } from "./useCredenciadosIAT";
import { AgendarExameList } from "./AgendarExameList";
import { normalizarSexo } from "./mensagemWhatsApp";
import { INSTRUTOR_PDF_PF } from "./instrutorPdfLinks";

export type AgendarExamePainelProps = {
  ativo: boolean;
  tipo: "psicologo" | "instrutor_tiro";
  cep?: string | null;
  uf?: string | null;
  cidade?: string | null;
  /** Entram no texto pronto do WhatsApp ("Sou Willian, de Goiânia/GO... obrigado"). */
  nomeCliente?: string | null;
  sexoCliente?: string | null;
  /** Deixa o próprio cliente completar o sexo do cadastro daqui, quando falta.
   *  Só no portal: a gravação é sempre no cadastro de quem está logado, então
   *  na tela da equipe (que abre a lista vendo o cadastro de outra pessoa)
   *  isso fica desligado. */
  permitirCompletarSexo?: boolean;
  /** Cabeçalho (título + fonte). Desligado quando o container já tem título. */
  comCabecalho?: boolean;
};

const TITULO = {
  psicologo: "PSICÓLOGOS CREDENCIADOS PELA PF",
  instrutor_tiro: "INSTRUTORES DE TIRO CREDENCIADOS PELA PF",
};

const AVISO =
  "qa-caption rounded-sm border border-[#f0d893] bg-[#fff8e1] px-3 py-2 !text-[#5a4500]";

export function AgendarExamePainel({ ativo, tipo, cep, uf, cidade, nomeCliente, sexoCliente, permitirCompletarSexo = false, comCabecalho = true }: AgendarExamePainelProps) {
  const [raio, setRaio] = useState(25);
  // Sexo respondido aqui mesmo: vale na hora para a mensagem do WhatsApp, sem
  // esperar o portal recarregar o cadastro.
  const [sexoLocal, setSexoLocal] = useState<"M" | "F" | null>(null);
  const [salvandoSexo, setSalvandoSexo] = useState<"M" | "F" | null>(null);
  const [erroSexo, setErroSexo] = useState<string | null>(null);
  const sexoEfetivo = sexoLocal ?? sexoCliente ?? null;
  const faltaSexo = permitirCompletarSexo && !normalizarSexo(sexoEfetivo);

  async function salvarSexo(valor: "M" | "F") {
    setSalvandoSexo(valor);
    setErroSexo(null);
    try {
      const { error } = await supabase.functions.invoke("qa-cliente-atualizar-cadastro", {
        body: { fields: { sexo: valor }, field_origins: { sexo: "manual" } },
      });
      if (error) throw error;
      setSexoLocal(valor);
    } catch (e) {
      setErroSexo(e instanceof Error ? e.message : "Não conseguimos salvar agora. Tente de novo.");
    } finally {
      setSalvandoSexo(null);
    }
  }

  const cepLimpo = (cep || "").replace(/\D/g, "");
  const cepValido = cepLimpo.length === 8;
  const isInstrutor = tipo === "instrutor_tiro";
  const cidadeCadastro = String(cidade || "").trim();

  const psicoParams = useMemo(() => ativo && !isInstrutor
    ? ({ tipo: "psicologo" as const, cep: cepValido ? cepLimpo : undefined, uf: !cepValido && uf ? uf : undefined, cidade: cidadeCadastro || undefined, raio_km: raio, limit: 10 })
    : null, [ativo, isInstrutor, cepValido, cepLimpo, uf, cidadeCadastro, raio]);
  const iatParams = useMemo(() => (ativo && isInstrutor && (cepValido || uf))
    ? ({ cep: cepValido ? cepLimpo : undefined, uf: !cepValido && uf ? uf : undefined, cidade: cidadeCadastro || undefined, raio_km: raio, limit: 20 })
    : null, [ativo, isInstrutor, cepValido, cepLimpo, uf, cidadeCadastro, raio]);

  const psico = useCredenciadosPsico(psicoParams);
  const iat = useCredenciadosIAT(iatParams);

  const loading = isInstrutor ? iat.loading : psico.loading;
  const error = isInstrutor ? iat.error : psico.error;
  const origin = isInstrutor ? iat.data?.origin || null : psico.origin;
  const ufResolved = (origin?.uf || uf || iat.data?.uf || "").toUpperCase();
  const cidadeResolved = cidadeCadastro || origin?.cidade || "";
  const cidadeUfLabel = cidadeResolved && ufResolved ? `${cidadeResolved.toUpperCase()}/${ufResolved}` : "";
  const pdfHref = isInstrutor && ufResolved ? INSTRUTOR_PDF_PF[ufResolved] : null;
  const iatMode = iat.data?.mode || null;
  const iatTemEnderecos = iat.data?.tem_enderecos ?? false;
  const foraDoRaio = isInstrutor ? Boolean(iat.data?.fora_do_raio) : psico.foraDoRaio;
  const geocodeFalhou = isInstrutor ? false : psico.geocodeFalhou;
  const distanciaMaisProximo = isInstrutor
    ? iat.data?.distancia_mais_proximo ?? null
    : psico.distanciaMaisProximo;

  const results: CredenciadoPsico[] = isInstrutor
    ? (iat.data?.results || []).map((r: CredenciadoIAT) => ({
        id: r.id,
        tipo: "instrutor_tiro",
        uf: r.uf,
        cidade: null,
        bairro: r.clube || null,
        nome: r.nome,
        registro: r.portaria ? `Portaria ${r.portaria}` : null,
        endereco: r.endereco,
        telefones: r.telefone ? [r.telefone] : [],
        emails: r.email ? [r.email] : [],
        validade: null,
        validade_label: r.validade || null,
        latitude: r.lat,
        longitude: r.lng,
        source_url: r.fonte_url || pdfHref || "",
        distancia_km: iatMode === "proximity" ? r.distancia_km ?? null : null,
      }))
    : psico.results;

  const fonteHref = tipo === "psicologo"
    ? "https://www.gov.br/pf/pt-br/assuntos/armas/psicologos/psicologos-crediciados"
    : "https://www.gov.br/pf/pt-br/assuntos/armas/instrutores-de-armamento-e-tiro/credenciados";

  return (
    <div className="flex flex-col gap-3">
      {comCabecalho ? (
        <div>
          <div className="qa-eyebrow text-[#2F3439]">Agendar exame</div>
          <h2 className="qa-h2 mt-1 text-[#0A0A0A]">
            {TITULO[tipo]}{cidadeUfLabel ? ` EM ${cidadeUfLabel}` : ""}
          </h2>
          <p className="qa-caption mt-1 text-[#6A6A6A]">
            Fonte:{" "}
            <a href={fonteHref} target="_blank" rel="noreferrer noopener" className="text-[#2F3439] underline">
              gov.br/PF
            </a>
            {cidadeUfLabel ? ` · próximos de ${cidadeUfLabel}` : ""}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="qa-caption tracking-[0.14em] uppercase text-[#6A6A6A]">Raio:</span>
        {(isInstrutor && !iatTemEnderecos ? [] : [10, 25, 50, 100]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRaio(r)}
            className={`qa-btn-label rounded-full border px-3 py-1 transition-colors ${
              raio === r
                ? "border-[#2F3439] bg-[#2F3439] text-white"
                : "border-[#E4E4E4] bg-white text-[#303030] hover:bg-[#FAFAFA]"
            }`}
          >
            {r} km
          </button>
        ))}
        {isInstrutor && !iatTemEnderecos && ufResolved ? (
          <span className={AVISO}>A PF não publica endereço para {ufResolved} — exibindo lista alfabética da UF.</span>
        ) : null}
      </div>

      {error ? <div className="qa-caption text-[#df2727]">{error}</div> : null}
      {!cepLimpo && !uf ? (
        <div className={AVISO}>Cadastre seu CEP para vermos os profissionais mais próximos de você.</div>
      ) : null}
      {geocodeFalhou ? (
        <div className={AVISO}>
          Não conseguimos localizar o seu CEP no mapa agora. Busque pela sua cidade ou UF — assim evitamos mostrar
          profissionais distantes como se fossem próximos.
        </div>
      ) : null}
      {foraDoRaio ? (
        <div className={AVISO}>
          Nenhum credenciado dentro de {raio} km{origin?.cidade ? ` de ${origin.cidade}` : ""}. Mostrando os mais próximos
          {typeof distanciaMaisProximo === "number" ? ` — o mais perto está a ${Math.round(distanciaMaisProximo)} km` : ""}.
          {" "}Amplie o raio se quiser.
        </div>
      ) : null}

      {faltaSexo ? (
        <div className="rounded-sm border border-[#f0d893] bg-[#fff8e1] px-3 py-2.5">
          <div className="qa-caption !text-[#5a4500]">
            Falta um dado do seu cadastro: você é homem ou mulher? Sem isso a mensagem que
            vai para o profissional fica sem o fecho — “obrigado” ou “obrigada”.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["M", "Masculino"], ["F", "Feminino"]] as const).map(([valor, label]) => (
              <button
                key={valor}
                type="button"
                disabled={salvandoSexo !== null}
                onClick={() => salvarSexo(valor)}
                className="qa-btn-label rounded-full border border-[#2F3439] bg-white px-3 py-1 text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
              >
                {salvandoSexo === valor ? "Salvando…" : label}
              </button>
            ))}
          </div>
          {erroSexo ? <div className="qa-caption mt-1.5 !text-[#df2727]">{erroSexo}</div> : null}
        </div>
      ) : null}

      <AgendarExameList
        loading={loading}
        results={results}
        clienteNome={nomeCliente}
        clienteCidade={cidadeResolved}
        clienteUf={ufResolved}
        clienteSexo={sexoEfetivo}
        empty={
          isInstrutor
            ? "Nenhum instrutor encontrado para esta UF."
            : "Nenhum profissional encontrado neste raio. Tente aumentar o raio ou ver a lista do estado."
        }
      />

      {isInstrutor ? (
        <div className="rounded-sm border border-[#E4E4E4] bg-white p-3">
          <div className="qa-eyebrow text-[#0A0A0A]">Lista oficial PF (PDF)</div>
          <p className="qa-caption mt-1 text-[#6A6A6A]">
            Fonte oficial da Polícia Federal — sempre consulte o PDF para conferir.
          </p>
          {pdfHref ? (
            <a href={pdfHref} target="_blank" rel="noreferrer noopener" className="qa-caption mt-1 inline-block font-bold text-[#2F3439] underline">
              Baixar lista atualizada — {ufResolved}
            </a>
          ) : (
            <p className="qa-caption mt-1 text-[#6A6A6A]">Informe o CEP ou UF para abrir o PDF do seu estado.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
