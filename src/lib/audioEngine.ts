import { Hymn, Voice } from "../types";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Maps voice.id -> decoded AudioBuffer
  private decodedBuffers: Map<string, AudioBuffer> = new Map();
  
  // Active nodes for playing voices (voice.id -> node)
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private analysers: Map<string, AnalyserNode> = new Map();
  private panners: Map<string, StereoPannerNode> = new Map();

  private isPlaying: boolean = false;
  private isLooping: boolean = false;
  private masterVolume: number = 0.8;
  private duration: number = 0;
  
  private startOffset: number = 0; // seconds
  private startTime: number = 0; // context time when started playing

  private activeHymn: Hymn | null = null;
  private onStateChange: (() => void) | null = null;
  private onPlaybackEnded: (() => void) | null = null;
  private timeUpdateTimer: number | null = null;

  constructor() {
    // AudioContext will be initialized on user interaction (Play)
  }

  private initAudio() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public setCallbacks(onStateChange: () => void, onPlaybackEnded: () => void) {
    this.onStateChange = onStateChange;
    this.onPlaybackEnded = onPlaybackEnded;
  }

  // Pre-decodes all voices of a hymn and caches them
  public async loadHymn(hymn: Hymn, onProgress?: (p: number) => void): Promise<void> {
    this.initAudio();
    this.stop();
    this.activeHymn = hymn;
    this.duration = hymn.duration;
    this.startOffset = 0;

    const ctx = this.ctx!;
    let loadedCount = 0;
    const totalVoices = hymn.voices.length;

    onProgress?.(0);

    for (const voice of hymn.voices) {
      if (this.decodedBuffers.has(voice.id)) {
        loadedCount++;
        onProgress?.(Math.round((loadedCount / totalVoices) * 100));
        continue;
      }

      if (voice.audioData) {
        try {
          // Copy the buffer to prevent detaching/neutering
          const bufferCopy = voice.audioData.slice(0);
          const decoded = await ctx.decodeAudioData(bufferCopy);
          this.decodedBuffers.set(voice.id, decoded);
        } catch (e) {
          console.error(`Error decoding voice ${voice.name}:`, e);
        }
      }
      loadedCount++;
      onProgress?.(Math.round((loadedCount / totalVoices) * 100));
    }

    // Recalculate duration based on actual decoded buffer lengths
    let maxDur = 0;
    for (const voice of hymn.voices) {
      const buf = this.decodedBuffers.get(voice.id);
      if (buf && buf.duration > maxDur) {
        maxDur = buf.duration;
      }
    }
    if (maxDur > 0) {
      this.duration = maxDur;
    }

    this.onStateChange?.();
  }

  public updateActiveHymn(hymn: Hymn) {
    this.activeHymn = hymn;
  }

  public play() {
    this.initAudio();
    if (!this.activeHymn || this.isPlaying) return;

    const ctx = this.ctx!;
    const master = this.masterGain!;

    // If we've reached the end, reset offset
    if (this.startOffset >= this.duration) {
      this.startOffset = 0;
    }

    this.isPlaying = true;
    this.startTime = ctx.currentTime;

    // Start all channels
    for (const voice of this.activeHymn.voices) {
      const buffer = this.decodedBuffers.get(voice.id);
      if (!buffer) continue;

      // Create Source
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = this.isLooping;
      if (this.isLooping) {
        source.loopStart = 0;
        source.loopEnd = this.duration;
      }

      // Create Gain Node
      const gainNode = ctx.createGain();
      
      // Create Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // High density for small LED bars

      // Create Stereo Panner if supported
      let pannerNode: StereoPannerNode | null = null;
      if (ctx.createStereoPanner) {
        pannerNode = ctx.createStereoPanner();
        pannerNode.pan.setValueAtTime(voice.pan ?? 0.0, ctx.currentTime);
      }

      // Connect source -> gain -> analyser -> panner -> master
      source.connect(gainNode);
      gainNode.connect(analyser);
      if (pannerNode) {
        analyser.connect(pannerNode);
        pannerNode.connect(master);
      } else {
        analyser.connect(master);
      }

      // Save references
      this.sources.set(voice.id, source);
      this.gains.set(voice.id, gainNode);
      this.analysers.set(voice.id, analyser);
      if (pannerNode) {
        this.panners.set(voice.id, pannerNode);
      }

      // Apply solo/mute gain rules immediately
      this.updateVoiceGain(voice);

      // Start the source
      source.start(0, this.startOffset);
    }

    // Watch for ended event on sources (if not looping)
    if (!this.isLooping && this.sources.size > 0) {
      // Choose first valid source to trigger playback ended
      const firstSource = Array.from(this.sources.values())[0];
      firstSource.onended = () => {
        // Only trigger if we are still playing and reached the actual end
        if (this.isPlaying && this.getCurrentTime() >= this.duration - 0.1) {
          this.stop();
          this.onPlaybackEnded?.();
        }
      };
    }

    this.startTime = ctx.currentTime;
    this.onStateChange?.();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.startOffset = this.getCurrentTime();
    this.clearSources();
    this.isPlaying = false;
    this.onStateChange?.();
  }

  public stop() {
    this.startOffset = 0;
    this.clearSources();
    this.isPlaying = false;
    this.onStateChange?.();
  }

  public seek(seconds: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.startOffset = Math.max(0, Math.min(this.duration, seconds));
    if (wasPlaying) {
      this.play();
    } else {
      this.onStateChange?.();
    }
  }

  private clearSources() {
    this.sources.forEach((source) => {
      try {
        source.onended = null;
        source.stop();
      } catch (e) {
        // Already stopped or not started
      }
    });
    this.sources.clear();
    this.gains.clear();
    this.analysers.clear();
    this.panners.clear();
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx?.currentTime || 0);
    }
    this.onStateChange?.();
  }

  public setLooping(loop: boolean) {
    this.isLooping = loop;
    this.sources.forEach((source) => {
      source.loop = loop;
      if (loop) {
        source.loopStart = 0;
        source.loopEnd = this.duration;
      }
    });
    this.onStateChange?.();
  }

  // Updates solo/mute volumes for all voices in the active hymn
  public updateAllVoiceGains() {
    if (!this.activeHymn) return;
    for (const voice of this.activeHymn.voices) {
      this.updateVoiceGain(voice);
    }
  }

  public updateVoiceGain(voice: Voice) {
    const gainNode = this.gains.get(voice.id);
    if (!gainNode || !this.activeHymn) return;

    // Solo & Mute logic:
    // 1. If any channel is soloed, then:
    //    - Only soloed channels that are NOT muted are audible.
    //    - Non-soloed channels are completely silent (gain = 0).
    // 2. If NO channels are soloed:
    //    - Muted channels are silent (gain = 0).
    //    - Non-muted channels are set to their standard individual volume.
    const anySoloActive = this.activeHymn.voices.some((v) => v.isSolo);

    let targetGain = 0;
    if (anySoloActive) {
      if (voice.isSolo && !voice.isMuted) {
        targetGain = voice.volume;
      } else {
        targetGain = 0;
      }
    } else {
      if (!voice.isMuted) {
        targetGain = voice.volume;
      } else {
        targetGain = 0;
      }
    }

    gainNode.gain.setValueAtTime(targetGain, this.ctx?.currentTime || 0);
  }

  // Direct gain update for smooth slider dragging — bypasses solo/mute recalc
  public setChannelVolume(voiceId: string, vol: number) {
    const gainNode = this.gains.get(voiceId);
    if (!gainNode) return;
    gainNode.gain.setValueAtTime(vol, this.ctx?.currentTime || 0);
  }

  public updateVoicePan(voice: Voice) {
    const pannerNode = this.panners.get(voice.id);
    if (pannerNode) {
      pannerNode.pan.setValueAtTime(voice.pan ?? 0.0, this.ctx?.currentTime || 0);
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return this.startOffset;
    const ctx = this.ctx!;
    const elapsed = ctx.currentTime - this.startTime;
    let time = this.startOffset + elapsed;
    if (this.isLooping && this.duration > 0) {
      time = time % this.duration;
    } else if (time >= this.duration) {
      time = this.duration;
    }
    return time;
  }

  // Returns the byte array of frequency data for a channel visualizer
  public getChannelAudioLevel(voiceId: string): number {
    const analyser = this.analysers.get(voiceId);
    if (!analyser || !this.isPlaying) return 0;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate RMS/average amplitude
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length; // Range: 0 to 255
    return average / 255; // Normalize to 0.0 - 1.0
  }

  public getActiveHymn(): Hymn | null {
    return this.activeHymn;
  }

  public getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      isLooping: this.isLooping,
      currentTime: this.getCurrentTime(),
      duration: this.duration,
      masterVolume: this.masterVolume,
      activeHymnId: this.activeHymn?.id || null,
    };
  }

  // Clear memory cache
  public clearCache() {
    this.decodedBuffers.clear();
  }
}

// Single active player instance
export const player = new AudioEngine();
