export interface Voice {
  id: string;
  name: string; // e.g. "Soprano", "Alto", "Tenor", "Bass"
  audioData?: ArrayBuffer; // Undefined if synthetic or failed
  color: string; // Tailwind color class or hex (e.g. "indigo", "pink", "sky", "emerald")
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  isSolo: boolean;
  pan?: number; // -1.0 (Left) to 1.0 (Right), default 0.0
}

export interface Hymn {
  id: string;
  name: string;
  voices: Voice[];
  duration: number; // in seconds
  createdAt: number;
  isDemo?: boolean; // Flag to indicate if it's a synthetic demo
  lyrics?: string;
  music?: string;
  arranger?: string;
  info?: string;
  tags?: string[];
  folder?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // current playback position in seconds
  duration: number; // total duration in seconds
  masterVolume: number; // 0.0 to 1.0
  isLooping: boolean;
  activeHymnId: string | null;
}
