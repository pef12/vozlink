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
  const [currentInterim, setCurrentInterim] = useState('');
  const [lastFinalPhrase, setLastFinalPhrase] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [micMode, setMicMode] = useState<'toggle' | 'push_to_talk'>('toggle');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<{ release: () => void } | null>(null);

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
    };

    s.onError = (err) => {
      setErrorMessage(err);
      setIsRecording(false);
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
    if (!streamer) return;

    if (navigator.vibrate) {
      navigator.vibrate(35);
    }

    if (isRecording) {
      streamer.stop();
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockActive(false);
      }
    } else {
      setErrorMessage('');
      const started = await streamer.start();
      if (started) {
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
  const handleTouchStart = () => {
    if (micMode === 'push_to_talk' && !isRecording) {
      handleToggleRecord();
    }
  };

  const handleTouchEnd = () => {
    if (micMode === 'push_to_talk' && isRecording) {
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
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <div>
                <h3 className="text-xs font-bold text-slate-200">Conectado ao PC</h3>
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
                <span
                  style={{
                    transform: `scale(${1 + audioLevel * 0.4})`,
                  }}
                  className="absolute w-36 h-36 rounded-full bg-indigo-500/20 border border-indigo-400/30 transition-transform duration-75"
                />
              </>
            )}

            {/* Main Microphone Button */}
            <button
              id="android-mic-main-btn"
              onClick={micMode === 'toggle' ? handleToggleRecord : undefined}
              onMouseDown={handleTouchStart}
              onMouseUp={handleTouchEnd}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-200 active:scale-95 ${
                isRecording
                  ? 'bg-gradient-to-tr from-indigo-600 to-rose-600 text-white shadow-rose-500/25 ring-4 ring-rose-500/30'
                  : 'bg-gradient-to-tr from-slate-800 to-slate-700 text-slate-300 hover:text-white shadow-black/40 ring-1 ring-slate-700'
              }`}
            >
              {isRecording ? <Mic className="w-10 h-10 animate-pulse" /> : <MicOff className="w-10 h-10" />}
              <span className="text-[10px] font-bold uppercase tracking-wider mt-1">
                {isRecording ? 'Gravando' : 'Iniciar'}
              </span>
            </button>
          </div>

          {/* Sound Wave Meter Bars */}
          <div className="flex items-center gap-1.5 mt-6 h-6">
            {[0.1, 0.3, 0.6, 1.0, 0.7, 0.4, 0.2].map((f, i) => {
              const h = isRecording
                ? Math.max(15, Math.min(100, Math.round(audioLevel * f * 100)))
                : 15;
              return (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isRecording && audioLevel > 0.05 ? 'bg-indigo-400' : 'bg-slate-800'
                  }`}
                />
              );
            })}
          </div>

          <p className="text-xs font-medium text-slate-300 mt-2 text-center">
            {isRecording
              ? micMode === 'push_to_talk'
                ? 'Solte para pausar envio'
                : 'Ouvindo... Fale com o Android'
              : micMode === 'push_to_talk'
              ? 'Segure o botão para falar'
              : 'Toque para ligar o microfone'}
          </p>

          {/* Quick Test Voice Button */}
          {!isRecording && (
            <button
              id="android-sim-voice-btn"
              onClick={() => {
                const samplePhrases = [
                  'Olá computador, este é um teste do microfone sem fio do Android.',
                  'A transcrição de voz está funcionando perfeitamente em tempo real!',
                  'Transmitindo texto diretamente do celular para a tela do PC.',
                  'Conexão verificada com sucesso através do código PIN.',
                ];
                const phrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
                
                // Simulate interim then final
                setCurrentInterim(phrase.slice(0, 20) + '...');
                onSendWsMessage({
                  type: 'speech_interim',
                  text: phrase.slice(0, 20) + '...',
                });
                onSendWsMessage({
                  type: 'audio_level',
                  level: 0.8,
                });

                setTimeout(() => {
                  setCurrentInterim('');
                  setLastFinalPhrase(phrase);
                  onSendWsMessage({
                    type: 'speech_final',
                    text: phrase,
                    id: Math.random().toString(36).substring(2, 9),
                    timestamp: Date.now(),
                  });
                  onSendWsMessage({
                    type: 'audio_level',
                    level: 0,
                  });
                }, 700);
              }}
              className="mt-2 text-[10px] text-indigo-400/90 hover:text-indigo-300 underline font-medium"
            >
              Ditar frase de exemplo (Teste rápido)
            </button>
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
