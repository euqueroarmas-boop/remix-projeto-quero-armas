import { useState, useCallback, useRef, useEffect } from "react";
import type { VoiceFeatures } from "./voiceBaselineEngine";

const ANALYSIS_INTERVAL_MS = 2000; // Analyze every 2 seconds
const FFT_SIZE = 2048;

interface UseVoiceCaptureReturn {
  isListening: boolean;
  hasPermission: boolean | null;
  start: () => Promise<void>;
  stop: () => void;
  currentFeatures: VoiceFeatures | null;
  error: string | null;
  rawEnergy: number;
}

export function useVoiceCapture(onFeatures: (f: VoiceFeatures) => void): UseVoiceCaptureReturn {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentFeatures, setCurrentFeatures] = useState<VoiceFeatures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawEnergy, setRawEnergy] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevEnergyRef = useRef<number>(0);

  const extractFeatures = useCallback((): VoiceFeatures | null => {
    const analyser = analyserRef.current;
    if (!analyser) return null;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatFrequencyData(dataArray);

    const timeData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeData);

    // Energy (RMS of time domain)
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      sumSquares += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sumSquares / timeData.length);
    const energy = Math.min(100, rms * 500); // Normalize to ~0-100

    // Pitch estimation (autocorrelation)
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const pitch = estimatePitch(timeData, sampleRate);

    // Pitch variation (difference from previous)
    const pitchVariation = Math.abs(pitch - (prevEnergyRef.current || pitch));
    prevEnergyRef.current = pitch;

    // Speech rate estimate (zero-crossing rate as proxy)
    let zeroCrossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] >= 0 && timeData[i - 1] < 0) || (timeData[i] < 0 && timeData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const speechRate = Math.min(100, (zeroCrossings / timeData.length) * 1000);

    return { energy, pitchMean: pitch, pitchVariation, speechRate };
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      setHasPermission(true);
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);

      // Periodic feature extraction
      intervalRef.current = setInterval(() => {
        const features = extractFeatures();
        if (features) {
          setRawEnergy(features.energy);
          if (features.energy > 0.3) { // Lower threshold to capture normal speech
            setCurrentFeatures(features);
            onFeatures(features);
          }
        }
      }, ANALYSIS_INTERVAL_MS);
    } catch (e: any) {
      setError(e.message || "Erro ao acessar microfone");
      setHasPermission(false);
    }
  }, [extractFeatures, onFeatures]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
    setCurrentFeatures(null);
    setRawEnergy(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return { isListening, hasPermission, start, stop, currentFeatures, error };
}

/**
 * Simple pitch estimation using autocorrelation
 */
function estimatePitch(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  const rms = Math.sqrt(buffer.reduce((s, v) => s + v * v, 0) / SIZE);
  if (rms < 0.01) return 0; // Too quiet

  // Autocorrelation
  const minLag = Math.floor(sampleRate / 500); // 500 Hz max
  const maxLag = Math.floor(sampleRate / 50);  // 50 Hz min

  let bestCorrelation = 0;
  let bestLag = minLag;

  for (let lag = minLag; lag < maxLag && lag < SIZE; lag++) {
    let correlation = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  return bestCorrelation > 0 ? sampleRate / bestLag : 0;
}
