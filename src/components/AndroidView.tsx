import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Wifi,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Lock,
  ArrowRight,
  RefreshCw,
  Sun,
  Globe,
  Trash2,
  Radio,
  Share2,
} from 'lucide-react';
import { SpeechStreamer, requestWakeLock } from '../utils/audio';
import { WsMessage } from '../types';

interface AndroidViewProps {
  initialPin?: string;
  onSendWsMessage: (msg: WsMessage) => void;
  isPaired: boolean;
  pairedPin: string;
  onPairSuccess: (pin: string) => void;
  onDisconnect: () => void;
  lastError?: string;
}

export const AndroidView: React.FC<AndroidViewProps> = ({
  initialPin = '',
  onSendWsMessage,
  isPaired,
  pairedPin,
  onPairSuccess,
  onDisconnect,
  lastError,
}) => {
  // Pairing inputs
  const [pinInput, setPinInput] = useState(initialPin || '');
  const [deviceName, setDeviceName] = useState(() => {
    if (typeof navigator !== 'undefined') {
      const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
      return isMobile ? 'Celular Android' : 'Dispositivo Móvel';
    }
    return 'Celular Android';
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState(lastError || '');

  // Microphone & Speech streaming
  const [isRecording, setIsRecording] = useState(false);
  const [streamer, setStreamer] = useState<SpeechStreamer | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [currentInterim, setCurrentInterim] = useState('');
  const [lastFinalPhrase, setLastFinalPhrase] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [micMode, setMicMode] = useState<'toggle' | 'push_to_talk'>('toggle');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<{ release: () => void } | null>(null);

  // Decay peak audio level smoothly for VU meter
  useEffect(() => {
    if (!isRecording) {
      setAudioLevel(0);
      setPeakLevel(0);
      return;
    }

    if (audioLevel > peakLevel) {
      setPeakLevel(audioLevel);
    } else if (peakLevel > 0) {
      const timer = setTimeout(() => {
        setPeakLevel((prev) => Math.max(0, Math.round((prev - 0.04) * 100) / 100));
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [audioLevel, peakLevel, isRecording]);

  // Sync initialPin if passed via URL
  useEffect(() => {
    if (initialPin && !pinInput) {
      setPinInput(initialPin);
    }
  }, [initialPin]);

  // Update error message if prop updates
  useEffect(() => {
    if (lastError) {
      setErrorMessage(lastError);
      setIsVerifying(false);
    }
  }, [lastError]);

  // Setup SpeechStreamer instance
  useEffect(() => {
    const s = new SpeechStreamer(language);

    s.onInterimText = (text) => {
      setCurrentInterim(text);
      onSendWsMessage({
        type: 'speech_interim',
        text,
      });
    };

    s.onFinalText = (text) => {
      setLastFinalPhrase(text);
      setCurrentInterim('');
      onSendWsMessage({
        type: 'speech_final',
        text,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
      });
    };

    s.onAudioLevel = (level) => {
      setAudioLevel(level);
      onSendWsMessage({
        type: 'audio_level',
        level,
      });
    };

    s.onStateChange = (recording) => {
      setIsRecording(recording);
      if (!recording) {
        setAudioLevel(0);
        setPeakLevel(0);
      }
    };

    s.onError = (err) => {
      setErrorMessage(err);
      setIsRecording(false);
      setAudioLevel(0);
      setPeakLevel(0);
    };

    setStreamer(s);

    return () => {
      s.stop();
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, []);

  // Update speech language if changed
  useEffect(() => {
    if (streamer) {
      streamer.setLanguage(language);
    }
  }, [language, streamer]);

  // Handle PIN verification
  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = pinInput.replace(/\s+/g, '');
    if (clean.length < 4) {
      setErrorMessage('Digite o código PIN exibido na tela do computador.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/session/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: clean }),
      });
      const data = await res.json();

      if (data.valid) {
        // Register over WebSocket
        onSendWsMessage({
          type: 'register_android',
          pin: clean,
          deviceName,
        });
        onPairSuccess(clean);
        setIsVerifying(false);
      } else {
        setErrorMessage(data.message || 'Código PIN incorreto ou não encontrado.');
        setIsVerifying(false);
      }
    } catch (err: any) {
      // Fallback direct register over socket in case of local network proxy
      onSendWsMessage({
        type: 'register_android',
        pin: clean,
        deviceName,
      });
      onPairSuccess(clean);
      setIsVerifying(false);
    }
  };

  // Toggle or start/stop recording with haptic feedback
  const handleToggleRecord = async () => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(35);
      } catch (e) {}
    }

    if (isRecording) {
      if (streamer) {
        streamer.stop();
      }
      setIsRecording(false);
      setAudioLevel(0);
      setPeakLevel(0);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockActive(false);
      }
    } else {
      setErrorMessage('');
      const targetStreamer = streamer || new SpeechStreamer(language);
      if (!streamer) {
        setStreamer(targetStreamer);
      }

      const started = await targetStreamer.start();
      if (started) {
        setIsRecording(true);
        // Request wake lock so Android phone screen stays active
        const lock = await requestWakeLock();
        if (lock) {
          wakeLockRef.current = lock;
          setWakeLockActive(true);
        }
      }
    }
  };

  // Push to talk handlers
  const handlePttDown = (e: React.SyntheticEvent) => {
    if (micMode === 'push_to_talk' && !isRecording) {
      e.preventDefault();
      handleToggleRecord();
    }
  };

  const handlePttUp = (e: React.SyntheticEvent) => {
    if (micMode === 'push_to_talk' && isRecording) {
      e.preventDefault();
      handleToggleRecord();
    }
  };

  // Remote clear command to PC
  const handleRemoteClear = () => {
    onSendWsMessage({
      type: 'remote_command',
      command: 'clear',
    });
  };

  // ---------------- VIEW 1: UNPAIRED PIN VERIFICATION ----------------
  if (!isPaired) {
    return (
      <div
        id="android-pairing-container"
        className="flex flex-col items-center justify-center min-h-[500px] w-full max-w-sm mx-auto p-4 select-none"
      >
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          {/* Mobile App Icon */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Smartphone className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">VozLink Android</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
              Use este celular como microfone sem fio e transmita para seu computador
            </p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            {/* PIN Input */}
            <div>
              <label
                htmlFor="pin-input"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center"
              >
                Código PIN do Computador
              </label>
              <div className="relative">
                <input
                  id="pin-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 849201"
                  className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] py-3.5 px-4 bg-slate-950 border border-indigo-500/40 focus:border-indigo-500 rounded-2xl text-white outline-none transition-all placeholder:text-slate-700 placeholder:tracking-normal placeholder:font-sans placeholder:text-base"
                  autoFocus
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Device Name input */}
            <div>
              <label
                htmlFor="device-name-input"
                className="block text-[11px] font-medium text-slate-400 mb-1"
              >
                Nome do Dispositivo (opcional)
              </label>
              <input
                id="device-name-input"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full py-2 px-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Connect Button */}
            <button
              id="verify-pin-submit-btn"
              type="submit"
              disabled={isVerifying || pinInput.replace(/\s+/g, '').length < 4}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-semibold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verificando PIN...</span>
                </>
              ) : (
                <>
                  <span>Conectar ao Computador</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Wi-Fi Hint */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-slate-500 text-[11px]">
            <Wifi className="w-3.5 h-3.5 text-indigo-400" />
            <span>Certifique-se de estar no mesmo Wi-Fi do PC</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- VIEW 2: ACTIVE PAIRED MICROPHONE ----------------
  return (
    <div
      id="android-active-mic-container"
      className="flex flex-col h-full w-full max-w-sm mx-auto p-4 select-none"
    >
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl overflow-hidden justify-between">
        {/* Top App Bar */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              {/* Pulsing connection status dot */}
              <div className="relative flex items-center justify-center">
                {isRecording && audioLevel > 0.05 && (
                  <span className="absolute w-5 h-5 rounded-full bg-emerald-400/40 animate-ping duration-1000" />
                )}
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                    isRecording && audioLevel > 0.05
                      ? 'bg-emerald-300 shadow-[0_0_12px_#6ee7b7] scale-125'
                      : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-200">Conectado ao PC</h3>
                  {isRecording && audioLevel > 0.05 && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-500/40">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      Voz Ativa
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-400">PIN: {pairedPin}</span>
              </div>
            </div>

            <button
              id="android-disconnect-btn"
              onClick={onDisconnect}
              className="text-[11px] text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-900/40 transition-colors"
            >
              Desconectar
            </button>
          </div>

          {/* Language & Settings bar */}
          <div className="flex items-center justify-between mt-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer"
              >
                <option value="pt-BR" className="bg-slate-900 text-white">
                  Português (BR)
                </option>
                <option value="en-US" className="bg-slate-900 text-white">
                  English (US)
                </option>
                <option value="es-ES" className="bg-slate-900 text-white">
                  Español
                </option>
              </select>
            </div>

            {/* Mode switch */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px]">
              <button
                id="mic-mode-toggle-btn"
                onClick={() => setMicMode('toggle')}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  micMode === 'toggle' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                Alternar
              </button>
              <button
                id="mic-mode-ptt-btn"
                onClick={() => setMicMode('push_to_talk')}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  micMode === 'push_to_talk' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                Segurar
              </button>
            </div>
          </div>
        </div>

        {/* Center: Tactile Microphone Touch Target */}
        <div className="my-auto flex flex-col items-center justify-center py-6">
          <div className="relative flex items-center justify-center">
            {/* Glowing Wave Ring Animations */}
            {isRecording && (
              <>
                <span className="absolute w-44 h-44 rounded-full bg-indigo-500/15 animate-ping duration-1000" />
                {audioLevel > 0.05 && (
                  <span className="absolute w-52 h-52 rounded-full bg-emerald-500/15 animate-pulse duration-500" />
                )}
                <span
                  style={{
                    transform: `scale(${1 + Math.max(audioLevel * 0.5, 0.08)})`,
                  }}
                  className={`absolute w-36 h-36 rounded-full transition-all duration-75 ${
                    audioLevel > 0.05
                      ? 'bg-emerald-500/25 border border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                      : 'bg-indigo-500/20 border border-indigo-400/30'
                  }`}
                />
              </>
            )}

            {/* Main Microphone Button */}
            <button
              id="android-mic-main-btn"
              type="button"
              onClick={micMode === 'toggle' ? handleToggleRecord : undefined}
              onMouseDown={micMode === 'push_to_talk' ? handlePttDown : undefined}
              onMouseUp={micMode === 'push_to_talk' ? handlePttUp : undefined}
              onTouchStart={micMode === 'push_to_talk' ? handlePttDown : undefined}
              onTouchEnd={micMode === 'push_to_talk' ? handlePttUp : undefined}
              className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-200 active:scale-95 cursor-pointer ${
                isRecording
                  ? audioLevel > 0.05
                    ? 'bg-gradient-to-tr from-emerald-600 via-indigo-600 to-rose-600 text-white shadow-emerald-500/30 ring-4 ring-emerald-400/50 scale-105'
                    : 'bg-gradient-to-tr from-indigo-600 to-rose-600 text-white shadow-rose-500/25 ring-4 ring-rose-500/30'
                  : 'bg-gradient-to-tr from-slate-800 to-slate-700 text-slate-300 hover:text-white shadow-black/40 ring-1 ring-slate-700'
              }`}
            >
              {isRecording ? (
                <Mic
                  className={`w-10 h-10 transition-transform duration-100 ${
                    audioLevel > 0.05 ? 'scale-110 text-emerald-100' : 'animate-pulse'
                  }`}
                />
              ) : (
                <MicOff className="w-10 h-10" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider mt-1">
                {isRecording ? (audioLevel > 0.05 ? 'Ouvindo' : 'Gravando') : 'Iniciar'}
              </span>
            </button>
          </div>

          <p className="text-xs font-medium text-slate-300 mt-3 text-center">
            {isRecording
              ? micMode === 'push_to_talk'
                ? 'Solte para pausar envio'
                : 'Ouvindo... Fale com o Android'
              : micMode === 'push_to_talk'
              ? 'Segure o botão para falar'
              : 'Toque para ligar o microfone'}
          </p>

          {/* Real-time Audio Level VU Meter */}
          <div
            id="android-vumeter-card"
            className="w-full bg-slate-950/85 border border-slate-800 rounded-2xl p-3 mt-3 shadow-inner"
          >
            {/* Header: Title & Dynamic Status */}
            <div className="flex items-center justify-between text-[11px] mb-2">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <Volume2
                  className={`w-3.5 h-3.5 transition-colors ${
                    isRecording && audioLevel > 0.05
                      ? 'text-emerald-400 animate-pulse'
                      : 'text-slate-500'
                  }`}
                />
                <span className="font-semibold text-slate-200">VU Meter</span>
                <span className="text-[10px] text-slate-500">• Nível de Entrada</span>
              </div>

              <div>
                {isRecording ? (
                  audioLevel > 0.04 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono text-[10px] font-bold shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {Math.round(audioLevel * 100)}% • Ouvindo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                      Silêncio
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800/60 text-slate-500 text-[10px]">
                    Desligado
                  </span>
                )}
              </div>
            </div>

            {/* Discrete 24-LED Segment Bar */}
            <div
              id="android-vumeter-led-bar"
              className="flex items-center gap-[2px] h-3 bg-slate-900/90 p-[2px] rounded-md border border-slate-800/80"
              role="meter"
              aria-label="Nível de Áudio Captado"
              aria-valuenow={Math.round(audioLevel * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {Array.from({ length: 24 }).map((_, idx) => {
                const threshold = (idx + 1) / 24;
                const isActive = isRecording && audioLevel >= threshold;
                const isPeak =
                  isRecording &&
                  peakLevel > 0.05 &&
                  Math.abs(peakLevel - threshold) < 0.045;

                // Segment color logic: 0-13 Emerald, 14-18 Amber, 19-23 Rose
                let activeColor = 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]';
                if (idx >= 19) {
                  activeColor = 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]';
                } else if (idx >= 14) {
                  activeColor = 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]';
                }

                return (
                  <div
                    key={idx}
                    className={`flex-1 h-full rounded-[1px] transition-all duration-75 ${
                      isActive
                        ? activeColor
                        : isPeak
                        ? 'bg-indigo-400/90 shadow-[0_0_4px_#818cf8]'
                        : 'bg-slate-800/40'
                    }`}
                  />
                );
              })}
            </div>

            {/* Continuous Smooth Gradient Bar with Peak Cursor */}
            <div className="relative w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/60 mt-1.5">
              <div
                style={{
                  width: `${isRecording ? Math.min(100, Math.round(audioLevel * 100)) : 0}%`,
                }}
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75 rounded-full"
              />
              {isRecording && peakLevel > 0.02 && (
                <div
                  style={{
                    left: `${Math.min(99, Math.max(1, Math.round(peakLevel * 100)))}%`,
                  }}
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_4px_#ffffff] rounded-full -ml-0.5 transition-all duration-75"
                />
              )}
            </div>

            {/* Decibel Reference Scale */}
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-0.5 mt-1">
              <span>-40dB</span>
              <span>-24dB</span>
              <span>-12dB</span>
              <span>-6dB</span>
              <span
                className={`font-semibold transition-colors ${
                  isRecording && audioLevel > 0.82 ? 'text-rose-400 animate-pulse' : 'text-slate-500'
                }`}
              >
                CLIP
              </span>
            </div>
          </div>

          {/* Error Message if any in View 2 */}
          {errorMessage && (
            <div className="mt-2.5 p-2 px-3 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-[11px] max-w-[280px] text-center">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Bottom Section: Real-time Audio Preview Bubble & Remote Actions */}
        <div className="space-y-3">
          {/* Live text preview */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl min-h-[64px] flex flex-col justify-center text-xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
              Transmitindo ao Computador:
            </span>
            {currentInterim ? (
              <p className="text-indigo-300 font-medium line-clamp-2 animate-pulse">
                "{currentInterim}"
              </p>
            ) : lastFinalPhrase ? (
              <p className="text-slate-300 line-clamp-2">"{lastFinalPhrase}"</p>
            ) : (
              <p className="text-slate-600 italic">Sua fala aparecerá aqui e no computador...</p>
            )}
          </div>

          {/* Remote PC controls */}
          <div className="flex items-center gap-2">
            <button
              id="android-remote-clear-btn"
              onClick={handleRemoteClear}
              className="flex-1 py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar PC</span>
            </button>

            <div
              className={`py-2 px-3 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                wakeLockActive
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="text-[10px]">Tela Ativa</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
