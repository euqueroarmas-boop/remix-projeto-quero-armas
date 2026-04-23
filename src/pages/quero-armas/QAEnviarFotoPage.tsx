import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, CheckCircle, RotateCcw, Search, Shield, Upload, AlertCircle } from "lucide-react";
import { QALogo } from "@/components/QALogo";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + "." + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6);
  return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
}

type Step = "cpf" | "selfie" | "ok";

interface FoundData {
  cadastro: { id: string; nome_completo: string; status: string; selfie_path: string | null } | null;
  cliente: { id: number; nome_completo: string; imagem: string | null } | null;
}

export default function QAEnviarFotoPage() {
  const [step, setStep] = useState<Step>("cpf");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<FoundData | null>(null);

  // Selfie capture
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selfie, setSelfie] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()); }, [stream]);

  const lookup = async () => {
    setError(null);
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11) { setError("Informe um CPF válido"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-atualizar-foto", {
        body: { action: "lookup", cpf: d },
      });
      if (error) throw error;
      if (!data?.found) {
        setError("Não encontramos um cadastro com este CPF. Faça o cadastro completo primeiro.");
        return;
      }
      setFound(data as FoundData);
      setStep("selfie");
    } catch (e: any) {
      setError(e?.message || "Erro ao consultar");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      setStream(s);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); } }, 50);
    } catch {
      setError("Não foi possível acessar a câmera. Use 'Enviar do dispositivo'.");
    }
  };

  const capture = () => {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    setSelfie(c.toDataURL("image/jpeg", 0.85));
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Arquivo deve ser uma imagem"); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Imagem deve ter no máximo 10MB"); return; }
    const r = new FileReader();
    r.onload = () => setSelfie(r.result as string);
    r.readAsDataURL(f);
  };

  const send = async () => {
    if (!selfie) return;
    setLoading(true); setError(null);
    try {
      const [meta, b64] = selfie.split(",");
      const mime = /data:([^;]+)/.exec(meta || "")?.[1] || "image/jpeg";
      const bin = atob(b64 || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const cpfDigits = cpf.replace(/\D/g, "");
      const key = `cadastro-publico/${cpfDigits}-foto-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("qa-cadastro-selfies")
        .upload(key, blob, { contentType: mime, upsert: true });
      if (upErr) throw new Error(upErr.message);

      const { data, error } = await supabase.functions.invoke("qa-atualizar-foto", {
        body: { action: "update", cpf: cpfDigits, selfie_path: key },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Erro ao salvar");
      setStep("ok");
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar foto");
    } finally {
      setLoading(false);
    }
  };

  const nome = found?.cadastro?.nome_completo || found?.cliente?.nome_completo || "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, hsl(220 20% 97%) 0%, hsl(230 20% 94%) 100%)" }}>
      <div className="max-w-md w-full mx-auto px-4 py-8 flex-1">
        <div className="flex justify-center mb-6"><QALogo /></div>

        <div className="qa-card rounded-2xl p-6 md:p-8">
          {step === "cpf" && (
            <>
              <h1 className="text-xl font-bold mb-2" style={{ color: "hsl(220 20% 18%)" }}>ENVIAR APENAS FOTO</h1>
              <p className="text-sm mb-6" style={{ color: "hsl(220 10% 46%)" }}>
                Já fez seu cadastro? Atualize ou envie sua foto sem precisar refazer o formulário.
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "hsl(220 20% 25%)" }}>CPF</label>
              <input
                type="tel" inputMode="numeric"
                value={cpf}
                onChange={e => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full h-12 px-4 rounded-lg border outline-none focus:ring-2 focus:ring-blue-300"
                style={{ borderColor: "hsl(220 13% 88%)" }}
                onKeyDown={e => e.key === "Enter" && lookup()}
              />
              {error && (
                <div className="mt-3 p-3 rounded-lg flex gap-2 text-sm" style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 40%)" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}
              <button
                onClick={lookup}
                disabled={loading}
                className="mt-5 w-full h-12 rounded-lg font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))" }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                CONTINUAR
              </button>
              <div className="mt-6 pt-4 border-t text-[11px] flex items-start gap-2" style={{ borderColor: "hsl(220 13% 90%)", color: "hsl(220 10% 50%)" }}>
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "hsl(230 80% 56%)" }} />
                Seus dados são tratados conforme a LGPD. A foto é usada apenas para identificação no atendimento.
              </div>
            </>
          )}

          {step === "selfie" && (
            <>
              <button onClick={() => { setStep("cpf"); setSelfie(""); stream?.getTracks().forEach(t => t.stop()); setStream(null); }} className="text-xs uppercase tracking-wide mb-3" style={{ color: "hsl(220 10% 50%)" }}>← Voltar</button>
              <h1 className="text-xl font-bold mb-1" style={{ color: "hsl(220 20% 18%)" }}>ATUALIZAR FOTO</h1>
              {nome && <p className="text-sm mb-5 font-medium" style={{ color: "hsl(220 20% 35%)" }}>{nome}</p>}

              {!selfie && !stream && (
                <div className="space-y-3">
                  <button onClick={startCamera} className="w-full h-12 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))" }}>
                    <Camera className="w-4 h-4" /> ABRIR CÂMERA
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="w-full h-12 rounded-lg font-semibold border flex items-center justify-center gap-2" style={{ borderColor: "hsl(220 13% 80%)", color: "hsl(220 20% 25%)" }}>
                    <Upload className="w-4 h-4" /> ENVIAR DO DISPOSITIVO
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={onFile} />
                </div>
              )}

              {stream && !selfie && (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden bg-black aspect-square">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                  </div>
                  <button onClick={capture} className="w-full h-12 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))" }}>
                    <Camera className="w-4 h-4" /> CAPTURAR
                  </button>
                </div>
              )}

              {selfie && (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden bg-black aspect-square">
                    <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setSelfie(""); }} className="h-11 rounded-lg font-semibold border flex items-center justify-center gap-2" style={{ borderColor: "hsl(220 13% 80%)", color: "hsl(220 20% 25%)" }}>
                      <RotateCcw className="w-4 h-4" /> REFAZER
                    </button>
                    <button onClick={send} disabled={loading} className="h-11 rounded-lg font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "linear-gradient(135deg, hsl(152 60% 42%), hsl(160 65% 40%))" }}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      ENVIAR
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-lg flex gap-2 text-sm" style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 40%)" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}
            </>
          )}

          {step === "ok" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center" style={{ background: "hsl(152 60% 95%)" }}>
                <CheckCircle className="w-8 h-8" style={{ color: "hsl(152 60% 42%)" }} />
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "hsl(220 20% 18%)" }}>FOTO ATUALIZADA</h1>
              <p className="text-sm" style={{ color: "hsl(220 10% 46%)" }}>Sua foto foi recebida com sucesso e já está disponível para nossa equipe.</p>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-[11px]" style={{ color: "hsl(220 10% 50%)" }}>
          © {new Date().getFullYear()} · Criado e desenvolvido por{" "}
          <span className="font-semibold" style={{ color: "hsl(220 20% 25%)" }}>WMTi Tecnologia da Informação</span>. Todos os direitos reservados.
          <div className="mt-1">+55 (11) 96316-6915</div>
        </div>
      </div>
    </div>
  );
}
