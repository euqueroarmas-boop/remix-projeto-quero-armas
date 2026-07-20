/**
 * /mockups-alertas-emails
 *
 * Tela de APROVAÇÃO VISUAL dos 16 novos templates de alerta do
 * Arsenal Inteligente (filiação, habitualidade, autorização, CRAF, GTE,
 * exigência PF, munição, acervo, renovação CR).
 *
 * NÃO dispara e-mails. NÃO conecta triggers. É apenas grade de mockups
 * reproduzindo fielmente o layout do React Email `_status_shell.tsx`
 * (fundo branco, linha superior colorida, badge, título condensado,
 * texto operacional, bloco de metadados, CTA na cor do status).
 */

type Status = "critico" | "alerta" | "ok";

const CORES: Record<Status, { cor: string; label: string; fg: string }> = {
  critico: { cor: "#8A1828", label: "VENCIDO / CRÍTICO", fg: "#ffffff" },
  alerta: { cor: "#D9A21B", label: "ALERTA", fg: "#1a1a1a" },
  ok: { cor: "#1F8A4C", label: "OK / CONFORME", fg: "#ffffff" },
};

interface Meta { label: string; valor: string }
interface MockTemplate {
  key: string;
  status: Status;
  assunto: string;
  titulo: string;
  texto: string;
  cta: string;
  meta: Meta[];
  motor: string; // motor do sistema que deve disparar este alerta
}

const TEMPLATES: MockTemplate[] = [
  {
    key: "filiacao-vencida",
    status: "critico",
    assunto: "Filiação vencida no Arsenal Inteligente",
    titulo: "Sua filiação precisa ser regularizada",
    texto:
      "Sua filiação está vencida e pode impedir o andamento de processos vinculados ao seu CR. Regularize o vínculo com o clube e envie o comprovante atualizado pelo Arsenal Inteligente.",
    cta: "REGULARIZAR FILIAÇÃO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Clube", valor: "Clube de Tiro Exemplo" },
      { label: "Vencimento", valor: "10/06/2026" },
      { label: "Status", valor: "VENCIDA" },
    ],
    motor: "Motor de filiação (qa-vencimentos-alertas · ClienteResumoKanban banners)",
  },
  {
    key: "filiacao-vencimento",
    status: "alerta",
    assunto: "Sua filiação vence em breve",
    titulo: "Sua filiação vence em 20 dias",
    texto:
      "Sua filiação está próxima do vencimento. Antecipe a renovação para manter o processo e o acervo em conformidade.",
    cta: "VER FILIAÇÃO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Clube", valor: "Clube de Tiro Exemplo" },
      { label: "Vencimento", valor: "15/08/2026" },
      { label: "Dias restantes", valor: "20" },
    ],
    motor: "Motor de filiação (qa-vencimentos-alertas — janela de 30/15/7 dias)",
  },
  {
    key: "habitualidade-insuficiente",
    status: "alerta",
    assunto: "Habitualidade insuficiente identificada",
    titulo: "Faltam comprovações de habitualidade",
    texto:
      "O Arsenal identificou que a habitualidade registrada ainda não atende ao mínimo necessário para o período analisado. Envie novos comprovantes ou revise os lançamentos disponíveis.",
    cta: "CORRIGIR HABITUALIDADE",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Período", valor: "01/01/2026 a 31/12/2026" },
      { label: "Comprovados", valor: "6" },
      { label: "Mínimo exigido", valor: "12" },
    ],
    motor:
      "Motor de habitualidade (habitualidade-classificacao-in311 · qa-vencimentos-alertas)",
  },
  {
    key: "habitualidade-prazo-critico",
    status: "alerta",
    assunto: "Prazo crítico de habitualidade",
    titulo: "Habitualidade perto do fechamento",
    texto:
      "O período de habitualidade está próximo do fechamento. Regularize os comprovantes antes que o requisito fique comprometido.",
    cta: "VER PRAZO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Período", valor: "01/01/2026 a 31/12/2026" },
      { label: "Fechamento", valor: "31/12/2026" },
    ],
    motor: "Motor de habitualidade (etapas-prazos-engine)",
  },
  {
    key: "autorizacao-compra-vencimento",
    status: "alerta",
    assunto: "Autorização de compra vence em breve",
    titulo: "Sua autorização de compra está perto do vencimento",
    texto:
      "A autorização de compra vinculada ao seu processo vence em breve. Conclua a etapa ou solicite orientação antes do prazo final.",
    cta: "VER AUTORIZAÇÃO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Autorização", valor: "AC-2026-0091" },
      { label: "Vencimento", valor: "30/08/2026" },
    ],
    motor: "Motor de autorização (qa-vencimentos-alertas · prazosProcessuais)",
  },
  {
    key: "autorizacao-compra-sem-craf",
    status: "critico",
    assunto: "Compra sem CRAF vinculado",
    titulo: "Compra concluída sem CRAF no acervo",
    texto:
      "Existe autorização ou compra registrada sem CRAF correspondente anexado ao Arsenal. O ciclo documental precisa ser concluído para manter o acervo organizado.",
    cta: "ANEXAR CRAF",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Autorização", valor: "AC-2026-0091" },
      { label: "Status", valor: "CRAF PENDENTE" },
    ],
    motor: "Motor de acervo (integridade-venda-processo · Central de Documentos)",
  },
  {
    key: "craf-inconsistente",
    status: "critico",
    assunto: "CRAF inconsistente com o acervo",
    titulo: "Dados do CRAF divergem do cadastro da arma",
    texto:
      "O CRAF anexado possui divergência em relação ao acervo cadastrado, como calibre, número de série, finalidade ou titular. Revise os dados antes de usar o documento em processos.",
    cta: "REVISAR CRAF",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Arma", valor: "Pistola 9mm — SN ABC12345" },
      { label: "Divergência", valor: "Calibre divergente do cadastro" },
    ],
    motor: "Motor de acervo (qa-classificar-documento-arma · divergenciasUtils)",
  },
  {
    key: "arma-sem-craf",
    status: "critico",
    assunto: "Arma cadastrada sem CRAF",
    titulo: "Existe arma sem CRAF vinculado",
    texto:
      "Uma arma foi identificada no acervo sem o respectivo CRAF anexado. Envie o documento para que o Arsenal possa validar o vínculo.",
    cta: "ANEXAR DOCUMENTO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Arma", valor: "Carabina .22 — SN XYZ99887" },
    ],
    motor: "Motor de acervo (documentosDeArma · Motor de Pendências)",
  },
  {
    key: "gte-inconsistente",
    status: "alerta",
    assunto: "GTE precisa de revisão",
    titulo: "Trajeto ou finalidade da GTE precisam revisão",
    texto:
      "A GTE anexada possui dados que precisam ser conferidos, como origem, destino, data, finalidade ou vínculo com evento.",
    cta: "REVISAR GTE",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "GTE", valor: "GTE-2026-0044" },
      { label: "Origem", valor: "São José dos Campos/SP" },
      { label: "Destino", valor: "Jacareí/SP" },
      { label: "Data", valor: "05/08/2026" },
    ],
    motor: "Motor de GTE (qa-notify-event · gte-alerta-cliente/equipe)",
  },
  {
    key: "exigencia-pf-prazo",
    status: "alerta",
    assunto: "Exigência PF com prazo em andamento",
    titulo: "Existe exigência da PF para responder",
    texto:
      "Seu processo recebeu uma exigência com prazo em andamento. A resposta deve ser preparada e enviada antes do vencimento.",
    cta: "RESPONDER EXIGÊNCIA",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Processo", valor: "Concessão de CR" },
      { label: "Prazo final", valor: "12/08/2026" },
      { label: "Dias restantes", valor: "8" },
    ],
    motor: "Motor de prazos processuais (prazosProcessuais · qa-notify-event)",
  },
  {
    key: "exigencia-pf-vencida",
    status: "critico",
    assunto: "Prazo de exigência PF vencido",
    titulo: "O prazo da exigência expirou",
    texto:
      "O prazo para resposta da exigência venceu. O processo exige análise imediata para definir a próxima medida.",
    cta: "AÇÃO URGENTE",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Processo", valor: "Concessão de CR" },
      { label: "Venceu em", valor: "20/07/2026" },
    ],
    motor: "Motor de prazos processuais (prazosEquipe · escalation)",
  },
  {
    key: "documento-incompativel-processo",
    status: "alerta",
    assunto: "Documento incompatível com o processo",
    titulo: "Este documento não atende à exigência atual",
    texto:
      "O documento enviado foi identificado, mas não atende ao processo ou à exigência selecionada. Substitua o arquivo ou revise o tipo documental.",
    cta: "SUBSTITUIR DOCUMENTO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Documento enviado", valor: "Certidão de execuções criminais" },
      { label: "Exigência", valor: "Certidão de ações criminais" },
    ],
    motor: "Motor de validação documental (qa-processo-doc-validar-ia)",
  },
  {
    key: "risco-janela-renovacao-cr",
    status: "critico",
    assunto: "Janela de renovação do CR em risco",
    titulo: "Seu prazo de renovação exige prioridade",
    texto:
      "O Arsenal identificou risco na janela de renovação do CR. A demora pode transformar a renovação em novo processo de concessão.",
    cta: "PRIORIZAR RENOVAÇÃO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "CR", valor: "CR 000.000" },
      { label: "Vencimento", valor: "05/09/2026" },
    ],
    motor: "Motor de vencimentos CR (qa-vencimentos-alertas · janela 90/60/30 dias)",
  },
  {
    key: "municao-limite-alerta",
    status: "alerta",
    assunto: "Controle de munição exige atenção",
    titulo: "Consumo próximo do limite",
    texto:
      "O controle de munição ou insumos está próximo do limite ou apresenta inconsistência com o acervo cadastrado. Revise o consumo antes de novas movimentações.",
    cta: "VER CONTROLE",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Calibre", valor: "9mm" },
      { label: "Consumido", valor: "850" },
      { label: "Limite", valor: "1000" },
    ],
    motor: "Motor de munição (municaoValidade · controle de consumo)",
  },
  {
    key: "acervo-inconsistente",
    status: "critico",
    assunto: "Inconsistência no acervo",
    titulo: "Dados do acervo precisam revisão",
    texto:
      "O Arsenal encontrou divergências entre arma, CRAF, autorização, finalidade ou documentos vinculados. Revise os dados para evitar uso incorreto em processos.",
    cta: "REVISAR ACERVO",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Item", valor: "Pistola 9mm — SN ABC12345" },
      { label: "Divergência", valor: "Finalidade divergente do CRAF" },
    ],
    motor: "Motor de acervo (integridade-venda-processo · divergenciasUtils)",
  },
  {
    key: "acervo-conforme",
    status: "ok",
    assunto: "Acervo em conformidade",
    titulo: "Dados do acervo regularizados",
    texto:
      "Os dados analisados estão consistentes com os documentos anexados e com o processo em andamento.",
    cta: "ABRIR ARSENAL",
    meta: [
      { label: "Cliente", valor: "CAC" },
      { label: "Item", valor: "Pistola 9mm — SN ABC12345" },
    ],
    motor: "Confirmação após reconciliação do motor de acervo",
  },
];

function EmailPreview({ t }: { t: MockTemplate }) {
  const c = CORES[t.status];
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e6e3dc", borderRadius: 6, overflow: "hidden", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ background: c.cor, height: 4 }} />
      <div style={{ padding: "22px 26px 20px" }}>
        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <span style={{ display: "inline-block", padding: "4px 10px", background: c.cor, color: c.fg, fontSize: 10, fontWeight: "bold", letterSpacing: "0.14em", borderRadius: 3 }}>{c.label}</span>
        </div>
        <p style={{ fontSize: 11, letterSpacing: "0.24em", color: "#0a0a0a", fontWeight: "bold", margin: "0 0 12px" }}>ARSENAL INTELIGENTE · QUERO ARMAS</p>
        <h3 style={{ fontFamily: "Oswald, Arial Narrow, sans-serif", fontSize: 20, lineHeight: 1.25, fontWeight: 700, color: "#0a0a0a", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "-0.01em" }}>{t.titulo}</h3>
        <p style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.6, margin: "0 0 16px" }}>{t.texto}</p>
        <div style={{ background: "#f7f6f2", padding: "12px 14px", borderRadius: 4, marginBottom: 18 }}>
          {t.meta.map((m, i) => (
            <p key={i} style={{ fontSize: 12, margin: "3px 0", lineHeight: 1.5, color: "#1a1a1a" }}>
              <span style={{ color: "#666", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}: </span>
              {m.valor}
            </p>
          ))}
        </div>
        <div style={{ textAlign: "center", margin: "10px 0 6px" }}>
          <span style={{ display: "inline-block", background: c.cor, color: c.fg, fontSize: 13, fontWeight: "bold", letterSpacing: "0.08em", borderRadius: 4, padding: "12px 22px", textTransform: "uppercase" }}>{t.cta}</span>
        </div>
        <hr style={{ border: "none", borderTop: "1px solid #e6e3dc", margin: "20px 0 10px" }} />
        <p style={{ fontSize: 11, color: "#888", margin: 0, textAlign: "center" }}>Arsenal Inteligente — monitoramento contínuo do seu acervo e processos.</p>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: Status }) {
  const c = CORES[status];
  return (
    <span style={{ display: "inline-block", padding: "3px 8px", background: c.cor, color: c.fg, fontSize: 10, fontWeight: "bold", letterSpacing: "0.14em", borderRadius: 3 }}>
      {c.label}
    </span>
  );
}

export default function MockupsAlertasEmails() {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", padding: "32px 20px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.22em", color: "#7A1F2B", fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase" }}>
          // MOCKUP DE APROVAÇÃO · NÃO ENVIA E-MAILS
        </p>
        <h1 style={{ fontFamily: "Oswald, Arial Narrow, sans-serif", fontSize: 32, margin: "0 0 6px", color: "#0a0a0a", fontWeight: 700, letterSpacing: "-0.01em" }}>
          Alertas operacionais · Arsenal Inteligente
        </h1>
        <p style={{ fontSize: 14, color: "#333", margin: "0 0 20px", maxWidth: 720, lineHeight: 1.5 }}>
          16 novas variações de alerta por e-mail (filiação, habitualidade, autorização, CRAF, GTE, exigências PF, munição, acervo e renovação de CR).
          Templates registrados no motor Lovable Emails, prontos para preview via <code>preview-transactional-email</code>.
          Nenhum trigger automático foi ativado — esta tela é apenas para revisão de copy, layout e cor de status.
        </p>
        <div style={{ display: "flex", gap: 8, margin: "0 0 28px", flexWrap: "wrap" }}>
          <StatusChip status="critico" />
          <StatusChip status="alerta" />
          <StatusChip status="ok" />
          <span style={{ fontSize: 12, color: "#555" }}>· Cores fixas por severidade — sem promocional, sem emoji, sem imagem.</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 20 }}>
          {TEMPLATES.map((t) => (
            <div key={t.key} style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "monospace" }}>{t.key}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#0a0a0a", fontWeight: 600 }}>{t.assunto}</p>
                </div>
                <StatusChip status={t.status} />
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 11, color: "#7A1F2B", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Motor: <span style={{ color: "#333", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>{t.motor}</span>
              </p>
              <EmailPreview t={t} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, padding: 20, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8 }}>
          <h2 style={{ fontFamily: "Oswald, Arial Narrow, sans-serif", fontSize: 20, margin: "0 0 10px", color: "#0a0a0a", textTransform: "uppercase" }}>
            Amarração aos motores existentes
          </h2>
          <p style={{ fontSize: 13, color: "#333", margin: "0 0 8px", lineHeight: 1.55 }}>
            Após aprovação da copy e do visual, cada template será chamado exclusivamente pelo motor responsável — nada de novo motor de e-mail.
            Os disparos continuarão passando por <code>send-transactional-email</code> (fila pgmq, suppression, retries e logs já existentes).
          </p>
          <ul style={{ fontSize: 13, color: "#333", lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
            <li><b>Filiação</b> → <code>qa-vencimentos-alertas</code> · banners de filiação no <code>ClienteResumoKanban</code>.</li>
            <li><b>Habitualidade</b> → <code>habitualidade-classificacao-in311</code> · <code>etapas-prazos-engine</code>.</li>
            <li><b>Autorização de compra & CRAF</b> → <code>integridade-venda-processo</code> · Central de Documentos.</li>
            <li><b>GTE</b> → <code>qa-notify-event</code> (mesmo motor de <code>gte-alerta-cliente</code>).</li>
            <li><b>Exigência PF</b> → <code>prazosProcessuais</code> / <code>prazosEquipe</code>.</li>
            <li><b>Renovação de CR</b> → <code>qa-vencimentos-alertas</code> (janela 90 / 60 / 30 dias).</li>
            <li><b>Munição</b> → <code>municaoValidade</code> + controle de consumo.</li>
            <li><b>Acervo</b> → <code>divergenciasUtils</code> / <code>qa-classificar-documento-arma</code>.</li>
          </ul>
          <p style={{ fontSize: 12, color: "#7A1F2B", margin: "14px 0 0", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Aguardando aprovação para conectar os triggers. Nenhum envio ocorrerá até liberação explícita.
          </p>
        </div>
      </div>
    </div>
  );
}