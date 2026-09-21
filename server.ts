import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

interface Session {
  pin: string;
  sessionId: string;
  desktopWs?: WebSocket;
  androidWs?: WebSocket;
  createdAt: number;
  androidDeviceName?: string;
}

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// In-memory sessions store
const sessions = new Map<string, Session>();

// Helper to generate a secure random 6-digit PIN
function generatePin(): string {
  let pin: string;
  let attempts = 0;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
  } while (sessions.has(pin) && attempts < 100);
  return pin;
}

// Cleanup stale sessions (older than 6 hours)
setInterval(() => {
  const now = Date.now();
  for (const [pin, sess] of sessions.entries()) {
    if (now - sess.createdAt > 6 * 60 * 60 * 1000 && !sess.desktopWs && !sess.androidWs) {
      sessions.delete(pin);
    }
  }
}, 30 * 60 * 1000);

// Get local IPv4 addresses to show user for same-network connection
function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      // IPv4 and not internal loopback (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Lazy Gemini AI initialization
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ---------------- API ROUTES ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeSessions: sessions.size, timestamp: Date.now() });
});

// Network information for Wi-Fi / LAN pairing
app.get('/api/network-info', (req, res) => {
  const ips = getLocalIpAddresses();
  res.json({
    ips,
    port: PORT,
    appUrl: process.env.APP_URL || null,
  });
});

// Create new desktop session
app.post('/api/session/create', (req, res) => {
  const pin = generatePin();
  const sessionId = 'sess_' + Math.random().toString(36).substring(2, 11);
  const session: Session = {
    pin,
    sessionId,
    createdAt: Date.now(),
  };
  sessions.set(pin, session);

  res.json({
    success: true,
    pin,
    sessionId,
    localIps: getLocalIpAddresses(),
  });
});

// Verify PIN from Android
app.post('/api/session/verify', (req, res) => {
  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ valid: false, message: 'PIN é obrigatório.' });
  }

  const cleanPin = pin.replace(/\s+/g, '');
  const session = sessions.get(cleanPin);

  if (!session) {
    return res.status(404).json({
      valid: false,
      message: 'Código PIN não encontrado. Verifique o código exibido na tela do computador.',
    });
  }

  res.json({
    valid: true,
    sessionId: session.sessionId,
    pin: session.pin,
  });
});

// AI punctuation & transcription refinement using Gemini 2.5 Flash
app.post('/api/ai/enhance', async (req, res) => {
  const { text, language = 'pt-BR' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Texto não fornecido' });
  }

  try {
    const ai = getAiClient();
    if (!ai) {
      // Graceful fallback if key not configured
      return res.json({
        enhancedText: text.trim().replace(/^\w/, (c) => c.toUpperCase()) + '.',
        aiPowered: false,
      });
    }

    const prompt = `Você é um assistente de transcrição de voz para texto de alta fidelidade.
Melhore o seguinte texto ditado por voz em ${language}:
1. Corrija pontuação (vírgulas, pontos finais, interrogações).
2. Corrija letras maiúsculas no início de frases ou nomes próprios.
3. Remova repetições gagas acidentais mantendo exatamente o significado original.
4. Mantenha o texto estritamente em ${language}.
5. Retorne APENAS o texto aprimorado final, sem introdução, explicações ou aspas.

Texto ditado:
"${text}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const enhancedText = response.text ? response.text.trim() : text;
    res.json({ enhancedText, aiPowered: true });
  } catch (error) {
    console.error('Error in Gemini enhancement:', error);
    res.json({
      enhancedText: text.trim().replace(/^\w/, (c) => c.toUpperCase()) + '.',
      aiPowered: false,
    });
  }
});

// ---------------- WEBSOCKET REALTIME SERVER ----------------

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let currentPin: string | null = null;
  let role: 'desktop' | 'android' | null = null;

  ws.on('message', (data: Buffer | string) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'register_desktop': {
          let pin = message.pin ? message.pin.replace(/\s+/g, '') : null;
          if (!pin || !sessions.has(pin)) {
            pin = generatePin();
            const sessionId = 'sess_' + Math.random().toString(36).substring(2, 11);
            sessions.set(pin, {
              pin,
              sessionId,
              desktopWs: ws,
              createdAt: Date.now(),
            });
          } else {
            const sess = sessions.get(pin)!;
            sess.desktopWs = ws;
          }

          currentPin = pin;
          role = 'desktop';

          const sess = sessions.get(pin)!;
          ws.send(
            JSON.stringify({
              type: 'registered',
              pin,
              sessionId: sess.sessionId,
              androidConnected: !!sess.androidWs && sess.androidWs.readyState === WebSocket.OPEN,
            })
          );
          break;
        }

        case 'register_android': {
          const pin = message.pin ? message.pin.replace(/\s+/g, '') : '';
          const deviceName = message.deviceName || 'Dispositivo Android';

          const session = sessions.get(pin);
          if (!session) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Código PIN inválido ou sessão não encontrada no computador.',
              })
            );
            return;
          }

          session.androidWs = ws;
          session.androidDeviceName = deviceName;
          currentPin = pin;
          role = 'android';

          // Notify Android of successful pairing
          ws.send(
            JSON.stringify({
              type: 'paired',
              pin,
              sessionId: session.sessionId,
              role: 'android',
            })
          );

          // Notify Desktop that Android joined
          if (session.desktopWs && session.desktopWs.readyState === WebSocket.OPEN) {
            session.desktopWs.send(
              JSON.stringify({
                type: 'paired',
                pin,
                deviceName,
                role: 'desktop',
              })
            );
          }
          break;
        }

        case 'speech_interim': {
          // Android speaking -> relay live text to Desktop
          if (currentPin) {
            const sess = sessions.get(currentPin);
            if (sess?.desktopWs && sess.desktopWs.readyState === WebSocket.OPEN) {
              sess.desktopWs.send(
                JSON.stringify({
                  type: 'speech_interim',
                  text: message.text || '',
                  timestamp: Date.now(),
                })
              );
            }
          }
          break;
        }

        case 'speech_final': {
          // Android finalized sentence -> relay to Desktop
          if (currentPin) {
            const sess = sessions.get(currentPin);
            if (sess?.desktopWs && sess.desktopWs.readyState === WebSocket.OPEN) {
              sess.desktopWs.send(
                JSON.stringify({
                  type: 'speech_final',
                  id: message.id || Math.random().toString(36).substring(2, 9),
                  text: message.text || '',
                  timestamp: message.timestamp || Date.now(),
                })
              );
            }
          }
          break;
        }

        case 'audio_level': {
          // Live microphone amplitude meter
          if (currentPin) {
            const sess = sessions.get(currentPin);
            if (sess?.desktopWs && sess.desktopWs.readyState === WebSocket.OPEN) {
              sess.desktopWs.send(
                JSON.stringify({
                  type: 'audio_level',
                  level: message.level || 0,
                })
              );
            }
          }
          break;
        }

        case 'remote_command': {
          // Desktop sends command (e.g. clear, pause, toggle_mic) -> relay to Android or vice-versa
          if (currentPin) {
            const sess = sessions.get(currentPin);
            const target = role === 'desktop' ? sess?.androidWs : sess?.desktopWs;
            if (target && target.readyState === WebSocket.OPEN) {
              target.send(
                JSON.stringify({
                  type: 'remote_command',
                  command: message.command,
                })
              );
            }
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (currentPin && sessions.has(currentPin)) {
      const sess = sessions.get(currentPin)!;
      if (role === 'android') {
        sess.androidWs = undefined;
        if (sess.desktopWs && sess.desktopWs.readyState === WebSocket.OPEN) {
          sess.desktopWs.send(
            JSON.stringify({
              type: 'peer_disconnected',
              peer: 'android',
            })
          );
        }
      } else if (role === 'desktop') {
        sess.desktopWs = undefined;
        if (sess.androidWs && sess.androidWs.readyState === WebSocket.OPEN) {
          sess.androidWs.send(
            JSON.stringify({
              type: 'peer_disconnected',
              peer: 'desktop',
            })
          );
        }
      }
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket connection error:', err);
  });
});

// ---------------- FRONTEND INTEGRATION ----------------

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`VozLink Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
