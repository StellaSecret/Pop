const soundUrl = (name: string): string => `${import.meta.env.BASE_URL}sounds/${name}.mp3`;
const SOUND_URLS = [soundUrl("balloon-pop-1"), soundUrl("balloon-pop-2")] as const;
const MAX_VOICES = 16;

export type AudioStatus = "loading" | "ok" | "partial" | "error" | "unsupported";

/**
 * Web Audio playback for the real balloon-pop recordings.
 * Every pop uses a fresh `AudioBufferSourceNode`, so simultaneous pops never
 * cut each other off. Voices are capped to avoid flooding the audio graph.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: (AudioBuffer | undefined)[] = [];
  private failedUrls: string[] = [];
  private statusValue: AudioStatus = "loading";
  private volume = 0.7;
  private enabled = true;
  private nextBuffer = 0;
  private activeVoices = 0;

  get status(): AudioStatus {
    return this.statusValue;
  }

  get loadedCount(): number {
    return this.buffers.filter(Boolean).length;
  }

  get errorMessage(): string {
    switch (this.statusValue) {
      case "unsupported":
        return "Web Audio non pris en charge par ce navigateur.";
      case "error":
        return "Échec du chargement audio (sons désactivés).";
      case "partial":
        return `Son partiel : ${this.failedUrls.length} fichier(s) indisponible(s).`;
      default:
        return "";
    }
  }

  async load(): Promise<void> {
    const AudioCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      this.statusValue = "unsupported";
      return;
    }

    try {
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
      this.master = null;
      this.statusValue = "error";
      return;
    }

    await Promise.all(
      SOUND_URLS.map(async (url, index) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const bytes = await response.arrayBuffer();
          this.buffers[index] = await this.context!.decodeAudioData(bytes);
        } catch {
          this.failedUrls.push(url);
        }
      }),
    );

    const loaded = this.loadedCount;
    this.statusValue = loaded === 0 ? "error" : loaded === SOUND_URLS.length ? "ok" : "partial";
  }

  /** Browsers keep the context suspended until a user gesture. */
  unlock(): void {
    if (this.context?.state === "suspended") {
      void this.context.resume().catch(() => undefined);
    }
  }

  play(): void {
    const context = this.context;
    const master = this.master;
    if (!this.enabled || !context || !master || this.loadedCount === 0) {
      return;
    }
    if (this.activeVoices >= MAX_VOICES) {
      return;
    }
    if (context.state === "suspended") {
      this.unlock();
    }

    const buffer = this.buffers[this.nextBuffer % this.buffers.length];
    this.nextBuffer += 1;
    if (!buffer) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.92 + Math.random() * 0.16;
    const gain = context.createGain();
    gain.gain.value = 1;
    source.connect(gain).connect(master);
    this.activeVoices += 1;
    source.onended = () => {
      this.activeVoices -= 1;
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }

  setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(
        this.enabled ? this.volume : 0,
        this.context.currentTime,
        0.01,
      );
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.unlock();
    }
    this.setVolume(this.volume);
  }
}
