import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Monitor, ShieldCheck, Server, HardDrive, Network, FolderLock,
  CheckCircle2, Star, ArrowRight, Minus, Plus, Calculator,
  CheckCircle, FileText, CreditCard, FileBarChart, Loader2,
  ExternalLink, AlertTriangle, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import JsonLd from "@/components/JsonLd";
import { openWhatsApp } from "@/lib/whatsapp";
import WizardStepWrapper from "@/components/orcamento/WizardStepWrapper";
import QuickRegistrationForm, { type RegistrationData } from "@/components/orcamento/QuickRegistrationForm";
import type { CustomerData } from "@/components/orcamento/CustomerDataForm";


/* ─── Deliverables (info section) ─── */
const deliverables = [
  {
    icon: Monitor,
    title: "Padronização Completa Dos Equipamentos",
    items: [
      "Formatação de todos os computadores e notebooks com Windows 11 Pro",
      "Otimização de performance e padronização corporativa",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Proteção Avançada",
    items: [
      "Remoção total de vírus, malwares e ameaças ocultas",
      "Implantação de antivírus corporativo com proteção ativa",
    ],
  },
  {
    icon: Server,
    title: "Servidor Corporativo Com Windows Server 2016",
    items: [
      "Implantação completa do servidor",
      "Active Directory com controle total da rede",
      "Criação de usuários, grupos e permissões",
      "Políticas de segurança (GPO)",
      "Pastas auditadas e monitoradas",
      "Centralização total da gestão",
    ],
  },
  {
    icon: HardDrive,
    title: "Backup Profissional E Restauração Segura",
    items: [
      "Backup completo antes de qualquer intervenção",
      "Armazenamento em servidor seguro fornecido por nós ou em nuvem",
      "Devolução dos arquivos totalmente limpos e organizados",
    ],
  },
  {
    icon: Network,
    title: "Reconfiguração Completa Da Rede",
    items: [
      "Instalação de programas, impressoras e sistemas",
      "Integração com banco de dados",
      "Configuração de backups automáticos",
      "Estruturação de rede corporativa profissional",
    ],
  },
  {
    icon: FolderLock,
    title: "Organização E Controle De Acesso",
    items: [
      "Organização de pastas por setor com controle de acesso",
      "Permissões granulares por usuário e grupo",
    ],
  },
];

/* ─── Pricing ─── */
const BASE_PRICE_PER_PC = 200;
const SERVER_SETUP_PRICE = 5000;

// Gradual discount: 1-5 PCs = 0%, then linear up to 27.5% at 30 PCs
function getDiscountPct(pcs: number): number {
  if (pcs <= 5) return 0;
  if (pcs >= 30) return 27.5;
  // Linear interpolation from 6 PCs (starts discounting) to 30 PCs (27.5%)
  return ((pcs - 5) / (30 - 5)) * 27.5;
}

function calcTotal(pcs: number, includeServer: boolean) {
  const discountPct = getDiscountPct(pcs);
  const pcUnitPrice = BASE_PRICE_PER_PC * (1 - discountPct / 100);
  const pcTotal = pcs * pcUnitPrice;
  const serverTotal = includeServer ? SERVER_SETUP_PRICE : 0;
  const total = pcTotal + serverTotal;
  const fullPrice = pcs * BASE_PRICE_PER_PC + serverTotal;
  const savings = fullPrice - total;

  return { pcUnitPrice, pcTotal, serverTotal, total, fullPrice, savings, discountPct: Math.round(discountPct * 10) / 10 };
}

/* ─── Contract generator ─── */
function generateRestructuringContractHtml(
  customer: CustomerData,
  pcs: number,
  includeServer: boolean,
  pricing: ReturnType<typeof calcTotal>,
) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return `
<div style="font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.8; font-size: 12pt; text-align: justify;">

  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #000;">
    <p style="font-size: 14pt; font-weight: bold; margin: 0;">WMTi Tecnologia da Informação</p>
    <h1 style="font-size: 14pt; font-weight: bold; margin: 16px 0 0 0; text-transform: uppercase;">
      CONTRATO DE PRESTAÇÃO DE SERVIÇO — REESTRUTURAÇÃO COMPLETA DE REDE CORPORATIVA
    </h1>
  </div>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>

  <p><strong>CONTRATANTE:</strong> Razão Social: ${customer.razaoSocial}${customer.nomeFantasia ? `, Nome fantasia: ${customer.nomeFantasia}` : ""}, com sede em ${customer.endereco}, CIDADE DE ${customer.cidade}, com CEP ${customer.cep}, inscrita no ${customer.cnpjOuCpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"} sob o nº ${customer.cnpjOuCpf}, neste ato representada por ${customer.responsavel}, adiante denominado simplesmente CONTRATANTE.${customer.email ? ` E-mail: ${customer.email}.` : ""}${customer.telefone ? ` Telefone: ${customer.telefone}.` : ""}</p>

  <p><strong>CONTRATADA:</strong> WMTI TECNOLOGIA DA INFORMAÇÃO LTDA, pessoa jurídica privada, inscrita no CNPJ sob nº 13.366.668/0001-07, com sede na RUA JOSÉ BENEDITO DUARTE, 140, PARQUE ITAMARATI, CEP: 12.307-200, na CIDADE DE JACAREÍ no ESTADO DE SÃO PAULO, adiante denominada simplesmente como CONTRATADA.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO OBJETO DO CONTRATO</h2>

  <p><strong>Cláusula Primeira</strong> – O presente contrato tem como OBJETO a prestação do serviço de <strong>REESTRUTURAÇÃO COMPLETA DE REDE CORPORATIVA — PACOTE PREMIUM SEM LIMITE DE HORAS</strong>, conforme especificações abaixo:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Serviço</td>
      <td style="border: 1px solid #000; padding: 8px;">Reestruturação Completa de Rede Corporativa</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Modalidade</td>
      <td style="border: 1px solid #000; padding: 8px;">PACOTE PREMIUM — SEM LIMITE DE HORAS</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Qtd. Computadores</td>
      <td style="border: 1px solid #000; padding: 8px;">${pcs} computador${pcs > 1 ? "es" : ""}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Valor por Computador</td>
      <td style="border: 1px solid #000; padding: 8px;">R$ ${pricing.pcUnitPrice.toFixed(2).replace(".", ",")}</td>
    </tr>
    ${includeServer ? `<tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Implantação de Servidor</td>
      <td style="border: 1px solid #000; padding: 8px;">R$ ${SERVER_SETUP_PRICE.toFixed(2).replace(".", ",")}</td>
    </tr>` : ""}
    <tr style="background: #f5f5f5;">
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Valor Total do Projeto</td>
      <td style="border: 1px solid #000; padding: 8px;"><strong>R$ ${pricing.total.toFixed(2).replace(".", ",")}</strong></td>
    </tr>
    ${pricing.savings > 0 ? `<tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">Economia Obtida</td>
      <td style="border: 1px solid #000; padding: 8px; color: green;">R$ ${pricing.savings.toFixed(2).replace(".", ",")}</td>
    </tr>` : ""}
  </table>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO ESCOPO DOS SERVIÇOS</h2>

  <p><strong>Cláusula Segunda</strong> – A CONTRATADA executará, sem limite de horas, os seguintes serviços:</p>
  <p>a) Formatação e padronização de ${pcs} computador${pcs > 1 ? "es" : ""} com Windows 11 Pro;</p>
  <p>b) Remoção total de vírus, malwares e ameaças ocultas;</p>
  <p>c) Implantação de antivírus corporativo com proteção ativa;</p>
  ${includeServer ? `<p>d) Implantação de servidor corporativo com Windows Server 2016, Active Directory, GPO, criação de usuários/grupos e pastas auditadas;</p>` : ""}
  <p>${includeServer ? "e" : "d"}) Backup completo antes de intervenção e restauração segura;</p>
  <p>${includeServer ? "f" : "e"}) Reconfiguração completa da rede, instalação de programas, impressoras e sistemas;</p>
  <p>${includeServer ? "g" : "f"}) Organização de pastas por setor com controle de acesso e permissões granulares.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DA MODALIDADE DE EXECUÇÃO</h2>

  <p><strong>Cláusula Terceira</strong> – Este contrato opera na modalidade <strong>PACOTE PREMIUM SEM LIMITE DE HORAS</strong>. O CONTRATANTE paga pelo resultado final entregue, não pelo tempo de execução. A CONTRATADA se compromete a concluir todos os serviços descritos na Cláusula Segunda independentemente do número de horas necessárias.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO PAGAMENTO</h2>

  <p><strong>Cláusula Quarta</strong> – O CONTRATANTE deverá efetuar o pagamento integral do valor de <strong>R$ ${pricing.total.toFixed(2).replace(".", ",")}</strong> antes do início da prestação dos serviços, por meio de boleto bancário ou cartão de crédito.</p>

  <p><strong>Cláusula Quinta</strong> – O início da prestação dos serviços está condicionado à confirmação do pagamento pela CONTRATADA.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DAS OBRIGAÇÕES DA CONTRATADA</h2>

  <p><strong>Cláusula Sexta</strong> – A CONTRATADA obriga-se a:</p>
  <p>a) Executar todos os serviços descritos com diligência e qualidade técnica;</p>
  <p>b) Concluir o projeto sem limite de horas até a entrega completa;</p>
  <p>c) Manter sigilo sobre informações obtidas durante a prestação dos serviços;</p>
  <p>d) Emitir nota fiscal correspondente ao serviço prestado.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DAS OBRIGAÇÕES DO CONTRATANTE</h2>

  <p><strong>Cláusula Sétima</strong> – O CONTRATANTE obriga-se a:</p>
  <p>a) Disponibilizar acesso presencial a todos os equipamentos;</p>
  <p>b) Designar um responsável para acompanhar os serviços;</p>
  <p>c) Efetuar o pagamento conforme estabelecido neste contrato.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO ACEITE ELETRÔNICO</h2>

  <p><strong>Cláusula Oitava</strong> – O presente contrato é celebrado de forma eletrônica, sendo a assinatura digital do CONTRATANTE considerada válida e vinculante para todos os efeitos legais, nos termos da Medida Provisória nº 2.200-2/2001.</p>

  <h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">DO FORO</h2>

  <p><strong>Cláusula Nona</strong> – Fica eleito o Foro da Comarca de Jacareí/SP para dirimir quaisquer questões oriundas do presente contrato.</p>

  <p style="margin-top: 32px;">E, por estarem assim justas e contratadas, as partes assinam o presente Contrato eletronicamente.</p>

  <p style="margin-top: 24px; text-align: center;">Jacareí (SP), ${today}</p>

  <div style="margin-top: 48px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;">
      <div style="border-top: 1px solid #000; padding-top: 8px;">
        <p style="margin: 0;"><strong>${customer.responsavel}</strong></p>
        <p style="margin: 0; font-size: 10pt;">${customer.cnpjOuCpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"}: ${customer.cnpjOuCpf}</p>
        <p style="margin: 0; font-size: 10pt;">CONTRATANTE</p>
      </div>
    </div>
    <div style="text-align: center; width: 45%;">
      <div style="border-top: 1px solid #000; padding-top: 8px;">
        <p style="margin: 0;"><strong>Willian Rodrigues da Silva</strong></p>
        <p style="margin: 0; font-size: 10pt;">CPF: 377.995.388-99</p>
        <p style="margin: 0; font-size: 10pt;">CONTRATADA — WMTi</p>
      </div>
    </div>
  </div>

</div>
`;
}

/* ─── Types ─── */
type FlowStep = "calculator" | "registration" | "contract" | "payment";
type BillingType = "BOLETO" | "CREDIT_CARD";

/* ─── Page Component ─── */
const ReestruturacaoRedePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const wizardRef = useRef<HTMLDivElement>(null);
  const emailSentRef = useRef(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Calculator state
  const [pcs, setPcs] = useState(5);
  const [includeServer, setIncludeServer] = useState(true);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<FlowStep>("calculator");
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [contractSigned, setContractSigned] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<BillingType | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const pricing = calcTotal(pcs, includeServer);
  const localizedDeliverables = deliverables;

  // Poll contract signed
  useEffect(() => {
    if (currentStep !== "contract" || !contractId || contractSigned) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("contracts" as any)
        .select("signed")
        .eq("id", contractId)
        .single();
      if ((data as any)?.signed) {
        setContractSigned(true);
        setCurrentStep("payment");
        scrollToTop();
         toast({ title: t("restructuring.contractSigned"), description: t("restructuring.proceedPayment") });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentStep, contractId, contractSigned, toast]);

  // Poll payment confirmation
  useEffect(() => {
    if (!paymentComplete || paymentConfirmed || !quoteId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("payments")
        .select("payment_status")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data && ((data as any).payment_status === "CONFIRMED" || (data as any).payment_status === "RECEIVED")) {
        setPaymentConfirmed(true);
        if (registrationData && !emailSentRef.current) {
          emailSentRef.current = true;
          supabase.functions.invoke("send-purchase-confirmation", {
            body: {
              customer_name: registrationData.razaoSocial,
              customer_email: registrationData.email,
              service_name: "Reestruturação Completa de Rede Corporativa",
              computers_qty: pcs,
              value: pricing.total,
              payment_method: selectedPayment,
              contract_ref: contractId?.slice(0, 8).toUpperCase(),
              purchase_date: new Date().toLocaleDateString("pt-BR"),
              is_recurring: false,
            },
          }).catch(err => console.error("[WMTi] Email error:", err));
        }
        const purchaseData = {
          serviceName: "Reestruturação Completa de Rede Corporativa",
          computersQty: pcs,
          monthlyValue: pricing.total,
          isRecurring: false,
          customerName: registrationData?.razaoSocial || "",
          customerCpfCnpj: registrationData?.cnpjOuCpf || "",
          customerEmail: registrationData?.email || "",
          paymentMethod: selectedPayment || "CREDIT_CARD",
          contractId,
          purchaseDate: new Date().toLocaleDateString("pt-BR"),
        };
        try { sessionStorage.setItem("wmti_purchase_data", JSON.stringify(purchaseData)); } catch {}
        navigate(`/compra-concluida?quote=${quoteId}`);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [paymentComplete, paymentConfirmed, quoteId, registrationData, selectedPayment, contractId, pcs, pricing.total]);

  const scrollToTop = () => {
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleContinue = () => {
    setCurrentStep("registration");
    scrollToTop();
  };

  const handleRegistrationComplete = async (data: RegistrationData) => {
    setRegistrationLoading(true);
    try {
      const fullAddress = [data.endereco, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");

      const { data: leadRow, error: leadErr } = await supabase
        .from("budget_leads" as any)
        .insert({
          company_name: data.razaoSocial,
          contact_name: data.responsavel,
          email: data.email,
          phone: data.telefone || null,
          city: data.cidade || null,
          observations: `Reestruturação de Rede — ${pcs} PCs${includeServer ? " + Servidor" : ""} — R$ ${pricing.total.toFixed(2)}`,
        } as any)
        .select()
        .single();

      if (leadErr) throw leadErr;

      const { data: quoteRow, error: quoteErr } = await supabase
        .from("quotes" as any)
        .insert({
          lead_id: (leadRow as any).id,
          selected_plan: "reestruturacao-premium",
          monthly_value: pricing.total,
          computers_qty: pcs,
          status: "pending",
        } as any)
        .select()
        .single();

      if (quoteErr) throw quoteErr;
      setQuoteId((quoteRow as any).id);

      const { data: customerRow, error: custErr } = await supabase
        .from("customers" as any)
        .insert({
          razao_social: data.razaoSocial,
          nome_fantasia: data.nomeFantasia || null,
          cnpj_ou_cpf: data.cnpjOuCpf,
          responsavel: data.responsavel,
          email: data.email,
          telefone: data.telefone || null,
          endereco: fullAddress,
          cidade: `${data.cidade}/${data.uf}`,
          cep: data.cep,
        } as any)
        .select()
        .single();

      if (custErr) throw custErr;
      setCustomerId((customerRow as any).id);
      setRegistrationData(data);

      const customerDataForContract: CustomerData = {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpjOuCpf: data.cnpjOuCpf,
        responsavel: data.responsavel,
        email: data.email,
        telefone: data.telefone,
        endereco: fullAddress,
        cidade: `${data.cidade}/${data.uf}`,
        cep: data.cep,
      };

      const html = generateRestructuringContractHtml(customerDataForContract, pcs, includeServer, pricing);

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(html));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: contractRow, error: contractErr } = await supabase
        .from("contracts" as any)
        .insert({
          quote_id: (quoteRow as any).id,
          customer_id: (customerRow as any).id,
          contract_type: "reestruturacao-premium",
          contract_text: html,
          monthly_value: pricing.total,
          contract_hash: contractHash,
          status: "draft",
          signed: false,
          accepted_minimum_term: false,
        } as any)
        .select()
        .single();

      if (contractErr) throw contractErr;
      setContractId((contractRow as any).id);

      await supabase.from("payments" as any).insert({
        quote_id: (quoteRow as any).id,
        payment_status: "pending",
      } as any);

      setCurrentStep("contract");
      scrollToTop();
    } catch (err) {
      console.error("[WMTi] Erro no cadastro:", err);
       toast({ title: t("errors.erroSalvar"), description: t("errors.tenteNovamente"), variant: "destructive" });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleOpenContract = () => {
    if (!contractId) return;
    window.open(`/contrato?id=${contractId}`, "_blank");
  };

  const handlePayment = async () => {
    if (!selectedPayment || !registrationData || !quoteId) return;
    setPaymentLoading(true);
    setPaymentError(null);

    const description = `Reestruturação Completa de Rede — ${pcs} PCs${includeServer ? " + Servidor" : ""}`;

    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: {
          customer_name: registrationData.razaoSocial,
          customer_email: registrationData.email,
          customer_cpf_cnpj: registrationData.cnpjOuCpf,
          billing_type: selectedPayment,
          value: pricing.total,
          description,
          quote_id: quoteId,
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar cobrança");

      const url = data?.invoiceUrl || data?.invoice_url || data?.bankSlipUrl || data?.payment?.invoiceUrl;
      if (!url) throw new Error("O sistema de pagamento não retornou um link de cobrança.");

      setInvoiceUrl(url);
      setPaymentComplete(true);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[WMTi][payment]", message);
      setPaymentError(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const getStepStatus = (step: FlowStep) => {
    const order: FlowStep[] = ["calculator", "registration", "contract", "payment"];
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(step);
    if (stepIdx < currentIdx) return "completed" as const;
    if (stepIdx === currentIdx) return "active" as const;
    return "pending" as const;
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Reestruturação Completa De Rede Corporativa",
    provider: { "@type": "Organization", name: "WMTi Tecnologia da Informação" },
    description: "Pacote premium sem limite de horas para reestruturação completa de rede corporativa.",
    areaServed: { "@type": "Country", name: "BR" },
  };

  return (
    <>
      <SeoHead
        title={t("restructuring.seoTitle")}
        description={t("restructuring.seoDescription")}
        canonical="/reestruturacao-completa-de-rede-corporativa"
      />
      <JsonLd data={jsonLd} />
      <Navbar />

      <main className="min-h-screen bg-background pt-16">
        {/* Hero */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[140px]" />
          </div>
          <div className="container relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t("restructuring.tag")}</p>
              <h1 className="text-3xl md:text-5xl lg:text-6xl max-w-4xl mb-6">
                {t("restructuring.titlePrefix")} <span className="text-primary">{t("restructuring.titleHighlight")}</span>
              </h1>
              <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">
                {t("restructuring.heroDescription")}
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    document.getElementById("wizard-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  {t("restructuring.calculateInvestment")} <Calculator size={16} />
                </button>
                <button
                  onClick={() => openWhatsApp({ pageTitle: "Reestruturação de Rede Corporativa", intent: "specialist" })}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground font-mono text-sm uppercase tracking-wider hover:bg-muted transition-colors"
                >
                   {t("restructuring.talkSpecialist")}
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Diferencial */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
                <Star size={16} className="text-primary" />
                 <span className="font-mono text-xs uppercase tracking-wider text-primary">{t("restructuring.differentialTag")}</span>
              </div>
              <h2 className="text-2xl md:text-4xl mb-4">
                 {t("restructuring.differentialTitlePrefix")} <span className="text-primary">{t("restructuring.differentialTitleHighlight")}</span>
              </h2>
              <p className="font-body text-lg text-muted-foreground leading-relaxed">
                 {t("restructuring.differentialDescriptionPrefix")} <strong className="text-foreground">{t("restructuring.differentialDescriptionHighlight")}</strong> {t("restructuring.differentialDescriptionSuffix")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* O que entregamos */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container">
             <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t("restructuring.deliverablesTag")}</p>
             <h2 className="text-2xl md:text-4xl mb-12">{t("restructuring.deliverablesTitle")}</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
               {localizedDeliverables.map((block, i) => {
                const Icon = block.icon;
                return (
                  <motion.div
                    key={block.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="bg-background p-6 md:p-8"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon size={20} className="text-primary" strokeWidth={1.5} />
                      <h3 className="text-base md:text-lg font-heading">{block.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {block.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
                          <span className="font-body text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════ WIZARD: Calculator → Registration → Contract → Payment ═══════════ */}
        <section id="wizard-section" className="py-16 md:py-24 border-t border-border" ref={wizardRef}>
          <div className="container max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
                 {t("restructuring.calculatorBadge")}
              </span>
              <h2 className="text-2xl md:text-4xl mb-3">
                 {t("restructuring.calculatorTitlePrefix")} <span className="text-primary">{t("restructuring.calculatorTitleHighlight")}</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                 {t("restructuring.calculatorDescription")}
              </p>
            </motion.div>

            {/* Step 1: Calculator */}
             <WizardStepWrapper stepNumber={1} title={t("restructuring.step1Title")} subtitle={t("restructuring.step1Subtitle")} status={getStepStatus("calculator")}>
              <div className="space-y-6">
                {/* PC quantity */}
                <div className="bg-secondary p-8">
                   <p className="font-mono text-xs text-muted-foreground mb-4 text-center">{t("restructuring.computerQuantity")}</p>
                  <div className="flex items-center justify-center gap-6 mb-6">
                    <button onClick={() => setPcs(Math.max(1, pcs - 1))} className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors" aria-label="Diminuir">
                      <Minus size={20} />
                    </button>
                    <div className="text-center">
                      <span className="text-5xl font-bold text-primary">{pcs}</span>
                       <p className="font-mono text-xs text-muted-foreground mt-1">{t("restructuring.computers", { count: pcs })}</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = pcs + 1;
                        setPcs(next);
                        if (next >= 31) setShowPremiumPopup(true);
                      }}
                      className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      aria-label="Aumentar"
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  {/* Server toggle */}
                  <div className="mb-6">
                    <button
                      onClick={() => setIncludeServer(!includeServer)}
                      className={`w-full p-4 border-2 transition-all text-left flex items-center gap-4 ${includeServer ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                    >
                      <Server size={24} className={includeServer ? "text-primary" : "text-muted-foreground"} />
                      <div className="flex-1">
                         <p className="font-semibold text-foreground">{t("restructuring.serverDeployment")}</p>
                         <p className="text-xs text-muted-foreground">{t("restructuring.serverDeploymentDesc")}</p>
                      </div>
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${includeServer ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                        {includeServer && <CheckCircle2 size={14} className="text-primary-foreground" />}
                      </div>
                    </button>
                  </div>

                  {/* Pricing breakdown */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between font-mono text-sm">
                      <span className="text-muted-foreground">{pcs} PC{pcs > 1 ? "s" : ""} × R$ {pricing.pcUnitPrice.toFixed(2).replace(".", ",")}</span>
                      <span className="text-foreground">R$ {pricing.pcTotal.toFixed(2).replace(".", ",")}</span>
                    </div>
                    {pricing.discountPct > 0 && (
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-primary">Desconto por volume ({pricing.discountPct}%)</span>
                        <span className="text-primary">-R$ {pricing.savings.toFixed(2).replace(".", ",")}</span>
                      </div>
                    )}
                    {includeServer && (
                      <div className="flex items-center justify-between font-mono text-sm">
                       <span className="text-muted-foreground">{t("restructuring.serverImplantation")}</span>
                        <span className="text-foreground">R$ {SERVER_SETUP_PRICE.toFixed(2).replace(".", ",")}</span>
                      </div>
                    )}
                    <div className="h-px bg-muted-foreground/10" />
                    <div className="flex items-center justify-between font-mono text-base font-bold">
                       <span className="text-foreground">{t("restructuring.totalInvestment")}</span>
                      <span className="text-primary text-xl">R$ {pricing.total.toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                </div>

                {/* Volume discount info */}
                <details className="bg-secondary group">
                  <summary className="p-4 cursor-pointer font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors flex justify-between items-center">
                     {t("restructuring.volumeDiscountTable")}
                    <Plus size={14} className="text-primary group-open:rotate-45 transition-transform" />
                  </summary>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-px text-xs font-mono">
                      <div className="bg-secondary p-2 text-muted-foreground/50">Qtd. PCs</div>
                      <div className="bg-secondary p-2 text-muted-foreground/50">Desconto</div>
                      <div className="bg-secondary p-2 text-muted-foreground/50">R$/PC</div>
                      {[1, 5, 10, 15, 20, 25, 30].map((n) => {
                        const d = getDiscountPct(n);
                        const price = BASE_PRICE_PER_PC * (1 - d / 100);
                        return (
                          <div key={n} className={`contents ${n === pcs ? "[&>div]:text-primary [&>div]:font-bold" : ""}`}>
                            <div className="bg-secondary/50 p-2 text-muted-foreground">{n} PC{n > 1 ? "s" : ""}</div>
                            <div className="bg-secondary/50 p-2 text-muted-foreground">{d > 0 ? `${Math.round(d * 10) / 10}%` : "—"}</div>
                            <div className="bg-secondary/50 p-2 text-muted-foreground">R$ {price.toFixed(2).replace(".", ",")}</div>
                          </div>
                        );
                      })}
                      <div className="contents">
                        <div className="bg-secondary/50 p-2 text-primary font-bold">31+</div>
                        <div className="bg-secondary/50 p-2 text-primary font-bold">Orçamento personalizado</div>
                        <div className="bg-secondary/50 p-2 text-primary font-bold">Sob consulta</div>
                      </div>
                    </div>
                  </div>
                </details>

                <div className="bg-primary/10 border border-primary/30 p-4 flex items-start gap-3">
                  <Star size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-foreground">
                     <strong>{t("restructuring.premiumNoHours")}</strong> {t("restructuring.premiumDescription")}
                  </p>
                </div>

                <button
                  onClick={handleContinue}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  <ArrowRight size={16} />
                   {t("restructuring.continueHiring")}
                </button>
                <p className="font-body text-xs text-center text-muted-foreground/60">
                   {t("restructuring.continueDescription")}
                </p>
              </div>
            </WizardStepWrapper>

            {/* Step 2: Registration */}
             <WizardStepWrapper stepNumber={2} title={t("restructuring.step2Title")} subtitle={t("restructuring.step2Subtitle")} status={getStepStatus("registration")}>
              <QuickRegistrationForm onComplete={handleRegistrationComplete} loading={registrationLoading} initialData={{}} />
            </WizardStepWrapper>

            {/* Step 3: Contract */}
             <WizardStepWrapper stepNumber={3} title={t("restructuring.step3Title")} subtitle={contractSigned ? t("restructuring.step3Signed") : t("restructuring.step3Subtitle")} status={getStepStatus("contract")}>
              {contractSigned ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                   <h4 className="text-lg font-heading font-bold">{t("restructuring.contractSigned")}</h4>
                   <p className="text-sm text-muted-foreground">{t("restructuring.proceedPayment")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-6 h-6 text-primary" />
                      <div>
                         <p className="font-semibold text-sm text-foreground">{t("restructuring.contractCardTitle")}</p>
                         <p className="text-xs text-foreground/60">{t("restructuring.contractCardDescription")}</p>
                      </div>
                    </div>
                     <p className="text-xs text-foreground/60 mb-3">{t("restructuring.contractCardHint")}</p>
                  </div>
                  <Button onClick={handleOpenContract} disabled={!contractId} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <ExternalLink className="w-4 h-4 mr-2" />
                     {t("restructuring.openContract")}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                     {t("restructuring.waitingContract")}
                  </p>
                </div>
              )}
            </WizardStepWrapper>

            {/* Step 4: Payment */}
             <WizardStepWrapper stepNumber={4} title={paymentConfirmed ? t("restructuring.purchaseCompleted") : t("restructuring.payment")} subtitle={paymentConfirmed ? t("restructuring.paymentConfirmed") : t("restructuring.paymentSubtitle")} status={paymentConfirmed ? "completed" : getStepStatus("payment")} isLast>
              {paymentConfirmed ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                   <h4 className="text-lg font-heading font-bold">{t("restructuring.paymentConfirmed")}</h4>
                   <p className="text-sm text-muted-foreground">{t("restructuring.redirectingConfirmation")}</p>
                  <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                </div>
              ) : paymentLoading ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-4">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                     <h4 className="text-lg font-heading font-bold">{t("restructuring.connectingCheckout")}</h4>
                     <p className="text-sm text-muted-foreground">{t("restructuring.doNotClose")}</p>
                  </div>
                </div>
              ) : paymentComplete && invoiceUrl ? (
                <div className="bg-card border border-primary/20 rounded-xl p-6 space-y-4">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                     <h4 className="text-lg font-heading font-bold">{t("restructuring.waitingPayment")}</h4>
                     <p className="text-sm text-muted-foreground">{t("restructuring.securePageOpened")}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => window.open(invoiceUrl, "_blank", "noopener,noreferrer")} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <ExternalLink className="w-4 h-4 mr-2" />
                       {t("restructuring.openCheckoutAgain")}
                    </Button>
                  </div>
                  <div className="text-center mt-4 space-y-2">
                     <p className="font-mono text-sm font-bold text-primary">{t("restructuring.purchaseSummary")}</p>
                     <p className="text-sm text-muted-foreground">{t("restructuring.serviceSummary")}: <strong className="text-foreground">{t("restructuring.titleHighlight")}</strong></p>
                     <p className="text-sm text-muted-foreground">{t("restructuring.computersSummary")}: <strong className="text-foreground">{pcs}</strong></p>
                     {includeServer && <p className="text-sm text-muted-foreground">{t("restructuring.serverSummary")}: <strong className="text-foreground">{t("restructuring.included")}</strong></p>}
                     <p className="text-sm text-muted-foreground">{t("restructuring.totalSummary")}: <strong className="text-primary">R$ {pricing.total.toFixed(2).replace(".", ",")}</strong></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                     {t("restructuring.projectTotal")}: <strong className="text-primary">R$ {pricing.total.toFixed(2).replace(".", ",")}</strong> — {t("restructuring.singlePayment")}
                  </p>

                  {paymentError && (
                    <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                         <p className="text-sm font-semibold text-destructive">{t("errors.erroCobranca")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{paymentError}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {([
                       { id: "BOLETO" as BillingType, icon: FileBarChart, label: t("restructuring.paymentMethods.boleto"), desc: t("restructuring.singlePayment") },
                       { id: "CREDIT_CARD" as BillingType, icon: CreditCard, label: t("restructuring.paymentMethods.creditCard"), desc: t("restructuring.singlePayment") },
                    ]).map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPayment(method.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-center ${
                          selectedPayment === method.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                        }`}
                      >
                       <method.icon className={`w-6 h-6 mx-auto mb-2 ${selectedPayment === method.id ? "text-primary" : "text-muted-foreground"}`} />
                        <p className="text-sm font-semibold text-foreground">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.desc}</p>
                      </button>
                    ))}
                  </div>

                  <Button onClick={handlePayment} disabled={!selectedPayment || paymentLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">
                    <ExternalLink className="w-5 h-5 mr-2" />
                     {paymentError ? t("restructuring.tryAgain") : t("restructuring.proceedPaymentUpper")}
                  </Button>
                </div>
              )}
            </WizardStepWrapper>
          </div>
        </section>

        {/* Resultado final */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
               <h2 className="text-2xl md:text-4xl mb-4">{t("restructuring.finalTitlePrefix")} <span className="text-primary">{t("restructuring.finalTitleHighlight")}</span></h2>
              <p className="font-body text-base text-muted-foreground mb-8">
                 {t("restructuring.finalDescription")}
              </p>
              <button
                onClick={() => openWhatsApp({ pageTitle: "Reestruturação de Rede Corporativa", intent: "proposal" })}
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              >
                 {t("restructuring.talkSpecialist")} <ArrowRight size={16} />
              </button>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Premium popup for 31+ PCs */}
      {showPremiumPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-primary/30 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-primary/10 text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Star size={32} className="text-primary" />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground">
               {t("restructuring.premiumTitlePrefix")} <span className="text-primary">{t("restructuring.premiumTitleHighlight")}</span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
               {t("restructuring.premiumDescription", { count: pcs })}
            </p>
            <a
              href={`https://wa.me/5511963166915?text=${encodeURIComponent(`Olá! Preciso de um orçamento premium para Reestruturação Completa de Rede Corporativa com ${pcs} computadores${includeServer ? " + implantação de servidor" : ""}. Aguardo proposta personalizada.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded-lg"
            >
              <ArrowRight size={16} />
               {t("restructuring.requestPremiumQuote")}
            </a>
            <button
              onClick={() => { setShowPremiumPopup(false); setPcs(30); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
               {t("restructuring.backToCalculator")}
            </button>
          </motion.div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default ReestruturacaoRedePage;
