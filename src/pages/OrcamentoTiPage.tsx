import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SeoHead from "@/components/SeoHead";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BudgetHero from "@/components/orcamento/BudgetHero";
import PathSelector, { type CommercialPath } from "@/components/orcamento/PathSelector";
import QualificationForm, { type QualificationData } from "@/components/orcamento/QualificationForm";
import PlanSelector, { plans } from "@/components/orcamento/PlanSelector";
import SupportCalculator, { calculateSupportTotal } from "@/components/orcamento/SupportCalculator";
import Recommendation, { getRecommendation } from "@/components/orcamento/Recommendation";
import ContractingWizard from "@/components/orcamento/ContractingWizard";
import BudgetPopup from "@/components/orcamento/BudgetPopup";
import BudgetSummaryScreen from "@/components/orcamento/BudgetSummaryScreen";
import { recommendRentalAddons, recommendRentalPlan } from "@/components/orcamento/rentalRecommendation";

const OrcamentoTiPage = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [savingBudget, setSavingBudget] = useState(false);

  const [selectedPath, setSelectedPath] = useState<CommercialPath | null>(null);
  const [qualification, setQualification] = useState<QualificationData | null>(null);
  const [qualificationComplete, setQualificationComplete] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState("equilibrio");
  const [computersQty, setComputersQty] = useState(1);
  const [usersQty, setUsersQty] = useState(1);
  const [addons, setAddons] = useState({
    serverMigration: false,
    remoteAccess: false,
    backup: false,
  });

  const [budgetSaved, setBudgetSaved] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const [showBudgetPopup, setShowBudgetPopup] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const plan = plans.find((p) => p.id === selectedPlan) || plans[1];
  const rentalMonthly = plan.price * computersQty;

  const supportMonthly = useMemo(() => {
    if (!qualification) return 0;
    return calculateSupportTotal(qualification).total;
  }, [qualification]);

  const effectivePath = useMemo(() => {
    if (selectedPath === "locacao") return "locacao";
    if (selectedPath === "suporte") return "suporte";
    if (selectedPath === "ajuda" && qualification) {
      return getRecommendation(qualification);
    }
    return null;
  }, [selectedPath, qualification]);

  const monthlyValue = effectivePath === "suporte" ? supportMonthly : rentalMonthly;

  const scrollToSection = useCallback((id: string) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  const contextTitle = useMemo(() => {
    const problema = searchParams.get("problema");
    const servico = searchParams.get("servico");
    const cidade = searchParams.get("cidade");
    if (problema === "backup") return t("orcamento.ctxBackup");
    if (problema === "rede") return t("orcamento.ctxRede");
    if (problema === "servidor") return t("orcamento.ctxServidor");
    if (servico === "locacao-de-computadores") return t("orcamento.ctxLocacao");
    if (cidade) return t("orcamento.ctxCidade", { city: cidade.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) });
    return null;
  }, [searchParams]);

  const handlePathSelect = useCallback((path: CommercialPath) => {
    // Hour-based services redirect to WhatsApp
    if (path === "emergencial") {
      window.open(
        `https://wa.me/${WHATSAPP_NUMBER}?text=Ol%C3%A1!%20Preciso%20de%20suporte%20t%C3%A9cnico%20emergencial%20para%20minha%20empresa.`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    if (path === "avulso") {
      window.open(
        `https://wa.me/${WHATSAPP_NUMBER}?text=Ol%C3%A1!%20Gostaria%20de%20contratar%20um%20servi%C3%A7o%20t%C3%A9cnico%20avulso%20para%20minha%20empresa.`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    setSelectedPath(path);
    setQualification(null);
    setQualificationComplete(false);
    setBudgetSaved(false);
    setQuoteId(null);
    setShowBudgetPopup(false);
    setShowSummary(false);
    scrollToSection("qualification");
  }, [scrollToSection]);

  const handleQualificationComplete = useCallback((data: QualificationData) => {
    setQualification(data);
    setQualificationComplete(true);

    if (selectedPath === "locacao") {
      const recommendedPlan = recommendRentalPlan(data);
      const recommendedAddons = recommendRentalAddons(data);
      const quantity = data.computersQty || 1;
      const dailyUsers = data.dailyUsers || quantity;

      setSelectedPlan(recommendedPlan);
      setComputersQty(quantity);
      setUsersQty(dailyUsers);
      setAddons(recommendedAddons);
      scrollToSection("plans");
      return;
    }

    setComputersQty(data.computersQty || 1);
    setUsersQty(data.computersQty || 1);
    setAddons({
      serverMigration: false,
      remoteAccess: data.needsRemoteAccess ?? false,
      backup: data.needsBackup ?? false,
    });

    const rec = selectedPath === "ajuda" ? getRecommendation(data) : selectedPath;
    if (rec === "locacao") {
      scrollToSection("plans");
    } else {
      scrollToSection("support-calculator");
    }
  }, [scrollToSection, selectedPath]);

  const handleShowBudgetPopup = useCallback(() => {
    setShowBudgetPopup(true);
  }, []);

  const handleProceedToSummary = useCallback(() => {
    setShowBudgetPopup(false);
    setShowSummary(true);
    window.setTimeout(() => {
      document.getElementById("budget-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, []);

  const handleGoBackFromSummary = useCallback(() => {
    setShowSummary(false);
    scrollToSection(effectivePath === "locacao" ? "plans" : "qualification");
  }, [scrollToSection, effectivePath]);

  const handleSaveBudget = useCallback(async () => {
    if (budgetSaved) {
      window.setTimeout(() => {
        document.getElementById("contracting-wizard")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }

    setSavingBudget(true);

    try {
      const pathLabel = effectivePath === "locacao" ? "Locação" : "Suporte";
      const isRentalBudget = effectivePath === "locacao";

      const { data: leadRow, error: leadErr } = await supabase
        .from("budget_leads" as any)
        .insert({
          company_name: qualification?.companyName || "Preenchimento no wizard",
          contact_name: qualification?.companyName || "Solicitação de orçamento",
          email: qualification?.contactEmail || "wizard@pendente.com",
          phone: qualification?.contactPhone || null,
          city: qualification?.city ? `${qualification.city}${qualification.state ? `/${qualification.state}` : ""}` : null,
          observations: isRentalBudget
            ? `Caminho: ${pathLabel}\nSegmento: ${qualification?.segment || "não informado"}\nComputadores: ${qualification?.computersQty ?? computersQty}\nUsuários diários: ${qualification?.dailyUsers ?? usersQty}\nEquipamento: ${qualification?.equipmentType || "não informado"}\nConfiguração recomendada: ${plan.name}\nValor: R$${monthlyValue}/mês`
            : `Caminho: ${pathLabel}\nComputadores: ${qualification?.computersQty ?? computersQty}\nValor: R$${monthlyValue}/mês`,
        } as any)
        .select()
        .single();

      if (leadErr) throw leadErr;
      const lead = leadRow as any;

      const { data: quoteRow, error: quoteErr } = await supabase
        .from("quotes" as any)
        .insert({
          lead_id: lead.id,
          selected_plan: effectivePath === "locacao" ? selectedPlan : "suporte-mensal",
          computers_qty: qualification?.computersQty ?? computersQty,
          users_qty: qualification?.dailyUsers ?? usersQty,
          needs_server_migration: addons.serverMigration,
          needs_remote_access: addons.remoteAccess || qualification?.needsRemoteAccess || false,
          needs_backup: addons.backup || qualification?.needsBackup || false,
          monthly_value: monthlyValue,
          status: "pending",
        } as any)
        .select()
        .single();

      if (quoteErr) throw quoteErr;
      setQuoteId((quoteRow as any).id);

      if (qualification) {
        await supabase.from("network_diagnostics" as any).insert({
          quote_id: (quoteRow as any).id,
          computers_current: qualification.computersQty,
          average_pc_age: qualification.averageAge || null,
          maintenance_frequency: qualification.problemFrequency || (qualification.frequentMaintenance ? "frequente" : null),
          has_server: qualification.hasServer === "Sim" || (qualification.serversQty ?? 0) > 0,
          has_backup: qualification.hasAutomaticBackup === "Sim" || qualification.needsBackup || false,
        } as any);
      }

      setBudgetSaved(true);
      setShowSummary(false);

      window.setTimeout(() => {
        document.getElementById("contracting-wizard")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (err) {
      console.error("[WMTi] Erro ao salvar orçamento:", err);
      toast({
        title: t("errors.erroOrcamento"),
        description: t("errors.erroOrcamentoDesc"),
        variant: "destructive",
      });
    } finally {
      setSavingBudget(false);
    }
  }, [addons, budgetSaved, computersQty, effectivePath, monthlyValue, plan.name, qualification, selectedPlan, toast, usersQty]);

  const showRentalFlow = effectivePath === "locacao";
  const showSupportFlow = effectivePath === "suporte";

  return (
    <>
      <SeoHead
        title={t("orcamento.seoTitle")}
        description={t("orcamento.seoDesc")}
      />

      <Navbar />

      <main>
        <BudgetHero contextTitle={contextTitle} />
        <PathSelector onSelect={handlePathSelect} selected={selectedPath} />

        {selectedPath && (
          <QualificationForm
            onComplete={handleQualificationComplete}
            completed={qualificationComplete}
            data={qualification}
            path={selectedPath}
          />
        )}

        {/* Rental flow: plan selector with integrated CTA */}
        {qualificationComplete && showRentalFlow && !showSummary && !budgetSaved && (
          <PlanSelector
            selectedPlan={selectedPlan}
            onSelectPlan={(id) => setSelectedPlan(id)}
            onShowBudget={handleShowBudgetPopup}
          />
        )}

        {/* Support flow */}
        {qualificationComplete && showSupportFlow && qualification && !showSummary && !budgetSaved && (
          <>
            <SupportCalculator qualification={qualification} />
            <Recommendation
              qualification={qualification}
              chosenPath={selectedPath!}
              rentalMonthly={rentalMonthly}
              supportMonthly={supportMonthly}
            />
            <section id="budget-cta" className="py-10">
              <div className="container mx-auto px-4 text-center">
                <button
                  onClick={handleProceedToSummary}
                  className="h-14 px-10 text-base font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors inline-flex items-center gap-2"
                >
                  {t("contratar.verOrcamento")}
                </button>
              </div>
            </section>
          </>
        )}

        {/* Budget Popup (rental only) */}
        <BudgetPopup
          open={showBudgetPopup}
          onClose={() => setShowBudgetPopup(false)}
          onProceed={handleProceedToSummary}
          plan={plan}
          computersQty={qualification?.computersQty ?? computersQty}
          monthlyValue={monthlyValue}
        />

        {/* Summary screen */}
        <div id="budget-summary">
          <BudgetSummaryScreen
            visible={showSummary && !budgetSaved}
            effectivePath={effectivePath as "locacao" | "suporte" | null}
            plan={plan}
            qualification={qualification}
            computersQty={qualification?.computersQty ?? computersQty}
            monthlyValue={monthlyValue}
            onGoBack={handleGoBackFromSummary}
            onProceed={handleSaveBudget}
            loading={savingBudget}
          />
        </div>

        {/* Contracting wizard — no outsourcing offer here */}
        <ContractingWizard
          visible={budgetSaved}
          effectivePath={effectivePath as "locacao" | "suporte" | null}
          plan={plan}
          qualification={qualification}
          computersQty={qualification?.computersQty ?? computersQty}
          monthlyValue={monthlyValue}
          quoteId={quoteId}
          leadCompanyName={qualification?.companyName}
          leadEmail={qualification?.contactEmail}
          leadPhone={qualification?.contactPhone}
          leadCity={qualification?.city}
        />
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default OrcamentoTiPage;
