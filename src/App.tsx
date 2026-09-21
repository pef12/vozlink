import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceMode, TranscriptionRecord, WsMessage } from './types';
import { VozLinkSocket } from './utils/socket';
import { Navbar } from './components/Navbar';
import { DesktopView } from './components/DesktopView';
import { AndroidView } from './components/AndroidView';
import { SplitSimulationView } from './components/SplitSimulationView';

export default function App() {
  // Read initial role & pin from URL query if opened from QR code
  const [currentMode, setCurrentMode] = useState<DeviceMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const role = params.get('role');
      if (role === 'android') return 'android';
      if (role === 'desktop') return 'desktop';
      if (role === 'split') return 'split';
      // Detect mobile user agent default
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        return 'android';
      }
    }
    return 'desktop';
  });

  const urlPin = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('pin') || ''
    : '';

  // Core session state
  const [pin, setPin] = useState<string>(urlPin || '');
  const [isAndroidConnected, setIsAndroidConnected] = useState(false);
  const [androidDeviceName, setAndroidDeviceName] = useState('Celular Android');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [localIps, setLocalIps] = useState<string[]>([]);

  // Transcription state
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);
  const [interimText, setInterimText] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [androidPairSuccess, setAndroidPairSuccess] = useState(true);
  const [socketError, setSocketError] = useState<string>('');

  const socketRef = useRef<VozLinkSocket | null>(null);

  // Initialize network info and initial PIN from server
  useEffect(() => {
    // 1. Fetch network IPs
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.ips) setLocalIps(data.ips);
      })
      .catch((e) => console.warn('Could not fetch network info:', e));

    // 2. Fetch or create a session PIN if none
    if (!pin) {
      fetch('/api/session/create', { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          if (data.pin) {
            setPin(data.pin);
          }
        })
        .catch((e) => {
          console.warn('Fallback local pin generation:', e);
          const fallbackPin = Math.floor(100000 + Math.random() * 900000).toString();
          setPin(fallbackPin);
        });
    }
  }, []);

  // WebSocket message handler
  const handleWsMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'registered': {
        if (msg.pin) setPin(msg.pin);
        if (msg.androidConnected) setIsAndroidConnected(true);
        break;
      }

      case 'paired': {
        setIsAndroidConnected(true);
        setAndroidPairSuccess(true);
        if (msg.deviceName) setAndroidDeviceName(msg.deviceName);
        if (msg.pin) setPin(msg.pin);
        break;
      }

      case 'peer_disconnected': {
        setIsAndroidConnected(false);
        setAudioLevel(0);
        setInterimText('');
        break;
      }

      case 'speech_interim': {
        setInterimText(msg.text || '');
        break;
      }

      case 'speech_final': {
        if (msg.text && msg.text.trim()) {
          setTranscriptions((prev) => [
            ...prev,
            {
              id: msg.id || Math.random().toString(36).substring(2, 9),
              text: msg.text!.trim(),
              timestamp: msg.timestamp || Date.now(),
              isFinal: true,
              source: 'android',
            },
          ]);
          setInterimText('');
        }
        break;
      }

      case 'audio_level': {
        setAudioLevel(msg.level || 0);
        break;
      }

      case 'remote_command': {
        if (msg.command === 'clear') {
          setTranscriptions([]);
          setInterimText('');
        }
        break;
      }

      case 'error': {
        setSocketError(msg.message || 'Erro de comunicação');
        break;
      }
    }
  }, []);

  // Initialize VozLinkSocket
  useEffect(() => {
    const sock = new VozLinkSocket(handleWsMessage, (status) => {
      setConnectionStatus(status);
    });
    socketRef.current = sock;
    sock.connect();

    return () => {
      sock.disconnect();
    };
  }, [handleWsMessage]);

  // When PIN or mode changes, register with WebSocket
  useEffect(() => {
    if (!pin || !socketRef.current) return;

    if (currentMode === 'desktop' || currentMode === 'split') {
      socketRef.current.send({
        type: 'register_desktop',
        pin,
      });
      if (currentMode === 'split') {
        socketRef.current.send({
          type: 'register_android',
          pin,
          deviceName: 'Android (Simulador)',
        });
        setIsAndroidConnected(true);
      }
    }

    if (currentMode === 'android' && urlPin) {
      // If opened with a PIN in query, attempt auto-pair
      socketRef.current.send({
        type: 'register_android',
        pin: urlPin,
        deviceName: 'Celular Android',
      });
    }
  }, [pin, currentMode, urlPin]);

  // Send message helper
  const sendWsMessage = (msg: WsMessage) => {
    if (socketRef.current) {
      socketRef.current.send(msg);
    }
  };

  // Clear transcriptions
  const handleClearTranscriptions = () => {
    setTranscriptions([]);
    setInterimText('');
    sendWsMessage({
      type: 'remote_command',
      command: 'clear',
    });
  };

  // AI enhancement request
  const handleEnhanceWithAi = async (fullText: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText, language: 'pt-BR' }),
      });
      const data = await res.json();
      return data.enhancedText || null;
    } catch (e) {
      console.error('AI Enhance error:', e);
      return null;
    }
  };

  // Android pair success handler
  const handleAndroidPairSuccess = (verifiedPin: string) => {
    setPin(verifiedPin);
    setAndroidPairSuccess(true);
    setIsAndroidConnected(true);
    sendWsMessage({
      type: 'register_android',
      pin: verifiedPin,
      deviceName: 'Celular Android',
    });
  };

  // Android disconnect handler
  const handleAndroidDisconnect = () => {
    setAndroidPairSuccess(false);
    setIsAndroidConnected(false);
    setAudioLevel(0);
    setInterimText('');
    sendWsMessage({
      type: 'remote_command',
      command: 'pause',
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={(mode) => setCurrentMode(mode)}
        connectionStatus={connectionStatus}
        isAndroidConnected={isAndroidConnected}
        audioLevel={audioLevel}
      />

      {/* Main View Body */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {currentMode === 'desktop' && (
          <DesktopView
            pin={pin}
            isAndroidConnected={isAndroidConnected}
            androidDeviceName={androidDeviceName}
            transcriptions={transcriptions}
            interimText={interimText}
            audioLevel={audioLevel}
            onClearTranscriptions={handleClearTranscriptions}
            onEnhanceWithAi={handleEnhanceWithAi}
            localIps={localIps}
          />
        )}

        {currentMode === 'android' && (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6">
            <AndroidView
              initialPin={urlPin || pin}
              onSendWsMessage={sendWsMessage}
              isPaired={androidPairSuccess || isAndroidConnected}
              pairedPin={pin}
              onPairSuccess={handleAndroidPairSuccess}
              onDisconnect={handleAndroidDisconnect}
              lastError={socketError}
            />
          </div>
        )}

        {currentMode === 'split' && (
          <SplitSimulationView
            pin={pin}
            isAndroidConnected={isAndroidConnected}
            androidDeviceName={androidDeviceName}
            transcriptions={transcriptions}
            interimText={interimText}
            audioLevel={audioLevel}
            onClearTranscriptions={handleClearTranscriptions}
            onEnhanceWithAi={handleEnhanceWithAi}
            onSendWsMessage={sendWsMessage}
            isPaired={androidPairSuccess || isAndroidConnected}
            onPairSuccess={handleAndroidPairSuccess}
            onDisconnect={handleAndroidDisconnect}
            localIps={localIps}
          />
        )}
      </main>
    </div>
  );
}
