import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Wifi, Smartphone, CheckCircle, Copy, ExternalLink } from 'lucide-react';

interface QrCodeModalProps {
  pin: string;
  isOpen: boolean;
  onClose: () => void;
  localIps?: string[];
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ pin, isOpen, onClose, localIps = [] }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Connection URL with auto-pin query
  const targetUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?role=android&pin=${pin}`
    : '';

  useEffect(() => {
    if (isOpen && targetUrl) {
      QRCode.toDataURL(targetUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR Code:', err));
    }
  }, [isOpen, targetUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="qr-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="qr-modal-card"
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="close-qr-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-100">Conectar Celular Android</h3>
            <p className="text-xs text-slate-400">Escaneie o QR Code ou acerte o link</p>
          </div>
        </div>

        {/* QR Code display */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl mb-4 shadow-inner">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code de Conexão VozLink"
              className="w-56 h-56 rounded-lg"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-600">
              Gerando QR Code...
            </div>
          )}
          <div className="mt-2 text-center">
            <span className="text-xs font-medium text-slate-600">
              PIN de Verificação:
            </span>
            <div className="text-xl font-bold tracking-widest text-slate-900 font-mono">
              {pin.slice(0, 3)} {pin.slice(3)}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2.5 text-xs text-slate-300 mb-5">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
              1
            </div>
            <span>
              Certifique-se de que o <strong>Android e o PC</strong> estão conectados na <strong>mesma rede Wi-Fi</strong>.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
              2
            </div>
            <span>
              Abra a câmera do Android ou o navegador <strong>Chrome</strong> e aponte para o QR Code acima.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
              3
            </div>
            <span>
              O PIN será verificado automaticamente e o microfone do celular transmitirá em tempo real para esta tela!
            </span>
          </div>
        </div>

        {/* Direct Link button */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 truncate">
            <span className="truncate flex-1">{targetUrl}</span>
            <button
              id="copy-link-btn"
              onClick={handleCopyUrl}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors shrink-0 flex items-center gap-1"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <a
            id="open-android-tab-btn"
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Abrir Modo Celular em Nova Aba</span>
          </a>
        </div>
      </div>
    </div>
  );
};
