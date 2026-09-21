import React, { useState, useRef, useEffect } from 'react';
import {
  Keyboard,
  Copy,
  Check,
  Trash2,
  Sparkles,
  CornerDownLeft,
  Settings2,
  CheckCircle2,
  Terminal,
  FileText,
  MessageSquare,
  Search,
} from 'lucide-react';

interface ActiveInputFieldProps {
  incomingFinalText: string;
  incomingInterimText: string;
  isAndroidConnected: boolean;
  onEnhanceWithAi: (text: string) => Promise<string | null>;
  onOpenGlobalTyperModal: () => void;
  pin: string;
}

export const ActiveInputField: React.FC<ActiveInputFieldProps> = ({
  incomingFinalText,
  incomingInterimText,
  isAndroidConnected,
  onEnhanceWithAi,
  onOpenGlobalTyperModal,
}) => {
  // Target app type simulation
  const [targetType, setTargetType] = useState<'document' | 'chat' | 'input'>('document');
  const [content, setContent] = useState(
    'Clique aqui para colocar este campo em destaque. Conforme você falar no celular Android, o texto será inserido automaticamente no cursor!'
  );
  const [copied, setCopied] = useState(false);
  const [autoSpace, setAutoSpace] = useState(true);
  const [autoNewline, setAutoNewline] = useState(false);
  const [autoClipboard, setAutoClipboard] = useState(true);
  const [capitalizeFirst, setCapitalizeFirst] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [lastInsertedText, setLastInsertedText] = useState('');
  const [lastInsertTime, setLastInsertTime] = useState<number | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Caret position tracking
  const [caretPos, setCaretPos] = useState({ start: 0, end: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep track of the last processed final text
  const lastProcessedTextRef = useRef<string>('');

  // Handle caret update on user selection or click
  const updateCaretPosition = () => {
    const activeEl = document.activeElement;
    if (activeEl === textareaRef.current && textareaRef.current) {
      setCaretPos({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      });
    } else if (activeEl === inputRef.current && inputRef.current) {
      setCaretPos({
        start: inputRef.current.selectionStart || 0,
        end: inputRef.current.selectionEnd || 0,
      });
    }
  };

  // Insert incoming speech directly into active field at caret
  useEffect(() => {
    if (!incomingFinalText || incomingFinalText === lastProcessedTextRef.current) {
      return;
    }

    lastProcessedTextRef.current = incomingFinalText;

    let textToInsert = incomingFinalText.trim();
    if (capitalizeFirst && textToInsert.length > 0) {
      textToInsert = textToInsert.charAt(0).toUpperCase() + textToInsert.slice(1);
    }

    // Auto-copy to OS clipboard if enabled
    if (autoClipboard && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToInsert).catch(() => {});
    }

    setLastInsertedText(textToInsert);
    setLastInsertTime(Date.now());

    // Check if target is textarea or input
    if (targetType === 'input') {
      const el = inputRef.current;
      if (el) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const currentVal = el.value;
        const needsSpaceBefore = autoSpace && start > 0 && currentVal.charAt(start - 1) !== ' ';
        const spaceBefore = needsSpaceBefore ? ' ' : '';
        const spaceAfter = autoSpace ? ' ' : '';
        const fullInsert = `${spaceBefore}${textToInsert}${spaceAfter}`;

        const newVal = currentVal.substring(0, start) + fullInsert + currentVal.substring(end);
        setContent(newVal);

        // Restore caret after insertion
        requestAnimationFrame(() => {
          if (inputRef.current) {
            const newPos = start + fullInsert.length;
            inputRef.current.selectionStart = newPos;
            inputRef.current.selectionEnd = newPos;
            inputRef.current.focus();
            setCaretPos({ start: newPos, end: newPos });
          }
        });
        return;
      }
    }

    // Document or Chat textarea
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const currentVal = el.value;

      const needsSpaceBefore =
        autoSpace &&
        start > 0 &&
        currentVal.charAt(start - 1) !== ' ' &&
        currentVal.charAt(start - 1) !== '\n';

      const prefix = needsSpaceBefore ? ' ' : '';
      const suffix = autoNewline ? '\n' : autoSpace ? ' ' : '';
      const fullInsert = `${prefix}${textToInsert}${suffix}`;

      const newVal = currentVal.substring(0, start) + fullInsert + currentVal.substring(end);
      setContent(newVal);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newPos = start + fullInsert.length;
          textareaRef.current.selectionStart = newPos;
          textareaRef.current.selectionEnd = newPos;
          textareaRef.current.focus();
          setCaretPos({ start: newPos, end: newPos });
        }
      });
    } else {
      // If ref is not active, just append
      setContent((prev) => {
        const space = autoSpace && prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
        const ending = autoNewline ? '\n' : ' ';
        return prev + space + textToInsert + ending;
      });
    }
  }, [incomingFinalText, autoSpace, autoNewline, autoClipboard, capitalizeFirst, targetType]);

  const handleCopyContent = () => {
    if (!content.trim()) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setContent('');
    if (textareaRef.current) textareaRef.current.focus();
    if (inputRef.current) inputRef.current.focus();
  };

  const handleEnhance = async () => {
    if (!content.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await onEnhanceWithAi(content);
      if (enhanced) {
        setContent(enhanced);
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div id="active-input-field-wrapper" className="flex flex-col h-full space-y-3">
      {/* Top Banner: In-Focus Status & Target App Preset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl">
        {/* Left: Active Focus Badge */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span
              className={`w-3 h-3 rounded-full block transition-all ${
                isFocused
                  ? 'bg-emerald-400 ring-4 ring-emerald-400/20 animate-pulse'
                  : 'bg-indigo-400 ring-2 ring-indigo-400/30'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
                Campo de Texto em Destaque
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  isFocused
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {isFocused ? 'Em Foco Ativo (Cursor Pronto)' : 'Clique no campo para focar'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              O áudio recebido do celular Android é digitado automaticamente na posição do cursor
            </p>
          </div>
        </div>

        {/* Right: Target App Preset Picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Simular App:</span>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              id="preset-document-btn"
              onClick={() => setTargetType('document')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                targetType === 'document'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Editor / Documento</span>
            </button>
            <button
              id="preset-chat-btn"
              onClick={() => setTargetType('chat')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                targetType === 'chat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>Chat / Mensagem</span>
            </button>
            <button
              id="preset-input-btn"
              onClick={() => setTargetType('input')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                targetType === 'input'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3 h-3" />
              <span>Entrada Rápida</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Focusable Input Area */}
      <div
        id="active-target-container"
        className={`relative flex-1 flex flex-col bg-slate-950 border rounded-2xl transition-all duration-200 overflow-hidden shadow-inner ${
          isFocused
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Mock Window Titlebar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            <span className="font-mono text-slate-300 ml-2">
              {targetType === 'document' && 'Bloco de Notas / Editor Ativo'}
              {targetType === 'chat' && 'Aplicativo de Chat em Destaque'}
              {targetType === 'input' && 'Campo de Formulário em Destaque'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {lastInsertTime && (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3 h-3" />
                Texto inserido às {new Date(lastInsertTime).toLocaleTimeString()}
              </span>
            )}
            <span className="font-mono text-slate-500">
              Posição: {caretPos.start}:{caretPos.end}
            </span>
          </div>
        </div>

        {/* Input Surface */}
        <div className="flex-1 relative flex flex-col p-4">
          {targetType === 'input' ? (
            <div className="flex-1 flex flex-col justify-center">
              <label className="text-xs text-slate-400 mb-1.5 font-medium">
                Digite ou fale no celular para preencher este campo:
              </label>
              <input
                ref={inputRef}
                id="active-highlight-input"
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onSelect={updateCaretPosition}
                onClick={updateCaretPosition}
                onKeyUp={updateCaretPosition}
                placeholder="Clique aqui para manter o foco e fale no celular..."
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-base focus:outline-none focus:border-indigo-500 font-normal shadow-sm"
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              id="active-highlight-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSelect={updateCaretPosition}
              onClick={updateCaretPosition}
              onKeyUp={updateCaretPosition}
              placeholder="Clique neste campo para deixá-lo em foco ativo. Tudo o que você falar no celular Android será digitado aqui na posição do cursor..."
              className="w-full flex-1 min-h-[220px] bg-transparent resize-none text-slate-100 placeholder-slate-500 text-base leading-relaxed focus:outline-none font-normal"
            />
          )}

          {/* Live Interim Ghost Preview when user is speaking right now */}
          {incomingInterimText && (
            <div
              id="live-interim-ghost"
              className="mt-2 p-2.5 bg-indigo-950/40 border border-indigo-500/40 rounded-xl flex items-center gap-2 text-indigo-300 text-sm animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="font-semibold text-xs text-indigo-400">Falando agora no Android:</span>
              <span className="italic text-slate-200">"{incomingInterimText}"</span>
              <span className="text-[10px] text-indigo-400/80 ml-auto">(será inserido ao pausar a fala)</span>
            </div>
          )}
        </div>

        {/* Action Bottom Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 text-xs">
          {/* Insertion Options */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none hover:text-white">
              <input
                type="checkbox"
                checked={autoSpace}
                onChange={(e) => setAutoSpace(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Espaço automático</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none hover:text-white">
              <input
                type="checkbox"
                checked={autoNewline}
                onChange={(e) => setAutoNewline(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Pular linha (Enter)</span>
            </label>

            <label
              className="flex items-center gap-1.5 cursor-pointer text-indigo-300 select-none hover:text-indigo-200"
              title="Copia cada frase automaticamente para a área de transferência do Windows/PC"
            >
              <input
                type="checkbox"
                checked={autoClipboard}
                onChange={(e) => setAutoClipboard(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-indigo-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Auto-copiar p/ Clipboard</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              id="active-field-ai-btn"
              onClick={handleEnhance}
              disabled={isEnhancing || !content.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white rounded-lg font-medium shadow-sm transition-all"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
              <span>{isEnhancing ? 'Pontuando...' : 'Pontuar com IA'}</span>
            </button>

            <button
              id="active-field-copy-btn"
              onClick={handleCopyContent}
              disabled={!content.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg font-medium transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Tudo</span>
                </>
              )}
            </button>

            <button
              id="active-field-clear-btn"
              onClick={handleClear}
              disabled={!content.trim()}
              className="p-1.5 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 disabled:opacity-40 text-slate-400 rounded-lg transition-colors"
              title="Limpar campo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Info Card: How to type in external OS windows (Word, Notepad, etc.) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-xs">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <span className="font-semibold text-slate-200">
              Deseja digitar em outros programas do PC (Word, Bloco de Notas, WhatsApp Desktop)?
            </span>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Execute o assistente leve em PowerShell ou Python para injetar texto automaticamente em qualquer janela em destaque no Windows/Mac.
            </p>
          </div>
        </div>

        <button
          id="open-global-typer-btn"
          onClick={onOpenGlobalTyperModal}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium whitespace-nowrap shadow-sm transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Ver Instruções / Scripts</span>
        </button>
      </div>
    </div>
  );
};
