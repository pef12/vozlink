import React, { useState } from 'react';
import {
  X,
  Terminal,
  Download,
  Copy,
  Check,
  Monitor,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Cpu,
} from 'lucide-react';

interface GlobalTyperModalProps {
  isOpen: boolean;
  onClose: () => void;
  pin: string;
  localIps?: string[];
}

export const GlobalTyperModal: React.FC<GlobalTyperModalProps> = ({
  isOpen,
  onClose,
  pin,
  localIps = [],
}) => {
  const [activeTab, setActiveTab] = useState<'powershell' | 'python' | 'clipboard'>('powershell');
  const [copiedPs, setCopiedPs] = useState(false);
  const [copiedPy, setCopiedPy] = useState(false);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
  const baseUrl = `${protocol}://${currentHost}`;

  const psDownloadUrl = `/api/companion/powershell?pin=${pin}`;
  const pyDownloadUrl = `/api/companion/python?pin=${pin}`;

  const psCommand = `irm "${baseUrl}/api/companion/powershell?pin=${pin}" | iex`;
  const pyCommand = `python -c "import urllib.request; exec(urllib.request.urlopen('${baseUrl}/api/companion/python?pin=${pin}').read().decode('utf-8'))"`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div
      id="global-typer-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="global-typer-modal-content"
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Digitação no App em Destaque do PC
              </h3>
              <p className="text-xs text-slate-400">
                Insira o texto falado diretamente no Word, Bloco de Notas, WhatsApp, Discord, etc.
              </p>
            </div>
          </div>
          <button
            id="close-global-typer-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Concept Notice */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl mb-4 text-xs text-slate-300 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-100">Como funciona a injeção de texto externa:</span>
            <p className="text-slate-400 leading-relaxed">
              Por segurança, navegadores web não podem simular pressionamento de teclas em programas
              externos do Windows ou Mac. Para que o texto vá direto para a janela em foco (como o Bloco de
              Notas ou Word), disponibilizamos um assistente leve que conecta com seu PIN e digita no app
              ativo.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 mb-4">
          <button
            id="tab-powershell"
            onClick={() => setActiveTab('powershell')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'powershell'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Windows (PowerShell Nativo)</span>
          </button>

          <button
            id="tab-python"
            onClick={() => setActiveTab('python')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'python'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Python (Windows/Mac/Linux)</span>
          </button>

          <button
            id="tab-clipboard"
            onClick={() => setActiveTab('clipboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'clipboard'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>Área de Transferência</span>
          </button>
        </div>

        {/* Tab Content: PowerShell */}
        {activeTab === 'powershell' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300">
                  Opção 1: Executar Comando Direto no PowerShell
                </span>
                <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  Sem instalação
                </span>
              </div>
              <p className="text-slate-400">
                Abra o <strong>PowerShell</strong> no seu Windows, cole o comando abaixo e aperte <strong>Enter</strong>:
              </p>

              <div className="relative group">
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-200 overflow-x-auto whitespace-pre-wrap break-all">
                  {psCommand}
                </pre>
                <button
                  id="copy-ps-command-btn"
                  onClick={() => copyToClipboard(psCommand, setCopiedPs)}
                  className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                  {copiedPs ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">
                  Opção 2: Baixar o Arquivo .ps1
                </span>
                <a
                  id="download-ps-script-btn"
                  href={psDownloadUrl}
                  download="vozlink-digitar-pc.ps1"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar vozlink-digitar-pc.ps1</span>
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
                <li>Baixe o script acima (já vem configurado com seu PIN: <strong className="text-indigo-400">{pin}</strong>).</li>
                <li>Clique com o botão direito no arquivo baixado e selecione <em>"Executar com o PowerShell"</em>.</li>
                <li>Abra o <strong>Bloco de Notas</strong>, <strong>Word</strong> ou qualquer programa e clique para posicionar o cursor.</li>
                <li>Fale no celular Android: o texto será digitado automaticamente na janela ativa!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab Content: Python */}
        {activeTab === 'python' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300">
                  Assistente em Python (Windows, macOS e Linux)
                </span>
                <a
                  id="download-py-script-btn"
                  href={pyDownloadUrl}
                  download="vozlink-digitar-pc.py"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar vozlink-digitar-pc.py</span>
                </a>
              </div>
              <p className="text-slate-400">
                Requer Python 3 instalado. Ele instala automaticamente as bibliotecas <code>pyautogui</code> e <code>websocket-client</code> se necessário.
              </p>

              <div className="relative group">
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-200 overflow-x-auto whitespace-pre-wrap break-all">
                  python vozlink-digitar-pc.py
                </pre>
                <button
                  id="copy-py-command-btn"
                  onClick={() => copyToClipboard('python vozlink-digitar-pc.py', setCopiedPy)}
                  className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                  {copiedPy ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1 text-slate-400">
                <p className="font-medium text-slate-300">Como funciona:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Ele se conecta ao VozLink usando o PIN da sua sessão.</li>
                  <li>Usa a biblioteca nativa do sistema para digitar no aplicativo que você estiver usando no momento.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Clipboard */}
        {activeTab === 'clipboard' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <span className="font-semibold text-indigo-300">
                Modo Rápido: Sem Instalar Nada (Auto-Copiar)
              </span>
              <p className="text-slate-400 leading-relaxed">
                Se você não quer executar nenhum script ou terminal, você pode usar a função de
                <strong> Auto-Copiar para a Área de Transferência</strong> que já está ativada no VozLink!
              </p>

              <div className="space-y-2 text-slate-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>1. Mantenha a aba do VozLink aberta no seu navegador no PC.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>2. Fale no celular Android: a frase é imediatamente copiada para seu computador.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>3. No seu aplicativo em destaque (Word, Bloco de Notas, etc.), basta pressionar <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono">Ctrl + V</kbd>.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            id="close-modal-bottom-btn"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Entendido / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
