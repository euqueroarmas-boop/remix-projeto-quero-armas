/**
 * Gravador de voz que captura PCM via Web Audio e entrega um WAV completo
 * (16 kHz mono). WAV evita os fragmentos sem cabeçalho do MediaRecorder e o
 * MP4 fragmentado do Safari iOS — ambos rejeitados pela transcrição.
 */
export type WavRecorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

function encodeWav(chunks: Float32Array[], sampleRate: number, target = 16000): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }

  // Downsample simples por decimação linear
  const ratio = sampleRate / target;
  const outLen = Math.floor(merged.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = merged[Math.floor(i * ratio)] ?? 0;

  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, target, true);
  view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, out.length * 2, true);
  let p = 44;
  for (let i = 0; i < out.length; i++, p += 2) {
    const s = Math.max(-1, Math.min(1, out[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function startWavRecording(): Promise<WavRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const pcm: Float32Array[] = [];
  node.onaudioprocess = (e) => pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(node);
  node.connect(ctx.destination);

  const teardown = () => {
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { node.disconnect(); source.disconnect(); } catch { /* noop */ }
  };

  return {
    async stop() {
      teardown();
      const rate = ctx.sampleRate;
      const blob = encodeWav(pcm, rate);
      try { await ctx.close(); } catch { /* noop */ }
      return blob;
    },
    cancel() {
      teardown();
      ctx.close().catch(() => { /* noop */ });
    },
  };
}