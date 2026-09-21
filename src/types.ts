export type DeviceMode = 'desktop' | 'android' | 'split';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SessionData {
  pin: string;
  sessionId: string;
  createdAt: number;
  desktopConnected: boolean;
  androidConnected: boolean;
  androidDeviceName?: string;
  networkIps?: string[];
}

export interface TranscriptionRecord {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  refinedText?: string;
  source: 'android' | 'local';
}

export interface WsMessage {
  type: 
    | 'register_desktop'
    | 'register_android'
    | 'registered'
    | 'paired'
    | 'peer_disconnected'
    | 'speech_interim'
    | 'speech_final'
    | 'audio_level'
    | 'remote_command'
    | 'error'
    | 'ping'
    | 'pong';
  pin?: string;
  sessionId?: string;
  text?: string;
  id?: string;
  timestamp?: number;
  level?: number;
  deviceName?: string;
  message?: string;
  command?: 'clear' | 'toggle_mic' | 'pause' | 'resume';
  androidConnected?: boolean;
}
