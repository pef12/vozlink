import React, { useState } from 'react';
import {
  Mic,
  Monitor,
  Smartphone,
  Columns,
  HelpCircle,
  Wifi,
  ShieldCheck,
  X,
} from 'lucide-react';
import { DeviceMode } from '../types';

interface NavbarProps {
  currentMode: DeviceMode;
  onSelectMode: (mode: DeviceMode) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isAndroidConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  connectionStatus,
  isAndroidConnected,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <header
        id="app-navbar"
        className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shrink-0 z-30"
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm tracking-tight text-white">VozLink</h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Android ⇄ PC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Microfone sem fio com transcrição por PIN
              </p>
            </div>
          </div>

          {/* Device Mode Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              id="nav-mode-desktop"
              onClick={() => onSelectMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentMode === 'desktop'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Computador</span>
            </button>

            <button
              id="nav-mode-android"
              onClick={() => onSelectMode('android')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentMode === 'android'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Celular Android</span>
            </button>

            <button
              id="nav-mode-split"
              onClick={() => onSelectMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentMode === 'split'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Testar celular e computador lado a lado"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simulador</span>
            </button>
          </div>

          {/* Right Help button & Status */}
          <div className="flex items-center gap-2">
            <button
              id="help-guide-btn"
              onClick={() => setShowHelp(true)}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors"
              title="Como conectar na mesma rede"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div
          id="help-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowHelp(false)}
        >
          <div
            id="help-modal-card"
            className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="close-help-btn"
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-100">Como funciona o VozLink</h3>
                <p className="text-xs text-slate-400">
                  Conexão segura na mesma rede local (Wi-Fi)
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed mb-6">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3">
                <Wifi className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-200 mb-0.5">1. Mesma Rede Wi-Fi</h4>
                  <p className="text-slate-400">
                    O computador e o celular Android precisam estar conectados na mesma rede Wi-Fi local ou acessar o mesmo endereço de servidor na web.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-200 mb-0.5">2. Verificação por Código PIN</h4>
                  <p className="text-slate-400">
                    O computador gera um código PIN exclusivo de 6 dígitos. Digite este código no celular Android ou aponte a câmera para o QR Code para parear instantaneamente.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3">
                <Mic className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-200 mb-0.5">
                    3. Microfone e Transcrição em Tempo Real
                  </h4>
                  <p className="text-slate-400">
                    Ao falar no celular Android, o áudio é processado e as palavras são enviadas via WebSocket com latência ultrabaixa diretamente para a tela do computador.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="confirm-help-btn"
              onClick={() => setShowHelp(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
