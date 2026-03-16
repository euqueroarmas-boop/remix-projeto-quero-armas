import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SeoHead from "@/components/SeoHead";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BudgetHero from "@/components/orcamento/BudgetHero";
import PathSelector, { type CommercialPath } from "@/components/orcamento/PathSelector";
import QualificationForm, { type QualificationData } from "@/components/orcamento/QualificationForm";
import PlanSelector, { plans } from "@/components/orcamento/PlanSelector";
import InvestmentCalculator, { type Addons } from "@/components/orcamento/InvestmentCalculator";
import SupportCalculator, { calculateSupportTotal } from "@/components/orcamento/SupportCalculator";
import Recommendation, { getRecommendation } from "@/components/orcamento/Recommendation";
import IncludedServices from "@/components/orcamento/IncludedServices";
import BudgetAuthority from "@/components/orcamento/BudgetAuthority";
import ContractingWizard from "@/components/orcamento/ContractingWizard";

const OrcamentoTiPage = () => {
  const [searchParams] = useSearchParams();

  // Path selection
  const [selectedPath, setSelectedPath] = useState<CommercialPath | null>(null);

  // Qualification
  const [qualification, setQualification] = useState<QualificationData | null>(null);
  const [qualificationComplete, setQualificationComplete] = useState(false);

  // Rental plan & calculator
  const [selectedPlan, setSelectedPlan] = useState("equilibrio");
  const [computersQty, setComputersQty] = useState(5);
  const [usersQty, setUsersQty] = useState(5);
  const [addons, setAddons] = useState<Addons>({
    serverMigration: false,
    remoteAccess: false,
    backup: false,
  });

  // Budget saved (replaces lead form)
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);

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
    if (problema === "backup") return "Descubra como resolver o backup da sua empresa";
    if (problema === "rede") return "Resolva os problemas de rede da sua empresa";
    if (problema === "servidor") return "Resolva os problemas do servidor da sua empresa";
    if (servico === "locacao-de-computadores") return "Calcule a locação de computadores para sua empresa";
    if (cidade) return `Orçamento de TI para sua empresa em ${cidade.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}`;
    return null;
  }, [searchParams]);

  const handlePathSelect = useCallback((path: CommercialPath) => {
    setSelectedPath(path);
    scrollToSection("qualification");
  }, [scrollToSection]);

  const handleQualificationComplete = useCallback((data: QualificationData) => {
    setQualification(data);
    setQualificationComplete(true);
    setComputersQty(data.computersQty || 5);
    setUsersQty(data.computersQty || 5);
    setAddons({
      serverMigration: false,
      remoteAccess: data.needsRemoteAccess,
      backup: data.needsBackup,
    });
    const rec = selectedPath === "ajuda" ? getRecommendation(data) : selectedPath;
    if (rec === "locacao") {
      scrollToSection("plans");
    } else {
      scrollToSection("support-calculator");
    }
  }, [selectedPath, scrollToSection]);

  // Save budget as quote (no redundant lead form)
  const handleSaveBudget = useCallback(async () => {
    if (budgetSaved) {
      scrollToSection("contracting-wizard");
      return;
    }

    try {
      const pathLabel = effectivePath === "locacao" ? "Locação" : "Suporte";

      // Create a budget lead with minimal data (real data comes in the wizard)
      const { data: leadRow, error: leadErr } = await supabase
        .from("budget_leads" as any)
        .insert({
          company_name: "Preenchimento no wizard",
          contact_name: "Preenchimento no wizard",
          email: "wizard@pendente.com",
          observations: `Caminho: ${pathLabel}\nComputadores: ${qualification?.computersQty ?? computersQty}\nValor: R$${monthlyValue}/mês`,
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
          users_qty: usersQty,
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
          average_pc_age: qualification.averageAge,
          maintenance_frequency: qualification.frequentMaintenance ? "frequente" : "raramente",
          has_server: qualification.serversQty > 0,
          has_backup: qualification.needsBackup,
        } as any);
      }

      setBudgetSaved(true);
      console.log("[WMTi] Orçamento salvo. Quote ID:", (quoteRow as any).id);
      scrollToSection("contracting-wizard");
    } catch (err) {
      console.error("[WMTi] Erro ao salvar orçamento:", err);
    }
  }, [budgetSaved, effectivePath, selectedPlan, computersQty, usersQty, addons, monthlyValue, qualification, scrollToSection]);

  const showRentalFlow = effectivePath === "locacao";
  const showSupportFlow = effectivePath === "suporte";

  return (
    <>
      <SeoHead
        title="Orçamento de Infraestrutura de TI | WMTi"
        description="Calcule o investimento em infraestrutura de TI para sua empresa. Locação de computadores Dell a partir de R$249/mês ou suporte mensal a partir de R$120/mês."
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
          />
        )}

        {/* RENTAL PATH */}
        {qualificationComplete && showRentalFlow && (
          <>
            <PlanSelector selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan} />
            <InvestmentCalculator
              selectedPlan={selectedPlan}
              computersQty={computersQty}
              setComputersQty={setComputersQty}
              usersQty={usersQty}
              setUsersQty={setUsersQty}
              addons={addons}
              setAddons={setAddons}
            />
            <IncludedServices />
          </>
        )}

        {/* SUPPORT PATH */}
        {qualificationComplete && showSupportFlow && qualification && (
          <SupportCalculator qualification={qualification} />
        )}

        {/* RECOMMENDATION */}
        {qualificationComplete && qualification && (
          <Recommendation
            qualification={qualification}
            chosenPath={selectedPath!}
            rentalMonthly={rentalMonthly}
            supportMonthly={supportMonthly}
          />
        )}

        {qualificationComplete && <BudgetAuthority />}

        {/* CTA: Contratar agora (replaces old lead form) */}
        {qualificationComplete && (
          <section id="budget-cta" className="py-16 bg-card">
            <div className="container mx-auto px-4 text-center">
              <div className="max-w-2xl mx-auto bg-background border border-primary/20 rounded-2xl p-8 space-y-4">
                <h3 className="text-2xl font-heading font-bold">
                  {budgetSaved ? "Orçamento salvo!" : "Orçamento pronto!"}
                </h3>
                <p className="text-muted-foreground">
                  {effectivePath === "locacao"
                    ? `${plan.name} — ${computersQty} computador${computersQty > 1 ? "es" : ""}`
                    : `Suporte mensal — ${qualification?.computersQty ?? computersQty} computador${(qualification?.computersQty ?? computersQty) > 1 ? "es" : ""}`
                  }
                </p>
                <p className="text-3xl font-bold text-primary">
                  R$ {monthlyValue.toLocaleString("pt-BR")},00<span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>
                <button
                  onClick={handleSaveBudget}
                  className="w-full h-14 text-base font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                >
                  {budgetSaved ? "Continuar contratação ↓" : "Contratar agora"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* CONTRACTING WIZARD (unified: registration + contract + signature + payment) */}
        <ContractingWizard
          visible={budgetSaved}
          effectivePath={effectivePath as "locacao" | "suporte" | null}
          plan={plan}
          qualification={qualification}
          computersQty={qualification?.computersQty ?? computersQty}
          monthlyValue={monthlyValue}
          quoteId={quoteId}
        />
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default OrcamentoTiPage;
