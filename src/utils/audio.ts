/**
 * Audio and Speech Recognition utilities for Android to PC voice streaming.
 */

// Define SpeechRecognition interface for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class SpeechStreamer {
  private recognition: any = null;
  private isRecording = false;
  private shouldRestart = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  public onInterimText?: (text: string) => void;
  public onFinalText?: (text: string) => void;
  public onAudioLevel?: (level: number) => void;
  public onError?: (error: string) => void;
  public onStateChange?: (recording: boolean) => void;

  private language = 'pt-BR';

  constructor(language: string = 'pt-BR') {
    this.language = language;
  }

  public setLanguage(lang: string) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as any;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public async start(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.onError?.('Reconhecimento de voz não suportado neste navegador. Use o Chrome ou Edge no Android.');
      return false;
    }

    try {
      // 1. Initialize microphone stream for audio level metering
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.microphoneStream = stream;
        this.setupAudioMeter(stream);
      } catch (err) {
        console.warn('Microphone audioContext could not be initialized for meter:', err);
      }

      // 2. Initialize SpeechRecognition
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;
      this.recognition.maxAlternatives = 1;

      this.shouldRestart = true;
      this.isRecording = true;
      this.onStateChange?.(true);

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript.trim() && this.onInterimText) {
          this.onInterimText(interimTranscript);
        }

        if (finalTranscript.trim() && this.onFinalText) {
          this.onFinalText(finalTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.shouldRestart = false;
          this.onError?.('Permissão de microfone negada. Permita o acesso ao microfone nas configurações do navegador.');
          this.stop();
        } else if (event.error === 'network') {
          this.onError?.('Erro de conexão no serviço de voz.');
        }
      };

      this.recognition.onend = () => {
        // SpeechRecognition frequently auto-ends on mobile when silent. Restart if still recording.
        if (this.shouldRestart && this.isRecording) {
          try {
            this.recognition?.start();
          } catch (e) {
            // Already started or restarting
          }
        } else {
          this.isRecording = false;
          this.onStateChange?.(false);
        }
      };

      this.recognition.start();
      return true;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      this.onError?.(err.message || 'Falha ao iniciar microfone.');
      this.stop();
      return false;
    }
  }

  private setupAudioMeter(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastSent = 0;

      const updateMeter = () => {
        if (!this.analyser || !this.isRecording) return;

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(1, Math.round((avg / 128) * 100) / 100);

        const now = Date.now();
        // Throttle meter updates to ~15 fps (60ms) to avoid socket flood
        if (now - lastSent > 60) {
          this.onAudioLevel?.(normalized);
          lastSent = now;
        }

        this.animFrameId = requestAnimationFrame(updateMeter);
      };

      this.animFrameId = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.warn('Could not setup audio meter:', e);
    }
  }

  public stop() {
    this.shouldRestart = false;
    this.isRecording = false;
    this.onStateChange?.(false);

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.onAudioLevel?.(0);
  }

  public isActive(): boolean {
    return this.isRecording;
  }
}

/**
 * Screen Wake Lock utility to keep phone screen awake while using as microphone
 */
export async function requestWakeLock(): Promise<{ release: () => void } | null> {
  if ('wakeLock' in navigator && (navigator as any).wakeLock) {
    try {
      const lock = await (navigator as any).wakeLock.request('screen');
      return {
        release: () => {
          lock.release().catch(() => {});
        },
      };
    } catch (err) {
      console.warn('WakeLock not granted:', err);
    }
  }
  return null;
}
