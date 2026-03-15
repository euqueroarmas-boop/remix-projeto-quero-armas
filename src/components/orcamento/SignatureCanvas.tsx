import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { PenTool, RotateCcw, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  visible: boolean;
  onSign: (signatureData: string, signerName: string) => Promise<void>;
  signed: boolean;
}

const SignatureCanvas = ({ visible, onSign, signed }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [loading, setLoading] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  useEffect(() => {
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
    ctx.strokeStyle = "#1a1a2e";
  }, [visible]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = getCtx();
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

  const handleSign = async () => {
    if (!canvasRef.current || !hasDrawn || !signerName.trim()) return;
    setLoading(true);
    try {
      const signatureData = canvasRef.current.toDataURL("image/png");
      await onSign(signatureData, signerName.trim());
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  if (signed) {
    return (
      <section id="signature-section" className="py-16 bg-card">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-background border border-primary/20 rounded-2xl p-8">
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-heading font-bold mb-2">Contrato assinado!</h3>
            <p className="text-muted-foreground text-sm">
              Sua assinatura digital foi registrada com sucesso.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="signature-section" className="py-20 section-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Assinatura Digital
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            Assine o <span className="text-primary">contrato</span>
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <Label className="mb-1.5 block text-sm">Nome completo do assinante *</Label>
            <Input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="h-12 bg-card border-border"
              placeholder="Nome completo"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm">Desenhe sua assinatura abaixo</Label>
            <div className="relative border-2 border-dashed border-border rounded-xl bg-background overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full cursor-crosshair touch-none"
                style={{ height: 180 }}
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
                  <p className="text-muted-foreground/40 text-sm flex items-center gap-2">
                    <PenTool className="w-4 h-4" /> Desenhe sua assinatura aqui
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                className="text-muted-foreground"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Limpar
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSign}
            disabled={!hasDrawn || !signerName.trim() || loading}
            className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <PenTool className="w-5 h-5 mr-2" />
            )}
            Assinar contrato digitalmente
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Ao assinar, você concorda com os termos do contrato. Sua assinatura, IP e data serão registrados para segurança jurídica.
          </p>
        </div>
      </div>
    </section>
  );
};

export default SignatureCanvas;
