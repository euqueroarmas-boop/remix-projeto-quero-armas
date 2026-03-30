import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PenTool, RotateCcw, CheckCircle } from "lucide-react";

const ContratoPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const contractId = searchParams.get("id");

  const [contractHtml, setContractHtml] = useState("");
  const [contractType, setContractType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [acceptedTerm, setAcceptedTerm] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  // Signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signingLoading, setSigningLoading] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!contractId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("contracts" as any)
        .select("contract_text, signed, status, contract_type")
        .eq("id", contractId)
        .single();

      if (data) {
        const row = data as any;
        setContractHtml(row.contract_text || "");
        setContractType(row.contract_type || null);
        if (row.signed) setSigned(true);
      }
      setLoading(false);
    };
    load();
  }, [contractId]);

  // Canvas setup
  useEffect(() => {
    if (!showSignature) return;
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
    }, 100);
  }, [showSignature]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Only locacao and suporte contracts require the 36-month term acceptance
  const requiresMinimumTerm = contractType === "locacao" || contractType === "suporte";

  const handleProceedToSignature = () => {
    if (!agreed || (requiresMinimumTerm && !acceptedTerm)) return;
    setShowSignature(true);
    setTimeout(() => {
      document.getElementById("signature-section")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const handleSign = useCallback(async () => {
    if (!canvasRef.current || !hasDrawn || !signerName.trim() || !contractId) return;
    setSigningLoading(true);

    try {
      const signatureData = canvasRef.current.toDataURL("image/png");

      let clientIp = "Não capturado";
      try {
        const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
        const d = await res.json();
        clientIp = d.ip || "Não capturado";
      } catch {}

      const userAgent = navigator.userAgent || "Não capturado";
      const signedAt = new Date();
      const signDate = signedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const signTime = signedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const { data: contractRow } = await supabase
        .from("contracts" as any)
        .select("contract_hash, contract_text")
        .eq("id", contractId)
        .single();

      const contractHash = (contractRow as any)?.contract_hash || "";
      let currentHtml = (contractRow as any)?.contract_text || "";

      // Inject real traceability data into contract HTML placeholders
      currentHtml = currentHtml
        .replace(/\{\{SIGN_IP\}\}/g, clientIp)
        .replace(/\{\{SIGN_DATE\}\}/g, signDate)
        .replace(/\{\{SIGN_TIME\}\}/g, signTime)
        .replace(/\{\{SIGN_USER_AGENT\}\}/g, userAgent);

      await supabase.from("contract_signatures" as any).insert({
        contract_id: contractId,
        signer_name: signerName.trim(),
        signature_data: signatureData,
        ip_address: clientIp,
        user_agent: userAgent,
        contract_hash: contractHash,
      } as any);

      await supabase
        .from("contracts" as any)
        .update({
          signed: true,
          signed_at: signedAt.toISOString(),
          client_ip: clientIp,
          status: "AGUARDANDO PAGAMENTO",
          accepted_minimum_term: true,
          contract_text: currentHtml,
        } as any)
        .eq("id", contractId);

      // Log
      await supabase.from("integration_logs" as any).insert({
        integration_name: "contract",
        operation_name: "contract_signed",
        request_payload: {
          contract_id: contractId,
          signer_name: signerName,
          ip: clientIp,
          date: signDate,
          time: signTime,
          user_agent: userAgent,
        },
        status: "success",
      } as any);

      setSigned(true);

      // Return to budget page after 2s
      setTimeout(() => {
        // Navigate back — the wizard will detect signature and proceed to payment
        window.close();
        // Fallback if window.close doesn't work (e.g. not opened as popup)
        navigate(`/orcamento-ti?contract_signed=${contractId}`);
      }, 2000);
    } catch (err) {
      console.error("[ContratoPage] Erro na assinatura:", err);
    } finally {
      setSigningLoading(false);
    }
  }, [contractId, hasDrawn, signerName, navigate]);

  if (!contractId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-black">Contrato não encontrado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
          <h2 className="text-2xl font-bold text-black">Contrato assinado com sucesso!</h2>
          <p className="text-gray-600">Retornando ao fluxo de pagamento...</p>
          <Loader2 className="w-5 h-5 animate-spin text-gray-600 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* A4-style contract page */}
      <div className="max-w-[210mm] mx-auto py-8 px-8 md:px-16" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <div
          className="leading-relaxed"
          style={{ fontSize: "12pt", textAlign: "justify", color: "#000" }}
          dangerouslySetInnerHTML={{ __html: contractHtml }}
        />
        <style>{`
          .max-w-\\[210mm\\] h1, .max-w-\\[210mm\\] h2, .max-w-\\[210mm\\] h3,
          .max-w-\\[210mm\\] h4, .max-w-\\[210mm\\] h5, .max-w-\\[210mm\\] h6,
          .max-w-\\[210mm\\] p, .max-w-\\[210mm\\] td, .max-w-\\[210mm\\] th,
          .max-w-\\[210mm\\] span, .max-w-\\[210mm\\] li, .max-w-\\[210mm\\] strong {
            color: #000 !important;
          }
        `}</style>

        {/* Agreement section */}
        <div className="mt-12 pt-8 border-t border-gray-300 space-y-4">
          {requiresMinimumTerm && (
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={acceptedTerm}
                onCheckedChange={(v) => setAcceptedTerm(v === true)}
                className="mt-0.5 border-gray-400"
              />
              <span className="text-black text-sm" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                Declaro estar ciente de que a contratação da WMTi possui <strong>prazo mínimo de 36 (trinta e seis) meses</strong>.
              </span>
            </label>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5 border-gray-400"
            />
            <span className="text-black text-sm" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              Li e concordo com todos os termos e condições do presente contrato e desejo prosseguir com a assinatura digital.
            </span>
          </label>

          {!showSignature && (
            <Button
              onClick={handleProceedToSignature}
              disabled={!agreed || (requiresMinimumTerm && !acceptedTerm)}
              className="w-full h-12 bg-black hover:bg-gray-800 text-white rounded-none disabled:opacity-50"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
              <PenTool className="w-4 h-4 mr-2" />
              Assinar contrato
            </Button>
          )}
        </div>

        {/* Signature section */}
        {showSignature && (
          <div id="signature-section" className="mt-8 pt-8 border-t border-gray-300 space-y-4">
            <h3 className="text-lg font-bold text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              Assinatura Digital
            </h3>

            <div>
              <Label className="mb-1.5 block text-sm text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                Nome completo do assinante *
              </Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="h-12 bg-white border-gray-400 text-black rounded-none"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-sm text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                Desenhe sua assinatura abaixo
              </Label>
              <div className="relative border-2 border-gray-400 bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair touch-none"
                  style={{ height: 160 }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-400 text-sm flex items-center gap-2">
                      <PenTool className="w-4 h-4" /> Desenhe aqui
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-gray-500 text-xs flex items-center gap-1 hover:text-black"
                >
                  <RotateCcw className="w-3 h-3" /> Limpar
                </button>
              </div>
            </div>

            <Button
              onClick={handleSign}
              disabled={!hasDrawn || !signerName.trim() || signingLoading}
              className="w-full h-12 bg-black hover:bg-gray-800 text-white rounded-none disabled:opacity-50"
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
            >
              {signingLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <PenTool className="w-4 h-4 mr-2" />
              )}
              Confirmar assinatura
            </Button>

            <p className="text-xs text-gray-500 text-center" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              Sua assinatura, IP e data serão registrados para segurança jurídica.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContratoPage;
