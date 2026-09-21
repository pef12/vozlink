import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Copy,
  Check,
  Sparkles,
  Download,
  Trash2,
  QrCode,
  Wifi,
  Smartphone,
  CheckCircle2,
  Volume2,
  FileText,
  Clock,
  Settings,
  ExternalLink,
  Keyboard,
  Terminal,
  ListFilter,
  Monitor,
} from 'lucide-react';
import { TranscriptionRecord } from '../types';
import { QrCodeModal } from './QrCodeModal';
import { ActiveInputField } from './ActiveInputField';
import { GlobalTyperModal } from './GlobalTyperModal';

interface DesktopViewProps {
  pin: string;
  isAndroidConnected: boolean;
  androidDeviceName?: string;
  transcriptions: TranscriptionRecord[];
  interimText: string;
  audioLevel: number;
  onClearTranscriptions: () => void;
  onEnhanceWithAi: (fullText: string) => Promise<string | null>;
  localIps?: string[];
  onRequestNewPin?: () => void;
}

export const DesktopView: React.FC<DesktopViewProps> = ({
  pin,
  isAndroidConnected,
  androidDeviceName = 'Android',
  transcriptions,
  interimText,
  audioLevel,
  onClearTranscriptions,
  onEnhanceWithAi,
  localIps = [],
}) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [showGlobalTyperModal, setShowGlobalTyperModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'active_field' | 'history'>('active_field');
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedFullText, setEnhancedFullText] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [autoScroll, setAutoScroll] = useState(true);

  // Latest final transcript to pass to active input field
  const latestFinalRecord = transcriptions.length > 0 ? transcriptions[transcriptions.length - 1] : null;
  const latestFinalText = latestFinalRecord ? latestFinalRecord.text : '';

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compile full text string
  const fullRawText = transcriptions.map((t) => t.text).join(' ');
  const displayText = enhancedFullText !== null ? enhancedFullText : fullRawText;

  // Word & character counts
  const wordCount = displayText.trim() ? displayText.trim().split(/\s+/).length : 0;
  const charCount = displayText.length;

  // Auto-scroll when new transcriptions or interim text arrives
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [transcriptions, interimText, autoScroll]);

  const handleCopyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyAllText = () => {
    const textToCopy = displayText + (interimText ? ` ${interimText}` : '');
    if (!textToCopy.trim()) return;
    navigator.clipboard.writeText(textToCopy.trim());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleEnhance = async () => {
    if (!displayText.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const result = await onEnhanceWithAi(displayText);
      if (result) {
        setEnhancedFullText(result);
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleDownload = (format: 'txt' | 'md') => {
    const text = displayText + (interimText ? `\n\n[Em andamento]: ${interimText}` : '');
    if (!text.trim()) return;

    let content = text;
    let mimeType = 'text/plain';
    let filename = `transcricao-vozlink-${new Date().toISOString().slice(0, 10)}.${format}`;

    if (format === 'md') {
      content = `# Transcrição de Áudio - VozLink\n\n**Data:** ${new Date().toLocaleString('pt-BR')}\n**Dispositivo de Origem:** ${androidDeviceName}\n\n---\n\n${displayText}\n`;
      mimeType = 'text/markdown';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Font size classes
  const fontClasses = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-relaxed',
    xl: 'text-xl leading-relaxed',
  };

  return (
    <div id="desktop-view-container" className="flex flex-col h-full w-full max-w-6xl mx-auto p-4 md:p-6 gap-4">
      {/* Top Header Card: PIN & Connection Info */}
      <div
        id="desktop-header-card"
        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
      >
        {/* Left: Connection Status & Device */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                isAndroidConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {isAndroidConnected ? <Smartphone className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </div>
            {/* Live pulsing dot */}
            <span
              className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                isAndroidConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-100 text-base">
                {isAndroidConnected ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Android Conectado
                  </span>
                ) : (
                  <span className="text-slate-200">Aguardando Conexão do Celular</span>
                )}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                Mesma Rede
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAndroidConnected
                ? `Recebendo áudio e transcrição ao vivo de "${androidDeviceName}"`
                : 'Abra o app no celular Android e insira o código PIN abaixo'}
            </p>
          </div>
        </div>

        {/* Center: Live Audio Wave Visualizer */}
        <div className="flex items-center justify-center gap-1 px-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl min-w-[160px]">
          <Volume2
            className={`w-4 h-4 transition-colors ${
              audioLevel > 0.05 ? 'text-indigo-400' : 'text-slate-600'
            }`}
          />
          <div className="flex items-center gap-1 h-6 px-1">
            {[0.2, 0.4, 0.7, 1.0, 0.8, 0.5, 0.3].map((factor, i) => {
              const heightPercent = Math.max(
                12,
                Math.min(100, Math.round(audioLevel * factor * 100))
              );
              return (
                <span
                  key={i}
                  style={{ height: `${heightPercent}%` }}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    audioLevel > 0.08 ? 'bg-indigo-400' : 'bg-slate-700'
                  }`}
                />
              );
            })}
          </div>
          <span className="text-[10px] font-mono text-slate-400 ml-1">
            {audioLevel > 0.05 ? 'Captação Ativa' : 'Em Silêncio'}
          </span>
        </div>

        {/* Right: Big PIN Badge & QR Code Trigger */}
        <div className="flex items-center gap-2">
          <div
            id="pin-display-badge"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-950 border border-indigo-500/30 rounded-xl shadow-inner cursor-pointer hover:border-indigo-500/60 transition-colors"
            onClick={handleCopyPin}
            title="Clique para copiar o PIN"
          >
            <div className="flex flex-col">
              <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
                Código PIN
              </span>
              <span className="text-xl font-bold font-mono tracking-widest text-white">
                {pin.length >= 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin}
              </span>
            </div>
            <button
              id="copy-pin-btn"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Copiar código PIN"
            >
              {copiedPin ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          <button
            id="open-qr-btn"
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">QR Code / Conectar</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs: In-Focus Active Input vs Structured History */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-md">
          <button
            id="tab-active-field-btn"
            onClick={() => setActiveTab('active_field')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'active_field'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Campo de Texto em Destaque</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
              Inserção Direta
            </span>
          </button>

          <button
            id="tab-history-btn"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Histórico de Transcrições</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {transcriptions.length}
            </span>
          </button>
        </div>

        {/* Global Desktop Typer Helper Button */}
        <button
          id="open-global-typer-header-btn"
          onClick={() => setShowGlobalTyperModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
          title="Configurar digitação automática em programas externos (Word, Bloco de Notas, etc.)"
        >
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span>Digitar em Apps Externos (Word, Bloco de Notas)</span>
        </button>
      </div>

      {/* View Content: Active In-Focus Field or Structured History */}
      {activeTab === 'active_field' ? (
        <div className="flex-1 min-h-[420px]">
          <ActiveInputField
            incomingFinalText={latestFinalText}
            incomingInterimText={interimText}
            isAndroidConnected={isAndroidConnected}
            onEnhanceWithAi={onEnhanceWithAi}
            onOpenGlobalTyperModal={() => setShowGlobalTyperModal(true)}
            pin={pin}
          />
        </div>
      ) : (
        /* Main Transcription History Card */
        <div
          id="desktop-transcription-card"
          className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[420px]"
        >
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300">
            {/* Left stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>{wordCount} palavras</span>
                <span className="text-slate-600">•</span>
                <span>{charCount} caracteres</span>
              </div>

              {interimText && (
                <div className="flex items-center gap-1 text-indigo-400 animate-pulse font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>Ouvindo celular...</span>
                </div>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Font size picker */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 mr-1">
                {(['sm', 'base', 'lg'] as const).map((size) => (
                  <button
                    key={size}
                    id={`font-size-${size}-btn`}
                    onClick={() => setFontSize(size)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      fontSize === size
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* AI Refinement */}
              <button
                id="ai-enhance-btn"
                onClick={handleEnhance}
                disabled={isEnhancing || !displayText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-sm"
                title="Corrigir pontuação e estruturar texto com IA"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
                <span>{isEnhancing ? 'Aprimorando...' : 'Pontuar com IA'}</span>
              </button>

              {/* Copy button */}
              <button
                id="copy-transcript-btn"
                onClick={handleCopyAllText}
                disabled={!displayText.trim() && !interimText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-100 rounded-lg font-medium transition-colors"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>

              {/* Export menu */}
              <button
                id="download-txt-btn"
                onClick={() => handleDownload('txt')}
                disabled={!displayText.trim()}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white rounded-lg transition-colors"
                title="Baixar em formato .txt"
                aria-label="Baixar texto"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Clear button */}
              <button
                id="clear-transcript-btn"
                onClick={() => {
                  onClearTranscriptions();
                  setEnhancedFullText(null);
                }}
                disabled={!displayText.trim() && !interimText.trim()}
                className="p-1.5 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 disabled:opacity-40 text-slate-400 rounded-lg transition-colors"
                title="Limpar transcrição"
                aria-label="Limpar texto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Transcript Body */}
          <div
            ref={scrollContainerRef}
            id="transcription-stream-body"
            className="flex-1 p-5 md:p-6 overflow-y-auto space-y-4 bg-slate-950/40"
          >
            {transcriptions.length === 0 && !interimText ? (
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 shadow-inner">
                  <Mic className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-200 mb-1">
                  Pronto para receber sua voz
                </h3>
                <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                  Abra o VozLink no seu celular Android, conecte com o PIN{' '}
                  <strong className="text-indigo-300 font-mono">{pin}</strong> e comece a falar. As
                  palavras aparecerão aqui em tempo real.
                </p>
                <button
                  id="empty-state-qr-btn"
                  onClick={() => setShowQrModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
                >
                  <QrCode className="w-4 h-4 text-indigo-400" />
                  <span>Ver QR Code para Conectar</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Formatted Paragraphs / Log */}
                {enhancedFullText !== null ? (
                  <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl">
                    <div className="flex items-center justify-between text-xs text-indigo-300 mb-2 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Texto Pontuado e Formatado por IA
                      </span>
                      <button
                        onClick={() => setEnhancedFullText(null)}
                        className="text-[11px] underline hover:text-white"
                      >
                        Ver Original
                      </button>
                    </div>
                    <p className={`text-slate-100 whitespace-pre-wrap ${fontClasses[fontSize]}`}>
                      {enhancedFullText}
                    </p>
                  </div>
                ) : (
                  transcriptions.map((item) => (
                    <div
                      key={item.id}
                      className="group relative p-3.5 bg-slate-900/70 hover:bg-slate-900 border border-slate-800 rounded-xl transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-slate-100 font-normal ${fontClasses[fontSize]}`}>
                          {item.text}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}

                {/* Live Interim Streaming Bubble */}
                {interimText && (
                  <div
                    id="interim-text-bubble"
                    className="p-3.5 bg-indigo-950/40 border border-indigo-500/40 rounded-xl text-indigo-200 animate-pulse"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                      <span>Ditando agora pelo Android:</span>
                    </div>
                    <p className={`font-normal ${fontClasses[fontSize]}`}>{interimText}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global PC Typer Modal */}
      <GlobalTyperModal
        isOpen={showGlobalTyperModal}
        onClose={() => setShowGlobalTyperModal(false)}
        pin={pin}
        localIps={localIps}
      />

      {/* QR Code Modal */}
      <QrCodeModal
        pin={pin}
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        localIps={localIps}
      />
    </div>
  );
};
