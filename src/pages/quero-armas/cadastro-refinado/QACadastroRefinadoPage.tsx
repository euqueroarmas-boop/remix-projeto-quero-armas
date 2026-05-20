import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./styles/cadastroRefinado.css";
import { useCadastroRefinadoState } from "./hooks/useCadastroRefinadoState";
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
  const { state, update, updateDados, reset } = useCadastroRefinadoState();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Regra de primeira tela:
  // /cadastro e /cadastro-mira SEMPRE abrem em Etapa00Identificacao, exceto se:
  //  1) `?retomar=1` (continuação explícita do fluxo);
  //  2) usuário já está autenticado e dados do Arsenal já carregados nesta sessão;
  //  3) usuário já confirmou identificação nesta sessão (escolheu "começar agora"
  //     ou autenticou via OTP) — flag `identificacao_confirmada`.
  // `?servico=...` por si só NÃO pula a identificação.
  const retomar = params.get("retomar") === "1";
  const jaAutenticado =
    state.modo_cliente === "autenticado" && state.dados_carregados_do_arsenal;
  const podePularIdentificacao =
    retomar || jaAutenticado || state.identificacao_confirmada;

  // Step inicial conforme query params (executa só na montagem).
  // Wave 4A: `?servico=` SEMPRE pula para confirmação (step 1), seja qual
  // for a família (Defesa Pessoal, CAC, Profissional). O Etapa01Servico
  // resolve o slug no catálogo e cai para Etapa00 se for inválido.
  const [step, setStep] = useState<number>(() => {
    if (params.get("servico")) return 1;
    return 0;
  });
  // Tela de "já tenho conta no Arsenal" — antecede o step 0 quando indefinido.
  // Se veio com `?servico=` direto da landing/CTA, também pula a identificação.
  const [showIdent, setShowIdent] = useState<boolean>(
    () => !podePularIdentificacao && !params.get("servico"),
  );
  // Após autenticação bem-sucedida, mostra resumo "encontrei seu cadastro"
  const [showEncontrado, setShowEncontrado] = useState<boolean>(false);
  // Se cliente entrou direto via ?servico=, lembramos disso p/ Voltar levar para "/"
  const [enteredDirect] = useState<boolean>(() => Boolean(params.get("servico")));
  const [initialPerfil, setInitialPerfil] = useState<string | null>(() => params.get("perfil_v2"));

  // Sanidade: se mudou query depois (improvável), respeitar
  useEffect(() => {
    const servico = params.get("servico");
    if (servico && step === 0 && !showIdent) setStep(1);
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
    update({
      servicosSlugs: [slug],
      perfilV2: perfilV2 ?? state.perfilV2,
      origem: state.origem ?? "etapa00",
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