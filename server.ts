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
  desktopSockets?: Set<WebSocket>;
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

// Helper to determine WS base URL from request
function getWsUrlFromReq(req: express.Request): string {
  const host = req.headers.host || `localhost:${PORT}`;
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  return `${proto}://${host}/ws`;
}

// Windows PowerShell Companion Script (SendKeys auto-typing into foreground app)
app.get('/api/companion/powershell', (req, res) => {
  const pin = (req.query.pin as string) || '';
  const wsUrl = getWsUrlFromReq(req);

  const script = `# ==============================================================================
# VozLink - Assistente de Digitação no App em Destaque (Windows PowerShell)
# Digita automaticamente o texto recebido do celular Android no aplicativo ativo
# (Ex: Bloco de Notas, Microsoft Word, Navegador, WhatsApp, Discord, etc.)
# ==============================================================================

param (
    [string]$Pin = "${pin}",
    [string]$WsUrl = "${wsUrl}"
)

Add-Type -AssemblyName System.Windows.Forms

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       VOZLINK - DIGITAÇÃO NO APP EM DESTAQUE (PC)        " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Servidor : $WsUrl" -ForegroundColor Gray
Write-Host "PIN      : $Pin" -ForegroundColor Magenta
Write-Host ""
Write-Host "Conectando ao VozLink..." -ForegroundColor Gray

try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource
    $uri = New-Object System.Uri($WsUrl)
    $ws.ConnectAsync($uri, $cts.Token).Wait()

    # Registra no servidor como ouvinte do computador
    $regPayload = @{ type = "register_desktop"; pin = $Pin } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($regPayload)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()

    Write-Host ""
    Write-Host "[OK] CONECTADO COM SUCESSO AO VOZLINK!" -ForegroundColor Green
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "-> CLIQUE NO APLICATIVO EM QUE VOCÊ DESEJA DIGITAR" -ForegroundColor Yellow
    Write-Host "   (Ex: Abra o Bloco de Notas, Word, WhatsApp Web ou qualquer app)" -ForegroundColor White
    Write-Host "-> Fale no microfone do seu celular Android." -ForegroundColor Cyan
    Write-Host "-> O texto sera digitado automaticamente no cursor ativo!" -ForegroundColor Green
    Write-Host "-> Para fechar a qualquer momento, pressione Ctrl + C." -ForegroundColor Gray
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

    $buffer = New-Object byte[] 8192
    while ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $segRecv = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
        $res = $ws.ReceiveAsync($segRecv, $cts.Token).Result
        if ($res.Count -gt 0) {
            $msg = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $res.Count)
            try {
                $data = $msg | ConvertFrom-Json
                if ($data.type -eq "speech_final" -and $data.text) {
                    $spoken = $data.text.Trim()
                    Write-Host "[Inserindo]: $spoken" -ForegroundColor Green
                    # Tratar caracteres de escape do SendKeys do Windows ({, }, +, ^, %, ~, (, ))
                    $escaped = $spoken -replace '([\{\}\+\^\%~\(\)\[\]])', '{$1}'
                    [System.Windows.Forms.SendKeys]::SendWait($escaped + " ")
                }
            } catch {}
        }
    }
} catch {
    Write-Host "Erro de conexao: $_" -ForegroundColor Red
    Write-Host "Pressione qualquer tecla para sair..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="vozlink-digitar-pc.ps1"');
  res.send(script);
});

// Python Companion Script (pyautogui auto-typing)
app.get('/api/companion/python', (req, res) => {
  const pin = (req.query.pin as string) || '';
  const wsUrl = getWsUrlFromReq(req);

  const script = `# ==============================================================================
# VozLink - Assistente de Digitação no App em Destaque (Python)
# Digita automaticamente o texto recebido do celular Android no app em primeiro plano
# ==============================================================================
import json
import sys
import time

try:
    import websocket
    import pyautogui
except ImportError:
    print("Instalando dependencias necessarias (pyautogui, websocket-client)...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyautogui", "websocket-client"])
    import websocket
    import pyautogui

PIN = "${pin}"
WS_URL = "${wsUrl}"

print("=" * 60)
print("     VOZLINK - DIGITAÇÃO NO APLICATIVO EM DESTAQUE (PC)")
print("=" * 60)
print(f"PIN configurado: {PIN}")
print(f"Conectando a   : {WS_URL}")
print("-> Clique no aplicativo ou campo onde deseja inserir o texto!")
print("-> Pressione Ctrl + C para encerrar.")
print("-" * 60)

def on_message(ws, message):
    try:
        data = json.loads(message)
        if data.get("type") == "speech_final":
            text = data.get("text", "").strip()
            if text:
                print(f"[Inserindo no app ativo]: {text}")
                pyautogui.write(text + " ", interval=0.01)
    except Exception as e:
        print(f"Erro: {e}")

def on_open(ws):
    print("[Conectado com sucesso! Registrando sessao...]")
    ws.send(json.dumps({"type": "register_desktop", "pin": PIN}))
    print("Pronto! Fale no microfone do celular Android.")

def on_error(ws, error):
    print(f"Erro de comunicacao: {error}")

def on_close(ws, close_status_code, close_msg):
    print("Conexao encerrada. Reconectando em 3s...")
    time.sleep(3)
    start()

def start():
    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    ws.run_forever()

if __name__ == "__main__":
    start()
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="vozlink-digitar-pc.py"');
  res.send(script);
});

// Helper to broadcast to all desktop connections of a session
function broadcastToDesktop(sess: Session, payload: string) {
  if (sess.desktopSockets && sess.desktopSockets.size > 0) {
    for (const ws of sess.desktopSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  } else if (sess.desktopWs && sess.desktopWs.readyState === WebSocket.OPEN) {
    sess.desktopWs.send(payload);
  }
}

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
              desktopSockets: new Set([ws]),
              createdAt: Date.now(),
            });
          } else {
            const sess = sessions.get(pin)!;
            sess.desktopWs = ws;
            if (!sess.desktopSockets) sess.desktopSockets = new Set();
            sess.desktopSockets.add(ws);
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
          broadcastToDesktop(
            session,
            JSON.stringify({
              type: 'paired',
              pin,
              deviceName,
              role: 'desktop',
            })
          );
          break;
        }

        case 'speech_interim': {
          // Android speaking -> relay live text to Desktop
          if (currentPin) {
            const sess = sessions.get(currentPin);
            if (sess) {
              broadcastToDesktop(
                sess,
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
            if (sess) {
              broadcastToDesktop(
                sess,
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
            if (sess) {
              broadcastToDesktop(
                sess,
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
            if (role === 'desktop') {
              if (sess?.androidWs && sess.androidWs.readyState === WebSocket.OPEN) {
                sess.androidWs.send(
                  JSON.stringify({
                    type: 'remote_command',
                    command: message.command,
                  })
                );
              }
            } else if (sess) {
              broadcastToDesktop(
                sess,
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
        broadcastToDesktop(
          sess,
          JSON.stringify({
            type: 'peer_disconnected',
            peer: 'android',
          })
        );
      } else if (role === 'desktop') {
        sess.desktopSockets?.delete(ws);
        if (sess.desktopSockets?.size === 0) {
          sess.desktopWs = undefined;
        }
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
