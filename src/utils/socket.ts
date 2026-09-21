import { WsMessage } from '../types';

export class VozLinkSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: any = null;
  private shouldReconnect = true;
  private onMessageCallback: (msg: WsMessage) => void;
  private onStatusChangeCallback: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

  constructor(
    onMessage: (msg: WsMessage) => void,
    onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  public connect() {
    this.shouldReconnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.onStatusChangeCallback('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.onStatusChangeCallback('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WsMessage = JSON.parse(event.data);
          this.onMessageCallback(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        this.onStatusChangeCallback('disconnected');
        if (this.shouldReconnect) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 2000);
        }
      };

      this.ws.onerror = () => {
        this.onStatusChangeCallback('error');
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
      this.onStatusChangeCallback('error');
    }
  }

  public send(msg: WsMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('Cannot send message, WebSocket not connected:', msg.type);
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChangeCallback('disconnected');
  }

  public isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
