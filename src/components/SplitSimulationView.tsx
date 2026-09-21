import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import { DesktopView } from './DesktopView';
import { AndroidView } from './AndroidView';
import { TranscriptionRecord, WsMessage } from '../types';

interface SplitSimulationViewProps {
  pin: string;
  isAndroidConnected: boolean;
  androidDeviceName?: string;
  transcriptions: TranscriptionRecord[];
  interimText: string;
  audioLevel: number;
  onClearTranscriptions: () => void;
  onEnhanceWithAi: (fullText: string) => Promise<string | null>;
  onSendWsMessage: (msg: WsMessage) => void;
  isPaired: boolean;
  onPairSuccess: (pin: string) => void;
  onDisconnect: () => void;
  localIps?: string[];
}

export const SplitSimulationView: React.FC<SplitSimulationViewProps> = ({
  pin,
  isAndroidConnected,
  androidDeviceName,
  transcriptions,
  interimText,
  audioLevel,
  onClearTranscriptions,
  onEnhanceWithAi,
  onSendWsMessage,
  isPaired,
  onPairSuccess,
  onDisconnect,
  localIps = [],
}) => {
  return (
    <div id="split-simulation-container" className="flex flex-col lg:flex-row h-full w-full gap-4 p-3 md:p-5">
      {/* Left side: Simulated Android Phone Device Chassis */}
      <div className="w-full lg:w-[380px] shrink-0 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-indigo-400">
          <Smartphone className="w-4 h-4" />
          <span>Celular Android (Microfone Sem Fio)</span>
        </div>

        {/* Mobile Phone Mockup Bezel */}
        <div className="w-full max-w-[360px] h-[650px] bg-slate-950 border-4 border-slate-800 rounded-[42px] p-3 shadow-2xl relative flex flex-col overflow-hidden">
          {/* Top Speaker / Camera Notch */}
          <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2" />
            <span className="w-8 h-1 bg-slate-700 rounded-full" />
          </div>

          {/* Android screen contents */}
          <div className="flex-1 overflow-y-auto rounded-[32px] bg-slate-950 flex flex-col">
            <AndroidView
              initialPin={pin}
              onSendWsMessage={onSendWsMessage}
              isPaired={isPaired ?? true}
              pairedPin={pin}
              onPairSuccess={onPairSuccess}
              onDisconnect={onDisconnect}
            />
          </div>

          {/* Bottom Home Indicator Bar */}
          <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-2 shrink-0" />
        </div>
      </div>

      {/* Right side: Desktop Computer Screen */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-300">
          <Monitor className="w-4 h-4 text-emerald-400" />
          <span>Computador (Receptor & Transcrição)</span>
        </div>

        <div className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col">
          <DesktopView
            pin={pin}
            isAndroidConnected={isAndroidConnected}
            androidDeviceName={androidDeviceName}
            transcriptions={transcriptions}
            interimText={interimText}
            audioLevel={audioLevel}
            onClearTranscriptions={onClearTranscriptions}
            onEnhanceWithAi={onEnhanceWithAi}
            localIps={localIps}
          />
        </div>
      </div>
    </div>
  );
};
