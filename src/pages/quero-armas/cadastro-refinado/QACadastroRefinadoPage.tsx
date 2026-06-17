import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./styles/cadastroRefinado.css";
import {
  useCadastroRefinadoState,
  clearCadastroRefinadoStorage,
} from "./hooks/useCadastroRefinadoState";
import type { CadastroRefinadoState } from "./hooks/useCadastroRefinadoState";
import { useAuth } from "@/shared/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatPhone } from "@/shared/lib/formatters";
import Etapa00Escolha from "./steps/Etapa00Escolha";
import Etapa00Identificacao from "./steps/Etapa00Identificacao";
import Etapa00bClienteEncontrado from "./steps/Etapa00bClienteEncontrado";
import Etapa01Servico from "./steps/Etapa01Servico";
import Etapa02Documentos from "./steps/Etapa02Documentos";
import Etapa03Revisao from "./steps/Etapa03Revisao";
import Etapa04Pagamento from "./steps/Etapa04Pagamento";
import Etapa05Conclusao from "./steps/Etapa05Conclusao";

export default function QACadastroRefinadoPage() {
  // Reinício explícito via URL (`?novo=1` ou `?reset=1`): limpamos o
  // sessionStorage do fluxo ANTES do hook ler o estado inicial. Assim o
  // hook já inicia com `initial` (documentos vazios, dados zerados, etc.).
  // Atualizar a página sem essas flags continua preservando a sessão.
  const [resetAppliedFromUrl] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("novo") === "1" || sp.get("reset") === "1") {
      clearCadastroRefinadoStorage();
      return true;
    }
    return false;
  });
  const { state, update, updateDados, reset } = useCadastroRefinadoState();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Logout reativo: se o usuário deixar de existir (signOut) e o state
  // ainda guardar marcas de "autenticado", limpamos imediatamente em memória
  // para que mensagens como "Entramos com sua conta..." sumam SEM depender
  // de recarregar a página. Preserva serviço, documentos enviados, URL e
  // demais campos do checkout. Não toca em sessionStorage diretamente — o
  // próprio hook persiste o novo state.
  useEffect(() => {
    if (authLoading) return;
    if (user) return;
    if (
      state.modo_cliente === "autenticado" ||
      state.dados_carregados_do_arsenal ||
      state.cliente_existente_id ||
      state.clienteExistente
    ) {
      update({
        modo_cliente: "indefinido",
        identificacao_confirmada: false,
        cliente_existente_id: null,
        clienteExistente: false,
        dados_carregados_do_arsenal: false,
        documentos_reaproveitados: [],
        documentos_vencidos: [],
        documentos_pendentes_revisao: [],
        servicos_anteriores: [],
        processos_ativos: [],
        contratos_existentes: [],
        arsenal_resumo: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Regra de primeira tela:
  // /cadastro e /cadastro-mira SEMPRE abrem em Etapa00Identificacao, exceto se:
  //  1) `?retomar=1` (continuação explícita do fluxo);
  //  2) usuário já está autenticado e dados do Arsenal já carregados nesta sessão;
  //  3) usuário já confirmou identificação nesta sessão (escolheu "começar agora"
  //     ou autenticou via OTP) — flag `identificacao_confirmada`.
  // `?servico=...` por si só NÃO pula a identificação.
  const retomar = params.get("retomar") === "1";
  const servicoConfirmado = params.get("servico_confirmado") === "1";
  const jaAutenticado =
    state.modo_cliente === "autenticado" && state.dados_carregados_do_arsenal;
  const podePularIdentificacao =
    retomar || jaAutenticado || state.identificacao_confirmada;

  // Step inicial conforme query params (executa só na montagem).
  // Wave 4A: `?servico=` SEMPRE pula para confirmação (step 1), seja qual
  // for a família (Defesa Pessoal, CAC, Profissional). O Etapa01Servico
  // resolve o slug no catálogo e cai para Etapa00 se for inválido.
  const [step, setStep] = useState<number>(() => {
    const servicoInicial = params.get("servico");
    if (servicoInicial && servicoConfirmado) return 2;
    return servicoInicial ? 1 : 0;
  });
  // Tela de "já tenho conta no Arsenal" — antecede o step 0 quando indefinido.
  // `?servico=` mantém o serviço pré-selecionado, mas não pula identificação.
  const [showIdent, setShowIdent] = useState<boolean>(() => !podePularIdentificacao);
  // Após autenticação bem-sucedida, mostra resumo "encontrei seu cadastro"
  const [showEncontrado, setShowEncontrado] = useState<boolean>(false);
  // Se cliente entrou direto via ?servico=, lembramos disso p/ Voltar levar para "/"
  const [enteredDirect] = useState<boolean>(() => Boolean(params.get("servico")));
  const [initialPerfil, setInitialPerfil] = useState<string | null>(() => params.get("perfil_v2"));
  const clearStaleCheckoutResult = (
    slugs: string[],
    currentResult: CadastroRefinadoState["resultado"],
  ): CadastroRefinadoState["resultado"] => {
    if (!currentResult) return currentResult;
    const nextKey = slugs.join(",");
    const currentKey = currentResult.servico_slug_key || "";
    const hasCheckoutState =
      !!currentResult.venda_id ||
      !!currentResult.checkout_token ||
      !!currentResult.asaas_invoice_url ||
      !!currentResult.asaas_payment_id ||
      !!currentResult.asaas_pix_payload ||
      !!currentResult.asaas_bank_slip_url;

    if (!hasCheckoutState) {
      return {
        ...currentResult,
        servico_slugs: slugs,
        servico_slug_key: nextKey,
      };
    }

    if (currentKey && currentKey === nextKey) {
      return {
        ...currentResult,
        servico_slugs: slugs,
        servico_slug_key: nextKey,
      };
    }

    return {
      cliente_id: currentResult.cliente_id,
      solicitacao_id: currentResult.solicitacao_id,
      numero_processo: currentResult.numero_processo,
      numero_protocolo: currentResult.numero_protocolo,
      servico_slugs: slugs,
      servico_slug_key: nextKey,
    };
  };

  // Após aplicar o hard reset via URL, removemos as flags `novo`/`reset`
  // para não disparar reset em loop em re-renders. Preserva `servico=` e
  // outros parâmetros (perfil_v2, etc.) que devem continuar válidos.
  useEffect(() => {
    if (!resetAppliedFromUrl) return;
    const next = new URLSearchParams(params);
    let changed = false;
    if (next.has("novo")) { next.delete("novo"); changed = true; }
    if (next.has("reset")) { next.delete("reset"); changed = true; }
    if (changed) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAppliedFromUrl]);
  // Sanidade: se mudou query depois (improvável), respeitar
  useEffect(() => {
    const servico = params.get("servico");
    if (servico && servicoConfirmado && step < 2 && !showIdent) setStep(2);
    if (servico && step === 0 && !showIdent) setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Pré-seleção do serviço a partir da URL.
  // Antes, quem hidratava `state.servicosSlugs` a partir de `?servico=` era a
  // Etapa 01. Quando a URL traz `servico_confirmado=1`, pulamos direto para o
  // step 2 e a Etapa 01 nunca roda — então o state ficava sem serviço e o
  // checkout (Etapa 04) não encontrava nada no catálogo. Aqui garantimos a
  // hidratação sempre que houver `?servico=` na URL, sem alterar o pulo de
  // etapas já aprovado.
  useEffect(() => {
    const raw = params.get("servico");
    if (!raw) return;
    const slugs = raw
      .split(",")
      .map((s) => s.trim().replace(/_/g, "-"))
      .filter(Boolean);
    if (slugs.length === 0) return;
    const sameAsState =
      state.servicosSlugs.length === slugs.length &&
      state.servicosSlugs.every((s, i) => s === slugs[i]);
    if (sameAsState) return;
    update({
      servicosSlugs: slugs,
      origem: params.get("origem") || state.origem,
      perfilV2: params.get("perfil_v2") || state.perfilV2,
      aceiteContrato: false,
      resultado: clearStaleCheckoutResult(slugs, state.resultado),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // PR 2 — Retomada pós-login + reaproveitamento automático.
  // Quando o usuário retorna autenticado (via /login?next=/cadastro?...),
  // hidratamos os dadosPessoais a partir de qa_clientes do cliente vinculado.
  // Regras:
  //  • Preserva serviço/etapa/documentos já no sessionStorage (não tocamos).
  //  • Não sobrescreve dado já digitado pelo cliente (existing-wins).
  //  • Não cria cliente/Auth/venda — apenas leitura.
  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        // eslint-disable-next-line no-console
        console.log("[CadastroRefinado] sessão ativa", !!sess?.session);
      } catch { /* ignore */ }
    })();
    if (!user) return;
    if (state.dados_carregados_do_arsenal) return;
    let cancelled = false;
    (async () => {
      try {
        let qaCliente: any = null;
        const { data: link } = await supabase
          .from("cliente_auth_links" as any)
          .select("qa_cliente_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        const qaClienteId = (link as any)?.qa_cliente_id ?? null;
        const selectCols =
          "id, nome_completo, cpf, email, celular, data_nascimento, cep, endereco, numero, complemento, bairro, cidade, estado";
        if (qaClienteId) {
          const { data } = await supabase
            .from("qa_clientes")
            .select(selectCols)
            .eq("id", qaClienteId)
            .maybeSingle();
          qaCliente = data;
        } else {
          const { data } = await supabase
            .from("qa_clientes")
            .select(selectCols)
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          qaCliente = data;
        }
        if (cancelled) return;
        const d = state.dadosPessoais;
        const keep = (current: string, incoming: string | null | undefined) =>
          current && current.trim().length > 0 ? current : (incoming || "").toString();
        const patch: Partial<typeof d> = {};
        if (qaCliente) {
          patch.nome_completo = keep(d.nome_completo, qaCliente.nome_completo);
          patch.cpf = keep(d.cpf, qaCliente.cpf ? formatCPF(String(qaCliente.cpf)) : "");
          patch.email = keep(d.email, (qaCliente.email || user.email || "").toLowerCase().trim());
          patch.telefone = keep(d.telefone, qaCliente.celular ? formatPhone(String(qaCliente.celular)) : "");
          patch.data_nascimento = keep(d.data_nascimento, qaCliente.data_nascimento || "");
          patch.endereco_cep = keep(d.endereco_cep, qaCliente.cep || "");
          patch.endereco_logradouro = keep(d.endereco_logradouro, qaCliente.endereco || "");
          patch.endereco_numero = keep(d.endereco_numero, qaCliente.numero || "");
          patch.endereco_complemento = keep(d.endereco_complemento, qaCliente.complemento || "");
          patch.endereco_bairro = keep(d.endereco_bairro, qaCliente.bairro || "");
          patch.endereco_cidade = keep(d.endereco_cidade, qaCliente.cidade || "");
          patch.endereco_estado = keep(
            d.endereco_estado,
            qaCliente.estado ? String(qaCliente.estado).toUpperCase().slice(0, 2) : "",
          );
        } else {
          patch.email = keep(d.email, (user.email || "").toLowerCase().trim());
        }
        updateDados(patch);
        update({
          modo_cliente: "autenticado",
          identificacao_confirmada: true,
          dados_carregados_do_arsenal: true,
          cliente_existente_id: qaCliente?.id ? String(qaCliente.id) : null,
          clienteExistente: !!qaCliente,
        });
        setShowIdent(false);
        // Carrega documentos reaproveitáveis (qa_documentos_cliente + qa_cadastro_publico)
        try {
          const { data: payload, error: efErr } = await supabase.functions.invoke(
            "qa-cadastro-carregar-cliente",
            { body: {} },
          );
          // eslint-disable-next-line no-console
          console.log(
            "[CadastroRefinado] cliente carregado",
            !!payload && !efErr,
            "documentos_validos count",
            Array.isArray((payload as any)?.documentos_validos)
              ? (payload as any).documentos_validos.length
              : 0,
          );
          if (!efErr && payload && !cancelled) {
            update({
              documentos_reaproveitados: (payload as any).documentos_validos || [],
              documentos_vencidos: (payload as any).documentos_vencidos || [],
              documentos_pendentes_revisao: (payload as any).documentos_pendentes || [],
              servicos_anteriores: (payload as any).servicos_anteriores || [],
              processos_ativos: (payload as any).processos_ativos || [],
              contratos_existentes: (payload as any).contratos_existentes || [],
              arsenal_resumo: (payload as any).arsenal_resumo || null,
            });
          }
        } catch (e) {
          console.warn("[CadastroRefinado] carregar-cliente falhou", e);
        }
      } catch (e) {
        console.warn("[cadastro-refinado] hydrate pós-login falhou", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, state.dados_carregados_do_arsenal]);

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSelectService = (slug: string, perfilV2?: string, subperfilV2?: string) => {
    const nextSlugs = [slug];
    update({
      servicosSlugs: nextSlugs,
      perfilV2: perfilV2 ?? state.perfilV2,
      origem: state.origem ?? "etapa00",
      aceiteContrato: false,
      resultado: clearStaleCheckoutResult(nextSlugs, state.resultado),
    });
    // Reflete no contexto (subperfil é informativo)
    if (subperfilV2) {
      try {
        sessionStorage.setItem("qa_cadastro_subperfil_v2", subperfilV2);
      } catch { /* ignore */ }
    }
    setStep(1);
  };

  const handleSelectBundle = (
    slugs: string[],
    perfilV2?: string,
    subperfilV2?: string,
  ) => {
    update({
      servicosSlugs: slugs,
      perfilV2: perfilV2 ?? state.perfilV2,
      origem: state.origem ?? "etapa00",
      aceiteContrato: false,
      resultado: clearStaleCheckoutResult(slugs, state.resultado),
    });
    if (subperfilV2) {
      try {
        sessionStorage.setItem("qa_cadastro_subperfil_v2", subperfilV2);
      } catch {
        /* ignore */
      }
    }
    setStep(1);
  };

  // Sair do wizard. Usa o histórico do navegador quando possível para
  // preservar a origem (ex.: /servicos). Fallback explícito vai para
  // /servicos — NUNCA para "/", pois a Home é um chunk pesado que dispara
  // o loader global "Inicializando módulos" no meio do fluxo.
  const handleBackToHome = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/servicos", { replace: true });
    }
  };

  // Atalho na escolha guiada: "Já tenho conta no Arsenal"
  const handleAbrirIdentificacao = () => {
    update({
      modo_cliente: "indefinido",
      identificacao_confirmada: false,
      cliente_existente_id: null,
      dados_carregados_do_arsenal: false,
    });
    setShowEncontrado(false);
    setShowIdent(true);
  };

  const handleEtapa01Back = () => {
    // Se o usuário entrou direto via ?servico=, não há step anterior interno
    // — saímos do wizard preservando a origem. Caso contrário, voltamos para
    // a Etapa 0 (Escolha) sem deixar /cadastro.
    if (enteredDirect) {
      handleBackToHome();
    } else {
      setInitialPerfil(null);
      setStep(0);
    }
  };

  // Renderização da etapa de Identificação (antes de tudo)
  if (showIdent) {
    return (
      <Etapa00Identificacao
        state={state}
        update={update}
        updateDados={updateDados}
        onNovo={() => {
          update({ modo_cliente: "novo", identificacao_confirmada: true });
          setShowIdent(false);
        }}
        onAutenticado={() => {
          update({ identificacao_confirmada: true });
          setShowIdent(false);
          setShowEncontrado(true);
        }}
        onBack={handleBackToHome}
      />
    );
  }

  if (showEncontrado) {
    return (
      <Etapa00bClienteEncontrado
        state={state}
        onContinuar={() => {
          setShowEncontrado(false);
          setStep(0);
        }}
        onAtualizar={() => {
          setShowEncontrado(false);
          setStep(3);
        }}
        onEnviarNovoDocumento={() => {
          setShowEncontrado(false);
          setStep(2);
        }}
        onBack={() => {
          setShowEncontrado(false);
          setShowIdent(true);
        }}
      />
    );
  }

  switch (step) {
    case 0:
      return (
        <Etapa00Escolha
          onSelectService={handleSelectService}
          onSelectBundle={handleSelectBundle}
          onBackToHome={handleBackToHome}
          initialPerfil={initialPerfil}
          onAbrirIdentificacao={handleAbrirIdentificacao}
        />
      );
    case 1:
      return <Etapa01Servico state={state} update={update} onNext={next} onBack={handleEtapa01Back} />;
    case 2:
      return <Etapa02Documentos state={state} update={update} updateDados={updateDados} onNext={next} onBack={back} />;
    case 3:
      return <Etapa03Revisao state={state} update={update} updateDados={updateDados} onNext={next} onBack={back} />;
    case 4:
      return <Etapa04Pagamento state={state} update={update} onNext={next} onBack={back} />;
    case 5:
      return <Etapa05Conclusao state={state} update={update} onReset={reset} />;
    default:
      return null;
  }
}
