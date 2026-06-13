import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SiteShell } from "@/shared/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { getServiceBySlug, type ServiceWithCategory } from "@/shared/data/catalog";
import { useCart } from "@/shared/cart/CartProvider";
import { useToast } from "@/hooks/use-toast";
import {
  getServiceLegalDetails,
  sistemaLabel,
  type ServiceLegalDetails,
} from "@/lib/quero-armas/serviceLegalDetails";
import { formatBRL } from "@/shared/lib/formatters";
import { ArrowLeft, ArrowRight, Loader2, ShoppingCart } from "lucide-react";
import { SEO } from "@/shared/components/SEO";
import { ShareButton } from "@/shared/components/ShareButton";
import { buildServiceMeta } from "@/shared/seo/pageMeta";
import { ConcessaoCrConteudo } from "@/components/quero-armas/servicos/ConcessaoCrConteudo";

const sectionCls =
  "relative left-1/2 w-dvw max-w-none -translate-x-1/2 overflow-hidden";
const innerCls = "w-full px-4 sm:px-6 lg:px-10 2xl:px-16";
const proseCls = "mx-auto max-w-3xl";

type LoadState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ok"; service: ServiceWithCategory; details: ServiceLegalDetails | null };

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 font-heading text-base font-bold uppercase tracking-[0.22em] text-foreground">
      {children}
    </h2>
  );
}

function Divider() {
  return <hr className="my-6 border-border" />;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-muted-foreground">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="font-heading text-xs font-bold text-accent">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

function shareBodyForService(slug: string) {
  switch (slug) {
    case "posse-de-arma-de-fogo":
      return [
        "Posse de arma de fogo com acompanhamento técnico e administrativo na Polícia Federal.",
        "Você entende o caminho do processo antes de protocolar qualquer etapa.",
        "Revisamos a documentação com foco em coerência, completude e estratégia.",
        "Orientamos os requisitos legais e os documentos que sustentam o pedido.",
        "Apoiamos o enquadramento correto no Sinarm Defesa Pessoal.",
        "Reduzimos o risco de exigências causadas por falhas ou inconsistências evitáveis.",
        "Você ganha clareza sobre exames, laudos e requisitos subjetivos do processo.",
        "Acompanhamos o andamento para que cada fase seja conduzida com atenção.",
        "O objetivo é protocolar com mais segurança, técnica e previsibilidade.",
        "Assessoria especializada para quem quer regularizar a posse do jeito certo.",
      ].join("\n");
    case "aquisicao-registro-posse-de-arma-de-fogo":
      return [
        "Aquisição, registro e posse de arma de fogo com acompanhamento completo na Polícia Federal.",
        "Você entra com o pedido de forma mais organizada, técnica e segura.",
        "Analisamos a documentação antes do protocolo para evitar retrabalho.",
        "Orientamos cada etapa do processo com base na legislação aplicável.",
        "Apoiamos o enquadramento correto do seu pedido no Sinarm Defesa Pessoal.",
        "Reduzimos o risco de exigências por falhas documentais ou inconsistências.",
        "Acompanhamos o andamento administrativo do início ao fim.",
        "Você ganha clareza sobre os requisitos técnicos e psicológicos do processo.",
        "O foco é protocolar com precisão, coerência e estratégia.",
        "Assessoria especializada para quem quer regularizar tudo do jeito certo.",
      ].join("\n");
    case "renovacao-posse-de-arma-de-fogo":
      return [
        "Renovação de posse de arma de fogo com condução técnica e documental na Polícia Federal.",
        "Analisamos o processo antes do protocolo para evitar retrabalho desnecessário.",
        "Conferimos documentos, validade de laudos e coerência do dossiê apresentado.",
        "Você recebe orientação clara sobre o que manter, atualizar ou complementar.",
        "Apoiamos o enquadramento correto no Sinarm Defesa Pessoal.",
        "Reduzimos o risco de exigências por omissões, divergências ou erros formais.",
        "Acompanhamos o andamento administrativo até a conclusão do pedido.",
        "Você ganha previsibilidade sobre etapas, prazos e requisitos técnicos.",
        "O foco é renovar com segurança, regularidade e boa estratégia processual.",
        "Assessoria especializada para manter sua posse válida sem improviso.",
      ].join("\n");
    case "renovacao-de-porte-de-arma-de-fogo":
      return [
        "Renovação de porte de arma de fogo com condução técnica especializada.",
        "O processo é estruturado com atenção à prova, coerência e fundamentação.",
        "Analisamos a documentação antes do protocolo para reduzir retrabalho.",
        "Orientamos cada etapa conforme a legislação e a lógica administrativa aplicada.",
        "Você entende melhor o que fortalece ou enfraquece o pedido de renovação.",
        "Reduzimos o risco de exigências por inconsistências documentais evitáveis.",
        "Acompanhamos o andamento com foco em regularidade e resposta técnica.",
        "Você ganha mais clareza sobre requisitos subjetivos e prova necessária.",
        "O objetivo é renovar com mais segurança jurídica e processual.",
        "Assessoria especializada para quem quer manter o porte com estratégia.",
      ].join("\n");
    case "porte-de-arma-de-fogo-por-ameaca-grave-ameaca":
      return [
        "Pedido de porte por ameaça ou grave ameaça com estratégia técnica e probatória.",
        "Organizamos o caso com foco em coerência narrativa e força documental.",
        "Analisamos boletins, registros e demais elementos antes do protocolo.",
        "Orientamos como estruturar a demonstração do risco de forma mais consistente.",
        "Você ganha clareza sobre o que efetivamente sustenta o pedido na prática.",
        "Reduzimos o risco de fragilidade argumentativa e exigências evitáveis.",
        "Acompanhamos o andamento administrativo com atenção a cada etapa.",
        "O foco é apresentar um processo tecnicamente mais sólido e bem amarrado.",
        "Cada decisão documental é pensada para reforçar a consistência do caso.",
        "Assessoria especializada para quem precisa protocolar com seriedade e precisão.",
      ].join("\n");
    case "porte-funcional-magistrado-ministerio-publico":
      return [
        "Porte funcional com assessoria técnica, sigilo e organização documental.",
        "Conduzimos o processo com atenção ao padrão institucional exigido.",
        "Analisamos a documentação antes do protocolo para evitar ruído processual.",
        "Você recebe orientação clara sobre requisitos formais e etapas críticas.",
        "A atuação prioriza discrição, conformidade e consistência administrativa.",
        "Reduzimos o risco de exigências por falhas documentais ou desencontro de informações.",
        "Acompanhamos o andamento com foco em regularidade e previsibilidade.",
        "Você ganha mais clareza sobre o fluxo, os requisitos e a lógica do processo.",
        "O objetivo é protocolar com segurança técnica e apresentação impecável.",
        "Assessoria especializada para porte funcional com condução premium.",
      ].join("\n");
    case "concessao-cr":
      return [
        "Concessão de CR com acompanhamento técnico e administrativo especializado.",
        "Organizamos o processo para que o pedido entre de forma mais coerente e segura.",
        "Analisamos a documentação antes do protocolo para evitar retrabalho.",
        "Orientamos cada etapa com base na legislação e no fluxo aplicável ao caso.",
        "Apoiamos o enquadramento correto no Sinarm-CAC da Polícia Federal.",
        "Reduzimos o risco de exigências por falhas documentais ou inconsistências evitáveis.",
        "Acompanhamos o andamento administrativo até a emissão regular do certificado.",
        "Você ganha clareza sobre requisitos, laudos, documentação e estrutura do pedido.",
        "O foco é protocolar com precisão, estratégia e boa apresentação técnica.",
        "Assessoria especializada para quem quer conquistar o CR do jeito certo.",
      ].join("\n");
    case "renovacao-cr":
      return [
        "Renovação de CR com condução técnica e acompanhamento administrativo especializado.",
        "Revisamos o dossiê antes do protocolo para reduzir retrabalho e exigências.",
        "Você recebe orientação clara sobre documentos, prazos e requisitos aplicáveis.",
        "Apoiamos o enquadramento correto no Sinarm-CAC da Polícia Federal.",
        "Organizamos cada etapa para que o processo siga com mais coerência e previsibilidade.",
        "Reduzimos o risco de inconsistências que atrasam ou fragilizam o pedido.",
        "Acompanhamos o andamento até a conclusão da renovação.",
        "Você ganha clareza sobre regularidade, manutenção documental e próximos passos.",
        "O foco é renovar com segurança técnica, precisão e boa estratégia processual.",
        "Assessoria especializada para manter seu CR em dia do jeito certo.",
      ].join("\n");
    case "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac":
      return [
        "Autorização de compra para atirador esportivo com condução técnica especializada.",
        "Analisamos o acervo e a documentação antes do protocolo do pedido.",
        "Orientamos cada etapa para que a solicitação entre com mais coerência e segurança.",
        "Apoiamos o enquadramento correto no Sinarm-CAC da Polícia Federal.",
        "Reduzimos o risco de exigências por falhas documentais ou leitura inadequada do caso.",
        "Você ganha clareza sobre limites, requisitos e estrutura da autorização.",
        "Acompanhamos o andamento administrativo com foco em regularidade.",
        "Cada detalhe é pensado para fortalecer a consistência do protocolo.",
        "O objetivo é comprar com mais segurança processual e menos improviso.",
        "Assessoria especializada para autorização de compra do jeito certo.",
      ].join("\n");
    case "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac":
      return [
        "Autorização de compra para caçador com análise técnica e acompanhamento especializado.",
        "Revisamos acervo, documentos e enquadramento antes do protocolo do pedido.",
        "Orientamos o processo com foco em coerência, regularidade e segurança administrativa.",
        "Apoiamos o enquadramento correto no Sinarm-CAC da Polícia Federal.",
        "Reduzimos o risco de exigências por inconsistências documentais evitáveis.",
        "Você entende melhor os requisitos que sustentam a autorização.",
        "Acompanhamos o andamento administrativo até a conclusão do processo.",
        "Cada etapa é conduzida com atenção à estratégia e à boa apresentação do caso.",
        "O foco é protocolar de forma mais sólida, técnica e previsível.",
        "Assessoria especializada para autorização de compra com segurança documental.",
      ].join("\n");
    case "guia-de-trafego-especial-cac":
      return [
        "Guia de Tráfego Especial com condução técnica e organização documental especializada.",
        "Analisamos o caso antes do protocolo para reduzir exigências e retrabalho.",
        "Orientamos a documentação necessária conforme o deslocamento e a finalidade.",
        "Apoiamos o enquadramento correto no Sinarm-CAC da Polícia Federal.",
        "Você ganha clareza sobre cobertura, regularidade e uso adequado da guia.",
        "Reduzimos o risco de inconsistências formais que atrasam a emissão.",
        "Acompanhamos o andamento administrativo com foco em previsibilidade.",
        "Cada etapa é pensada para reforçar segurança documental e operacional.",
        "O objetivo é viabilizar o tráfego com mais tranquilidade e regularidade.",
        "Assessoria especializada para emitir sua GTE do jeito certo.",
      ].join("\n");
    case "guia-de-transito-gt":
      return [
        "Guia de Trânsito com orientação técnica e acompanhamento administrativo especializado.",
        "Estruturamos o protocolo para que o deslocamento ocorra com regularidade e clareza.",
        "Revisamos documentos e finalidade antes da solicitação para evitar retrabalho.",
        "Você recebe orientação objetiva sobre etapas, exigências e limites aplicáveis.",
        "Apoiamos o enquadramento correto junto à Polícia Federal.",
        "Reduzimos o risco de exigências por falhas formais ou inconsistências evitáveis.",
        "Acompanhamos o andamento administrativo até a emissão.",
        "Você ganha mais segurança documental para circular dentro das regras.",
        "O foco é protocolar com precisão e rastreabilidade processual.",
        "Assessoria especializada para GT com condução técnica do início ao fim.",
      ].join("\n");
    case "registro-arma-fogo":
      return [
        "Registro de arma de fogo para defesa pessoal com acompanhamento na Polícia Federal.",
        "Analisamos a documentação antes do protocolo para evitar retrabalho e exigências.",
        "Orientamos cada etapa com foco em coerência, regularidade e estratégia.",
        "Apoiamos o enquadramento correto no Sinarm Defesa Pessoal.",
        "Você ganha clareza sobre requisitos técnicos, laudos e estrutura do pedido.",
        "Reduzimos o risco de inconsistências documentais que atrasam a emissão.",
        "Acompanhamos o andamento administrativo com atenção a cada fase.",
        "O processo é conduzido para entrar mais limpo, sólido e bem organizado.",
        "O objetivo é registrar com mais segurança jurídica e administrativa.",
        "Assessoria especializada para regularizar o registro do jeito certo.",
      ].join("\n");
    case "registro-e-apostilamento-de-arma-de-fogo-cac":
      return [
        "Registro e apostilamento de arma com condução técnica especializada no Sinarm-CAC.",
        "Analisamos o acervo e a documentação antes do protocolo para evitar retrabalho.",
        "Orientamos cada etapa com foco em coerência cadastral e regularidade administrativa.",
        "Apoiamos o enquadramento correto do pedido junto à Polícia Federal.",
        "Reduzimos o risco de exigências por inconsistências formais ou documentais.",
        "Você ganha clareza sobre a lógica do apostilamento e seus requisitos.",
        "Acompanhamos o andamento administrativo até a conclusão.",
        "Cada detalhe é pensado para manter o acervo regular e bem estruturado.",
        "O foco é protocolar com precisão, segurança e boa apresentação técnica.",
        "Assessoria especializada para registro e apostilamento do jeito certo.",
      ].join("\n");
    case "segunda-via-de-craf-digital":
      return [
        "Segunda via de CRAF digital com condução ágil e organização documental especializada.",
        "Analisamos a situação antes do pedido para evitar retrabalho e ruído processual.",
        "Orientamos os documentos e etapas aplicáveis ao caso concreto.",
        "Apoiamos o enquadramento correto do pedido junto à Polícia Federal.",
        "Você ganha clareza sobre regularidade, emissão e atualização do documento.",
        "Reduzimos o risco de exigências por falhas formais ou informação incompleta.",
        "Acompanhamos o andamento administrativo até a conclusão da emissão.",
        "O processo é conduzido com foco em objetividade, rapidez e segurança.",
        "Cada etapa é organizada para restabelecer sua documentação sem improviso.",
        "Assessoria especializada para emitir a segunda via do jeito certo.",
      ].join("\n");
    case "operador-de-pistola-nivel-i":
      return [
        "Curso Operador de Pistola Nível I com foco em técnica, segurança e fundamento real.",
        "Você entra em contato com uma base estruturada e aplicável desde a primeira aula.",
        "A instrução é conduzida com atenção à postura, domínio e responsabilidade.",
        "Trabalhamos fundamentos essenciais para evolução consistente do operador.",
        "Você ganha clareza sobre manuseio, segurança e rotina de treino responsável.",
        "A experiência é organizada para gerar confiança, correção e consciência técnica.",
        "Cada etapa busca transformar teoria em prática supervisionada.",
        "O objetivo é formar uma base sólida e segura desde o início.",
        "Treinamento pensado para quem quer começar do jeito certo.",
        "Instrução especializada com padrão técnico e acompanhamento próximo.",
      ].join("\n");
    case "vip-operador-de-pistola-nivel-i":
      return [
        "Experiência VIP de Operador de Pistola Nível I com atenção individualizada.",
        "O treinamento é conduzido com foco em qualidade técnica e ritmo personalizado.",
        "Você recebe acompanhamento mais próximo em cada fase da instrução.",
        "Trabalhamos segurança, fundamentos e correções com maior profundidade.",
        "A proposta é oferecer uma experiência mais exclusiva e estratégica.",
        "Você ganha mais clareza sobre técnica, postura e progressão prática.",
        "Cada etapa é ajustada para melhor aproveitamento do aluno.",
        "O objetivo é acelerar aprendizado com mais conforto e precisão.",
        "Treinamento premium para quem busca evolução com acompanhamento próximo.",
        "Instrução especializada com padrão VIP do início ao fim.",
      ].join("\n");
    case "apostilamento-atualizacao":
      return [
        "Apostilamento e atualização de acervo com condução técnica especializada.",
        "Analisamos a base documental antes do protocolo para evitar retrabalho.",
        "Orientamos o processo com foco em coerência cadastral e regularidade.",
        "Apoiamos o enquadramento correto no Sinarm-CAC da Polícia Federal.",
        "Você ganha clareza sobre documentos, vínculos e estrutura do pedido.",
        "Reduzimos o risco de exigências por falhas documentais ou desencontro de dados.",
        "Acompanhamos o andamento administrativo até a conclusão do apostilamento.",
        "Cada etapa é pensada para preservar a consistência do seu acervo.",
        "O foco é manter tudo atualizado, regular e pronto para conferência.",
        "Assessoria especializada para atualização de acervo do jeito certo.",
      ].join("\n");
    case "mandado-de-seguranca":
      return [
        "Mandado de segurança em matéria de armas com atuação estratégica especializada.",
        "Analisamos o caso, a ilegalidade apontada e a documentação disponível antes de agir.",
        "A estrutura do pedido é pensada para dar clareza, força e coerência à tese.",
        "Você entende melhor o que pode ser discutido e qual o caminho mais adequado.",
        "A atuação prioriza técnica, objetividade e boa organização probatória.",
        "Reduzimos improviso na construção do caso e na leitura dos documentos.",
        "Acompanhamos a estratégia com foco em reação rápida e bem fundamentada.",
        "Cada decisão jurídica é alinhada à realidade administrativa do processo.",
        "O objetivo é enfrentar ilegalidades com seriedade e consistência técnica.",
        "Atuação especializada para quem precisa reagir do jeito certo.",
      ].join("\n");
    case "recurso-administrativo":
      return [
        "Recurso administrativo com análise técnica e construção estratégica da resposta.",
        "Revisamos o indeferimento, a documentação e os pontos frágeis do processo.",
        "A argumentação é organizada para responder com clareza e consistência.",
        "Você entende melhor onde o processo falhou e como isso pode ser enfrentado.",
        "A atuação busca reforçar coerência documental e precisão técnica.",
        "Reduzimos o risco de recurso genérico, fraco ou mal direcionado.",
        "Acompanhamos o andamento administrativo após o protocolo.",
        "Cada etapa é pensada para aumentar a solidez da contestação.",
        "O foco é recorrer com fundamento, estratégia e boa apresentação do caso.",
        "Assessoria especializada para enfrentar indeferimentos do jeito certo.",
      ].join("\n");
    case "transferencia-de-propriedade-de-arma-de-fogo":
      return [
        "Transferência de propriedade de arma de fogo com condução técnica especializada.",
        "Analisamos a documentação antes do protocolo para evitar inconsistências formais.",
        "Orientamos cada etapa com foco em regularidade, coerência e segurança jurídica.",
        "Apoiamos o enquadramento correto do pedido junto à Polícia Federal.",
        "Você ganha clareza sobre requisitos, documentos e fluxo do processo.",
        "Reduzimos o risco de exigências por falhas ou omissões evitáveis.",
        "Acompanhamos o andamento administrativo até a formalização da transferência.",
        "O processo é organizado para entrar mais limpo e previsível.",
        "O foco é transferir com segurança documental e boa estratégia processual.",
        "Assessoria especializada para formalizar a transferência do jeito certo.",
      ].join("\n");
    case "mudanca-servico":
      return [
        "Mudança de serviço de posse para CR com planejamento técnico e documental especializado.",
        "Analisamos sua situação atual antes de estruturar o novo caminho processual.",
        "Orientamos a transição com foco em coerência, regularidade e segurança administrativa.",
        "Apoiamos o enquadramento correto no Sinarm-CAC da Polícia Federal.",
        "Você ganha clareza sobre documentos, laudos e etapas da migração.",
        "Reduzimos o risco de ruído processual e exigências evitáveis durante a transição.",
        "Acompanhamos o andamento administrativo em cada fase do reposicionamento.",
        "O objetivo é transformar a mudança em um processo organizado e estratégico.",
        "Cada decisão é pensada para ampliar possibilidades com base sólida.",
        "Assessoria especializada para migrar do jeito certo, sem improviso.",
      ].join("\n");
    default:
      return "";
  }
}

export default function ServicoDetalhePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const { addItem } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getServiceBySlug(slug)
      .then((res) => {
        if (!active) return;
        if (!res) {
          setState({ status: "not_found" });
          return;
        }
        setState({
          status: "ok",
          service: res.service,
          details: getServiceLegalDetails(slug),
        });
      })
      .catch((e) =>
        active ? setState({ status: "error", message: e?.message ?? "Erro ao carregar serviço." }) : null,
      );
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (state.status === "ok") {
      document.title = `${state.details?.titulo ?? state.service.name} | Quero Armas`;
    } else if (state.status === "not_found") {
      document.title = "Serviço não encontrado | Quero Armas";
    }
  }, [state]);

  if (state.status === "loading") {
    return (
      <SiteShell>
        <section className={`${sectionCls} min-h-[60vh]`}>
          <div className={`${innerCls} flex min-h-[60vh] items-center justify-center py-20`}>
            <Loader2 className="size-6 animate-spin text-accent" />
          </div>
        </section>
      </SiteShell>
    );
  }

  if (state.status === "not_found" || state.status === "error") {
    const isError = state.status === "error";
    return (
      <SiteShell>
        <section className={`${sectionCls} border-b border-border`}>
          <div className={`${innerCls} py-20`}>
            <div className={proseCls}>
              <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
                {isError ? "Erro" : "Serviço não encontrado"}
              </p>
              <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight sm:text-4xl">
                {isError
                  ? "Não foi possível carregar o serviço."
                  : "Este serviço não existe ou está inativo."}
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                {isError
                  ? state.message
                  : "O link pode estar desatualizado. Volte ao catálogo para escolher um serviço disponível."}
              </p>
              <Button asChild className="mt-8 font-heading uppercase tracking-wide">
                <Link to="/servicos">
                  <ArrowLeft className="mr-2 size-4" /> Voltar ao catálogo
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </SiteShell>
    );
  }

  const { service, details } = state;
  const preco =
    service.base_price_cents > 0 ? formatBRL(service.base_price_cents) : "Sob consulta";
  const cadastroHref = `/cadastro?servico=${encodeURIComponent(service.slug)}`;
  const meta = buildServiceMeta(service.slug, {
    name: details?.titulo ?? service.name,
    short_description: service.short_description,
  });
  const shareBody = shareBodyForService(service.slug);

  return (
    <SiteShell>
      <SEO
        title={meta.title}
        description={meta.description}
        image={meta.image}
        canonical={`/servicos/${service.slug}`}
      />
      {/* HERO EDITORIAL */}
      <section className={`${sectionCls} border-b border-border bg-background`}>
        <div className={`${innerCls} py-12 sm:py-16`}>
          <div className={proseCls}>
            <button
              type="button"
              onClick={() => navigate("/servicos")}
                data-testid="service-detail-back"
              className="mb-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Voltar ao catálogo
            </button>

            <p className="font-heading text-[11px] font-bold uppercase tracking-[0.32em] text-accent">
              {details ? sistemaLabel[details.sistema] : "Catálogo Quero Armas"}
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight text-foreground sm:text-[2.75rem] sm:leading-tight">
              {details?.titulo ?? service.name}
            </h1>
            {service.short_description ? (
              <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
                {service.short_description}
              </p>
            ) : null}
            {service.base_legal ? (
              <p className="mt-2 text-[12px] italic leading-snug text-muted-foreground/80">
                {service.base_legal}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="font-heading uppercase tracking-wide"
                data-testid="service-detail-contract"
              >
                <Link to={cadastroHref}>
                  Contratar este serviço <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-heading uppercase tracking-wide"
                data-testid="service-detail-add-cart"
                onClick={() => {
                  addItem({
                    service_id: service.id,
                    service_slug: service.slug,
                    service_name: service.name,
                    unit_price_cents: service.base_price_cents,
                    quantity: 1,
                  });
                  toast({
                    title: "Serviço adicionado ao carrinho.",
                    description: service.name,
                  });
                  navigate("/carrinho");
                }}
              >
                <ShoppingCart className="mr-2 size-4" /> Adicionar ao carrinho
              </Button>
              <ShareButton
                size="lg"
                title={meta.title}
                description={meta.description}
                shareText={shareBody}
                includeTextInShare={Boolean(shareBody)}
              />
              <div className="sm:ml-auto">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  A partir de
                </p>
                <p className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {preco}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORPO TÉCNICO EDITORIAL */}
      <section className={`${sectionCls} border-b border-border`}>
        <div className={`${innerCls} py-12 sm:py-16`}>
          {service.slug === "concessao-cr" ? (
            <article className="mx-auto max-w-5xl">
              <ConcessaoCrConteudo />
              <hr className="my-10 border-border" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="font-heading uppercase tracking-wide">
                  <Link to={cadastroHref}>
                    Contratar este serviço <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="font-heading uppercase tracking-wide"
                >
                  <Link to="/servicos">Ver outros serviços</Link>
                </Button>
              </div>
            </article>
          ) : (
          <article className={proseCls}>
            {details ? (
              <>
                {/* Cabeçalho normativo */}
                <p className="font-heading text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Órgão competente
                </p>
                <p className="mt-2 text-[15px] text-foreground">{details.orgaoCompetente}</p>
                <p className="mt-4 font-heading text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Sistema aplicável
                </p>
                <p className="mt-2 text-[15px] text-foreground">
                  {sistemaLabel[details.sistema]}
                </p>

                <Divider />

                <H2>Base legal e normativa</H2>
                <Bullets items={details.baseLegal} />

                <H2>O que é</H2>
                <Paragraph>{details.oQueE}</Paragraph>

                <H2>Quando se aplica</H2>
                <Paragraph>{details.quandoSeAplica}</Paragraph>

                <H2>Quem pode solicitar</H2>
                <Bullets items={details.quemPodeSolicitar} />

                <H2>Requisitos principais</H2>
                <Bullets items={details.requisitos} />

                <H2>Documentos normalmente exigidos</H2>
                <Bullets items={details.documentos} />

                <H2>Etapas práticas do processo</H2>
                <Steps items={details.etapas} />

                <H2>Pontos de atenção</H2>
                <Bullets items={details.pontosAtencao} />

                <H2>Limites do serviço da Quero Armas</H2>
                <Paragraph>{details.limitesQA}</Paragraph>
              </>
            ) : (
              <>
                <H2>Conteúdo técnico em revisão</H2>
                <Paragraph>
                  O conteúdo técnico-jurídico específico deste serviço está em revisão pela
                  equipe da Quero Armas e será publicado em breve. Para evitar informação
                  imprecisa, optamos por não exibir texto genérico.
                </Paragraph>
                <Paragraph>
                  Você pode iniciar seu cadastro normalmente: o atendimento técnico
                  apresentará todos os requisitos, documentos e etapas aplicáveis ao seu caso
                  concreto.
                </Paragraph>
              </>
            )}

            <Divider />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="font-heading uppercase tracking-wide">
                <Link to={cadastroHref}>
                  Contratar este serviço <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="font-heading uppercase tracking-wide"
              >
                <Link to="/servicos">Ver outros serviços</Link>
              </Button>
            </div>
          </article>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
