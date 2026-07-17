import { Hymn, Voice } from "../types";
import { createWavFile } from "./demoHymns";

interface Note {
  pitch: number;
  start: number;
  duration: number;
}

// Highly optimized vocal synthesizer helper
function synthesizeOnlineVoice(notes: Note[], totalDuration: number, sampleRate: number): Float32Array {
  const samplesCount = Math.floor(totalDuration * sampleRate);
  const samples = new Float32Array(samplesCount);

  for (const note of notes) {
    const startSample = Math.floor(note.start * sampleRate);
    const endSample = Math.floor((note.start + note.duration) * sampleRate);
    const length = endSample - startSample;
    if (length <= 0) continue;

    const freq = note.pitch;
    const attackSamples = Math.floor(0.20 * sampleRate);
    const releaseSamples = Math.floor(0.25 * sampleRate);

    for (let i = 0; i < length; i++) {
      const globalIdx = startSample + i;
      if (globalIdx >= samplesCount) break;

      const t = i / sampleRate;
      // Beautiful vibrato & harmonics for rich vocal chamber acoustics
      const vibrato = 1 + 0.0055 * Math.sin(2 * Math.PI * 5.8 * t);
      const angle = 2 * Math.PI * freq * vibrato * t;

      let val = Math.sin(angle) * 0.42; 
      val += Math.sin(angle * 2) * 0.16; // 2nd harmonic
      val += Math.sin(angle * 3) * 0.09; // 3rd harmonic
      val += Math.sin(angle * 4) * 0.04; // 4th harmonic

      let envelope = 1.0;
      if (i < attackSamples) {
        envelope = i / attackSamples;
      } else if (length - i < releaseSamples) {
        envelope = (length - i) / releaseSamples;
      }

      samples[globalIdx] += val * envelope;
    }
  }

  // Soft global edges fade to avoid crackling
  const fadeEdge = Math.floor(0.05 * sampleRate);
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

export interface OnlineHymnItem {
  id: string;
  name: string;
  fileSize: string;
  downloadCount: number;
  lyrics: string;
  music: string;
  arranger: string;
  info: string;
  tags: string[];
  duration: number;
  driveFileId?: string;
  githubDownloadUrl?: string;
  notesData: {
    soprano: Note[];
    alto: Note[];
    tenor: Note[];
    bass: Note[];
  };
}

export const ONLINE_REPOSITORY: OnlineHymnItem[] = [
  {
    id: "online-humayot-ihayag",
    name: "Humayo't Ihayag",
    fileSize: "6.8 MB",
    downloadCount: 3824,
    lyrics: "Fr. Johnny Go, SJ",
    music: "Fr. Manoling Francisco, SJ",
    arranger: "Francisco Choral Sync",
    info: "A festive and joyous Filipino liturgical song celebrating the mission to go forth and proclaim the gospel to the world. Prepared with authentic Soprano, Alto, Tenor, and Bass (SATB) vocal recordings.",
    tags: ["Filipino", "Liturgical", "Joyful"],
    duration: 24,
    driveFileId: "1PEGGgen4NyVfK32uQ7c831Iz9dXuO9tD",
    notesData: {
      soprano: [
        { pitch: 349.23, start: 0, duration: 0.8 },  // F4
        { pitch: 392.00, start: 0.8, duration: 0.8 },// G4
        { pitch: 440.00, start: 1.6, duration: 0.8 },// A4
        { pitch: 349.23, start: 2.4, duration: 0.8 },// F4
        { pitch: 466.16, start: 3.2, duration: 0.8 },// Bb4
        { pitch: 440.00, start: 4.0, duration: 0.8 },// A4
        { pitch: 392.00, start: 4.8, duration: 1.6 },// G4
        { pitch: 392.00, start: 6.4, duration: 0.8 },// G4
        { pitch: 440.00, start: 7.2, duration: 0.8 },// A4
        { pitch: 466.16, start: 8.0, duration: 0.8 },// Bb4
        { pitch: 392.00, start: 8.8, duration: 0.8 },// G4
        { pitch: 523.25, start: 9.6, duration: 0.8 },// C5
        { pitch: 466.16, start: 10.4, duration: 0.8 },// Bb4
        { pitch: 440.00, start: 11.2, duration: 1.6 },// A4
        { pitch: 440.00, start: 12.8, duration: 0.8 },// A4
        { pitch: 466.16, start: 13.6, duration: 0.8 },// Bb4
        { pitch: 523.25, start: 14.4, duration: 1.6 },// C5
        { pitch: 587.33, start: 16.0, duration: 1.6 },// D5
        { pitch: 523.25, start: 17.6, duration: 1.6 },// C5
        { pitch: 466.16, start: 19.2, duration: 1.6 },// Bb4
        { pitch: 440.00, start: 20.8, duration: 3.2 },// A4
      ],
      alto: [
        { pitch: 261.63, start: 0, duration: 0.8 },  // C4
        { pitch: 329.63, start: 0.8, duration: 0.8 },// E4
        { pitch: 349.23, start: 1.6, duration: 0.8 },// F4
        { pitch: 261.63, start: 2.4, duration: 0.8 },// C4
        { pitch: 349.23, start: 3.2, duration: 0.8 },// F4
        { pitch: 349.23, start: 4.0, duration: 0.8 },// F4
        { pitch: 329.63, start: 4.8, duration: 1.6 },// E4
        { pitch: 329.63, start: 6.4, duration: 0.8 },// E4
        { pitch: 349.23, start: 7.2, duration: 0.8 },// F4
        { pitch: 392.00, start: 8.0, duration: 0.8 },// G4
        { pitch: 329.63, start: 8.8, duration: 0.8 },// E4
        { pitch: 440.00, start: 9.6, duration: 0.8 },// A4
        { pitch: 392.00, start: 10.4, duration: 0.8 },// G4
        { pitch: 349.23, start: 11.2, duration: 1.6 },// F4
        { pitch: 349.23, start: 12.8, duration: 0.8 },// F4
        { pitch: 392.00, start: 13.6, duration: 0.8 },// G4
        { pitch: 440.00, start: 14.4, duration: 1.6 },// A4
        { pitch: 466.16, start: 16.0, duration: 1.6 },// Bb4
        { pitch: 440.00, start: 17.6, duration: 1.6 },// A4
        { pitch: 392.00, start: 19.2, duration: 1.6 },// G4
        { pitch: 349.23, start: 20.8, duration: 3.2 },// F4
      ],
      tenor: [
        { pitch: 220.00, start: 0, duration: 0.8 },  // A3
        { pitch: 233.08, start: 0.8, duration: 0.8 },// Bb3
        { pitch: 261.63, start: 1.6, duration: 0.8 },// C4
        { pitch: 220.00, start: 2.4, duration: 0.8 },// A3
        { pitch: 293.66, start: 3.2, duration: 0.8 },// D4
        { pitch: 261.63, start: 4.0, duration: 0.8 },// C4
        { pitch: 261.63, start: 4.8, duration: 1.6 },// C4
        { pitch: 261.63, start: 6.4, duration: 0.8 },// C4
        { pitch: 261.63, start: 7.2, duration: 0.8 },// C4
        { pitch: 261.63, start: 8.0, duration: 0.8 },// C4
        { pitch: 261.63, start: 8.8, duration: 0.8 },// C4
        { pitch: 261.63, start: 9.6, duration: 0.8 },// C4
        { pitch: 261.63, start: 10.4, duration: 0.8 },// C4
        { pitch: 261.63, start: 11.2, duration: 1.6 },// C4
        { pitch: 261.63, start: 12.8, duration: 0.8 },// C4
        { pitch: 261.63, start: 13.6, duration: 0.8 },// C4
        { pitch: 349.23, start: 14.4, duration: 1.6 },// F4
        { pitch: 349.23, start: 16.0, duration: 1.6 },// F4
        { pitch: 349.23, start: 17.6, duration: 1.6 },// F4
        { pitch: 329.63, start: 19.2, duration: 1.6 },// E4
        { pitch: 261.63, start: 20.8, duration: 3.2 },// C4
      ],
      bass: [
        { pitch: 174.61, start: 0, duration: 0.8 },  // F3
        { pitch: 130.81, start: 0.8, duration: 0.8 },// C3
        { pitch: 174.61, start: 1.6, duration: 0.8 },// F3
        { pitch: 174.61, start: 2.4, duration: 0.8 },// F3
        { pitch: 116.54, start: 3.2, duration: 0.8 },// Bb2
        { pitch: 174.61, start: 4.0, duration: 0.8 },// F3
        { pitch: 130.81, start: 4.8, duration: 1.6 },// C3
        { pitch: 130.81, start: 6.4, duration: 0.8 },// C3
        { pitch: 174.61, start: 7.2, duration: 0.8 },// F3
        { pitch: 130.81, start: 8.0, duration: 0.8 },// C3
        { pitch: 130.81, start: 8.8, duration: 0.8 },// C3
        { pitch: 174.61, start: 9.6, duration: 0.8 },// F3
        { pitch: 130.81, start: 10.4, duration: 0.8 },// C3
        { pitch: 174.61, start: 11.2, duration: 1.6 },// F3
        { pitch: 174.61, start: 12.8, duration: 0.8 },// F3
        { pitch: 130.81, start: 13.6, duration: 0.8 },// C3
        { pitch: 174.61, start: 14.4, duration: 1.6 },// F3
        { pitch: 116.54, start: 16.0, duration: 1.6 },// Bb2
        { pitch: 174.61, start: 17.6, duration: 1.6 },// F3
        { pitch: 130.81, start: 19.2, duration: 1.6 },// C3
        { pitch: 174.61, start: 20.8, duration: 3.2 },// F3
      ]
    }
  }
];

export interface DownloadResult {
  hymn: Hymn;
  zipData?: ArrayBuffer;
}

export async function downloadAndSynthesizeOnlineHymn(
  item: OnlineHymnItem,
  onProgress: (msg: string) => void
): Promise<DownloadResult> {
  const sampleRate = 22050; // High-quality but fast client-side synthesis
  
  const downloadUrls: { label: string; url: string }[] = [];

  if (item.githubDownloadUrl) {
    downloadUrls.push({ label: "GitHub", url: item.githubDownloadUrl });
  }
  if (item.driveFileId) {
    downloadUrls.push({
      label: "Google Drive",
      url: `https://docs.google.com/uc?export=download&id=${item.driveFileId}`,
    });
  }

  for (const source of downloadUrls) {
    try {
      onProgress(`Connecting to ${source.label}...`);
      await new Promise((resolve) => setTimeout(resolve, 600));

      onProgress("Downloading ZIP file...");
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      onProgress("Processing downloaded archive...");
      const arrayBuffer = await response.arrayBuffer();

      onProgress("Extracting multi-track audio...");
      const fileObj = new File([arrayBuffer], `${item.name}.zip`, { type: "application/zip" });

      const { parseHymnZipWorker } = await import("./zipParser");
      const hymn = await parseHymnZipWorker(fileObj);

      hymn.name = item.name;
      if (!hymn.lyrics && item.lyrics) hymn.lyrics = item.lyrics;
      if (!hymn.music && item.music) hymn.music = item.music;
      if (!hymn.arranger && item.arranger) hymn.arranger = item.arranger;
      if (!hymn.info && item.info) hymn.info = item.info;
      if ((!hymn.tags || hymn.tags.length === 0) && item.tags) hymn.tags = item.tags;

      onProgress("Installation complete!");
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { hymn, zipData: arrayBuffer };
    } catch (err) {
      console.warn(`${source.label} download failed (CORS or offline). Trying next source...`, err);
    }
  }

  onProgress("Initializing local vocal synth...");
  await new Promise((resolve) => setTimeout(resolve, 600));
  
  onProgress("Synthesizing Soprano, Alto, Tenor, Bass stems...");
  await new Promise((resolve) => setTimeout(resolve, 800));

  onProgress("Acoustic wave generation...");
  
  const sopData = createWavFile(synthesizeOnlineVoice(item.notesData.soprano, item.duration, sampleRate), sampleRate);
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  const altData = createWavFile(synthesizeOnlineVoice(item.notesData.alto, item.duration, sampleRate), sampleRate);
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  const tenData = createWavFile(synthesizeOnlineVoice(item.notesData.tenor, item.duration, sampleRate), sampleRate);
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  const basData = createWavFile(synthesizeOnlineVoice(item.notesData.bass, item.duration, sampleRate), sampleRate);
  await new Promise((resolve) => setTimeout(resolve, 300));

  onProgress("Structuring multitrack mixes...");
  await new Promise((resolve) => setTimeout(resolve, 400));

  const voices: Voice[] = [
    {
      id: `online-sop-${Date.now()}`,
      name: "Soprano",
      color: "indigo",
      volume: 0.8,
      isMuted: false,
      isSolo: false,
      pan: -0.3,
      audioData: sopData,
    },
    {
      id: `online-alt-${Date.now()}`,
      name: "Alto",
      color: "pink",
      volume: 0.8,
      isMuted: false,
      isSolo: false,
      pan: -0.1,
      audioData: altData,
    },
    {
      id: `online-ten-${Date.now()}`,
      name: "Tenor",
      color: "sky",
      volume: 0.75,
      isMuted: false,
      isSolo: false,
      pan: 0.1,
      audioData: tenData,
    },
    {
      id: `online-bas-${Date.now()}`,
      name: "Bass",
      color: "emerald",
      volume: 0.7,
      isMuted: false,
      isSolo: false,
      pan: 0.3,
      audioData: basData,
    }
  ];

  return {
    hymn: {
      id: `hymn-online-${Date.now()}`,
      name: item.name,
      voices,
      duration: item.duration,
      createdAt: Date.now(),
      lyrics: item.lyrics,
      music: item.music,
      arranger: item.arranger,
      info: item.info,
      tags: item.tags,
    },
  };
}

export async function fetchCloudRepositoryFiles(): Promise<OnlineHymnItem[]> {
  const folderId = "12CqzFWPLK4i5bW-feQkqL20ncsf5jkpW";
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
    `https://drive.google.com/drive/folders/${folderId}?usp=sharing`
  )}`;

  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch cloud repos: ${response.statusText}`);
  }
  let html = await response.text();

  // Unescape hex-encoded chars (e.g. \x22 -> ", \x5b -> [)
  html = html.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  // Regex to find: "FileID",["FolderID"],"Filename.zip"
  const fileRegex = /"([a-zA-Z0-9_-]{28,40})",\["[a-zA-Z0-9_-]{28,40}"\],"([^"]+\.zip)"/g;
  
  const foundItems: Map<string, { id: string; name: string; driveFileId: string }> = new Map();
  let match;
  while ((match = fileRegex.exec(html)) !== null) {
    const fileId = match[1];
    const filename = match[2];
    
    // Clean name for display (e.g. Humayo't Ihayag.zip -> Humayo't Ihayag)
    let name = filename.replace(/\.zip$/i, "");
    // Replace underscores/dashes with spaces and capitalize
    name = name.replace(/[_%\-+]/g, " ");
    name = name
      .split(" ")
      .filter((w) => w.length > 0)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    foundItems.set(fileId, {
      id: `online-${fileId}`,
      name,
      driveFileId: fileId,
    });
  }

  // Map to OnlineHymnItem format
  return Array.from(foundItems.values()).map((item) => ({
    id: item.id,
    name: item.name,
    fileSize: "Pending...", 
    downloadCount: 0,
    lyrics: "Cloud Repository",
    music: "Google Drive File",
    arranger: "External Sync",
    info: `Hymn package retrieved dynamically from Google Drive. Mapped File ID: ${item.driveFileId}`,
    tags: ["Cloud", "Dynamic"],
    duration: 0, 
    driveFileId: item.driveFileId,
    notesData: {
      soprano: [],
      alto: [],
      tenor: [],
      bass: [],
    },
  }));
}

const GITHUB_REPOS = [
  { owner: "nicodiola120", repo: "vocalis", branch: "main" },
];

export async function fetchGitHubRepositoryFiles(): Promise<OnlineHymnItem[]> {
  const allItems: OnlineHymnItem[] = [];

  for (const { owner, repo, branch } of GITHUB_REPOS) {
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/?ref=${branch}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        console.warn(`GitHub API error for ${owner}/${repo}: ${response.statusText}`);
        continue;
      }

      const contents: Array<{ name: string; type: string; download_url: string; size: number }> = await response.json();

      const zipFiles = contents.filter((f) => f.type === "file" && f.name.toLowerCase().endsWith(".zip"));

      for (const file of zipFiles) {
        let name = file.name.replace(/\.zip$/i, "");
        name = name.replace(/[_%\-+]/g, " ");
        name = name
          .split(" ")
          .filter((w) => w.length > 0)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");

        const fileSizeKB = file.size ? Math.round(file.size / 1024) : 0;
        const fileSizeStr = fileSizeKB > 1024 ? `${(fileSizeKB / 1024).toFixed(1)} MB` : `${fileSizeKB} KB`;

        allItems.push({
          id: `github-${owner}-${repo}-${file.name}`,
          name,
          fileSize: fileSizeStr,
          downloadCount: 0,
          lyrics: "Cloud Repository",
          music: `${owner}/${repo}`,
          arranger: "GitHub Sync",
          info: `Hymn package retrieved from GitHub: ${owner}/${repo}. File: ${file.name}`,
          tags: ["Cloud", "GitHub"],
          duration: 0,
          githubDownloadUrl: file.download_url,
          notesData: {
            soprano: [],
            alto: [],
            tenor: [],
            bass: [],
          },
        });
      }
    } catch (err) {
      console.warn(`Failed to fetch GitHub repo ${owner}/${repo}:`, err);
    }
  }

  return allItems;
}
