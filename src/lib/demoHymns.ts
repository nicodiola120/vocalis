import { Hymn, Voice } from "../types";

// Helper to write string into DataView
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Generates a Mono 16-bit PCM WAV file ArrayBuffer
export function createWavFile(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  // File length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, "WAVE");
  // Format chunk identifier
  writeString(view, 12, "fmt ");
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format: 1 = PCM (linear quantization)
  view.setUint16(20, 1, true);
  // Channel count: 1 = Mono
  view.setUint16(22, 1, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * 2, true);
  // Block align (channels * bytes per sample)
  view.setUint16(32, 2, true);
  // Bits per sample
  view.setUint16(34, 16, true);
  // Data chunk identifier
  writeString(view, 36, "data");
  // Data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let index = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    index += 2;
  }

  return buffer;
}

interface Note {
  pitch: number; // Hz
  start: number; // seconds
  duration: number; // seconds
}

// Synthesizes a beautiful vocal-like choir wave with fundamental + harmonics
function synthesizeVoice(notes: Note[], totalDuration: number, sampleRate: number): Float32Array {
  const samplesCount = Math.floor(totalDuration * sampleRate);
  const samples = new Float32Array(samplesCount);

  // Synthesize each note
  for (const note of notes) {
    const startSample = Math.floor(note.start * sampleRate);
    const endSample = Math.floor((note.start + note.duration) * sampleRate);

    const length = endSample - startSample;
    if (length <= 0) continue;

    const freq = note.pitch;
    const attackSamples = Math.floor(0.25 * sampleRate); // 250ms soft rise
    const releaseSamples = Math.floor(0.25 * sampleRate); // 250ms soft decay

    for (let i = 0; i < length; i++) {
      const globalIdx = startSample + i;
      if (globalIdx >= samplesCount) break;

      const t = i / sampleRate;

      // Additive synthesis for a richer, voice-like tone (fundamental + 3 harmonics)
      // We also introduce a very subtle vibrato (6 Hz frequency modulation)
      const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 6.0 * t);
      const angle = 2 * Math.PI * freq * vibrato * t;

      let val = Math.sin(angle) * 0.45; // Fundamental
      val += Math.sin(angle * 2) * 0.15; // 2nd Harmonic
      val += Math.sin(angle * 3) * 0.08; // 3rd Harmonic
      val += Math.sin(angle * 4) * 0.03; // 4th Harmonic

      // Apply ADSR-like envelope
      let envelope = 1.0;
      if (i < attackSamples) {
        envelope = i / attackSamples; // Linear fade in
      } else if (length - i < releaseSamples) {
        envelope = (length - i) / releaseSamples; // Linear fade out
      }

      samples[globalIdx] += val * envelope;
    }
  }

  // Smooth any minor clicks by doing a global tiny fade-in/fade-out
  const fadeEdge = Math.floor(0.05 * sampleRate); // 50ms
  for (let i = 0; i < fadeEdge; i++) {
    if (i < samples.length) {
      samples[i] *= (i / fadeEdge);
    }
    const endIdx = samples.length - 1 - i;
    if (endIdx >= 0 && endIdx < samples.length) {
      samples[endIdx] *= (i / fadeEdge);
    }
  }

  return samples;
}

export function generateDemoHymns(): Hymn[] {
  const sampleRate = 22050; // Use 22.05kHz to keep generation instantaneous and small
  const durationGrace = 18; // 18 seconds duration
  const durationMaria = 20; // 20 seconds duration

  // --- AMAZING GRACE NOTES ---
  // Key: C Major, 3/4 time, 2 seconds per bar (3 beats * 0.66s)
  const graceSoprano: Note[] = [
    { pitch: 392.00, start: 0, duration: 1.8 },  // G4
    { pitch: 523.25, start: 2, duration: 3.8 },  // C5
    { pitch: 659.25, start: 6, duration: 1.8 },  // E5
    { pitch: 523.25, start: 8, duration: 1.8 },  // C5
    { pitch: 659.25, start: 10, duration: 3.8 }, // E5
    { pitch: 587.33, start: 14, duration: 3.8 }, // D5
  ];

  const graceAlto: Note[] = [
    { pitch: 329.63, start: 0, duration: 1.8 },  // E4
    { pitch: 392.00, start: 2, duration: 3.8 },  // G4
    { pitch: 523.25, start: 6, duration: 1.8 },  // C5
    { pitch: 392.00, start: 8, duration: 1.8 },  // G4
    { pitch: 523.25, start: 10, duration: 3.8 }, // C5
    { pitch: 493.88, start: 14, duration: 3.8 }, // B4
  ];

  const graceTenor: Note[] = [
    { pitch: 261.63, start: 0, duration: 1.8 },  // C4
    { pitch: 329.63, start: 2, duration: 3.8 },  // E4
    { pitch: 392.00, start: 6, duration: 1.8 },  // G4
    { pitch: 329.63, start: 8, duration: 1.8 },  // E4
    { pitch: 392.00, start: 10, duration: 3.8 }, // G4
    { pitch: 392.00, start: 14, duration: 3.8 }, // G4
  ];

  const graceBass: Note[] = [
    { pitch: 130.81, start: 0, duration: 1.8 },  // C3
    { pitch: 130.81, start: 2, duration: 3.8 },  // C3
    { pitch: 130.81, start: 6, duration: 1.8 },  // C3
    { pitch: 130.81, start: 8, duration: 1.8 },  // C3
    { pitch: 130.81, start: 10, duration: 3.8 }, // C3
    { pitch: 196.00, start: 14, duration: 3.8 }, // G3
  ];

  // --- AVE MARIA NOTES ---
  // A beautiful simple chord progression (C - Am - Dm - G7 - C)
  // 4 seconds per bar
  const mariaSoprano: Note[] = [
    { pitch: 523.25, start: 0, duration: 3.8 },  // C5
    { pitch: 587.33, start: 4, duration: 3.8 },  // D5
    { pitch: 659.25, start: 8, duration: 3.8 },  // E5
    { pitch: 698.46, start: 12, duration: 3.8 }, // F5
    { pitch: 523.25, start: 16, duration: 3.8 }, // C5
  ];

  const mariaAlto: Note[] = [
    { pitch: 392.00, start: 0, duration: 3.8 },  // G4
    { pitch: 440.00, start: 4, duration: 3.8 },  // A4
    { pitch: 349.23, start: 8, duration: 3.8 },  // F4
    { pitch: 392.00, start: 12, duration: 3.8 }, // G4
    { pitch: 392.00, start: 16, duration: 3.8 }, // G4
  ];

  const mariaTenor: Note[] = [
    { pitch: 329.63, start: 0, duration: 3.8 },  // E4
    { pitch: 329.63, start: 4, duration: 3.8 },  // E4
    { pitch: 293.66, start: 8, duration: 3.8 },  // D4
    { pitch: 293.66, start: 12, duration: 3.8 }, // D4
    { pitch: 261.63, start: 16, duration: 3.8 }, // C4
  ];

  const mariaBass: Note[] = [
    { pitch: 130.81, start: 0, duration: 3.8 },  // C3
    { pitch: 110.00, start: 4, duration: 3.8 },  // A2
    { pitch: 146.83, start: 8, duration: 3.8 },  // D3
    { pitch: 196.00, start: 12, duration: 3.8 }, // G3
    { pitch: 130.81, start: 16, duration: 3.8 }, // C3
  ];

  // Synthesize & assemble Amazing Grace
  const graceVoices: Voice[] = [
    {
      id: "grace-soprano",
      name: "Soprano",
      color: "indigo",
      volume: 0.75,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(graceSoprano, durationGrace, sampleRate), sampleRate),
    },
    {
      id: "grace-alto",
      name: "Alto",
      color: "pink",
      volume: 0.6,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(graceAlto, durationGrace, sampleRate), sampleRate),
    },
    {
      id: "grace-tenor",
      name: "Tenor",
      color: "sky",
      volume: 0.45,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(graceTenor, durationGrace, sampleRate), sampleRate),
    },
    {
      id: "grace-bass",
      name: "Bass",
      color: "emerald",
      volume: 0.7,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(graceBass, durationGrace, sampleRate), sampleRate),
    },
  ];

  // Synthesize & assemble Ave Maria
  const mariaVoices: Voice[] = [
    {
      id: "maria-soprano",
      name: "Soprano",
      color: "indigo",
      volume: 0.8,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(mariaSoprano, durationMaria, sampleRate), sampleRate),
    },
    {
      id: "maria-alto",
      name: "Alto",
      color: "pink",
      volume: 0.8,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(mariaAlto, durationMaria, sampleRate), sampleRate),
    },
    {
      id: "maria-tenor",
      name: "Tenor",
      color: "sky",
      volume: 0.75,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(mariaTenor, durationMaria, sampleRate), sampleRate),
    },
    {
      id: "maria-bass",
      name: "Bass",
      color: "emerald",
      volume: 0.7,
      isMuted: false,
      isSolo: false,
      audioData: createWavFile(synthesizeVoice(mariaBass, durationMaria, sampleRate), sampleRate),
    },
  ];

  return [
    {
      id: "amazing-grace",
      name: "Amazing Grace",
      voices: graceVoices,
      duration: durationGrace,
      createdAt: Date.now() - 10000,
      isDemo: true,
      lyrics: "John Newton (1779)",
      music: "Traditional American Melody (New Britain)",
      arranger: "Edwin Othello Excell (1909)",
      info: "This demo is a synthetically synthesized 4-part choir simulation using additive sinusoid voice modeling.",
      tags: ["Traditional", "Hymn", "C-Major"],
    },
    {
      id: "ave-maria",
      name: "Ave Maria",
      voices: mariaVoices,
      duration: durationMaria,
      createdAt: Date.now() - 5000,
      isDemo: true,
      lyrics: "Traditional Latin Prayer",
      music: "Franz Schubert (1825)",
      arranger: "Vocalis Synthesizer",
      info: "A serene 4-part simulation of Schubert's famous sacred composition with soft ADSR envelope modeling.",
      tags: ["Classical", "Latin", "Schubert"],
    },
  ];
}
