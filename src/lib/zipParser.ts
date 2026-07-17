import { ZipReader, BlobReader, Uint8ArrayWriter } from "@zip.js/zip.js";
import { Hymn, Voice } from "../types";

export class PasswordRequiredError extends Error {
  public isPasswordRequired = true;
  constructor(message: string) {
    super(message);
    this.name = "PasswordRequiredError";
  }
}

interface InfoMetadata {
  lyrics?: string;
  music?: string;
  arranger?: string;
  info?: string;
  tags?: string[];
}

function parseInfoText(text: string): InfoMetadata {
  const lines = text.split(/\r?\n/);
  const metadata: InfoMetadata = {};
  
  let currentKey: "lyrics" | "music" | "arranger" | "info" | "tags" | null = null;
  let currentValueLines: string[] = [];

  const commitCurrent = () => {
    if (currentKey) {
      const val = currentValueLines.join("\n").trim();
      if (currentKey === "tags") {
        metadata.tags = val
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      } else {
        metadata[currentKey] = val;
      }
    }
  };

  const keyMap: Record<string, "lyrics" | "music" | "arranger" | "info" | "tags"> = {
    lyrics: "lyrics",
    music: "music",
    arranger: "arranger",
    arrangement: "arranger",
    info: "info",
    tags: "tags",
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let foundKey = false;
    for (const [keyPrefix, key] of Object.entries(keyMap)) {
      if (trimmedLine.toLowerCase().startsWith(keyPrefix.toLowerCase() + ":")) {
        commitCurrent();
        currentKey = key;
        const remaining = trimmedLine.slice(keyPrefix.length + 1).trim();
        currentValueLines = remaining ? [remaining] : [];
        foundKey = true;
        break;
      }
    }

    if (!foundKey) {
      if (currentKey) {
        currentValueLines.push(trimmedLine);
      }
    }
  }
  commitCurrent();

  return metadata;
}

const PREDETERMINED_PASSWORDS = ["vocalis", "vocalis123", "choir", "sing", "hymn"];

// Helper to clean and format names (e.g. amazing_grace -> Amazing Grace)
function cleanName(raw: string): string {
  // Remove file extension
  let name = raw.replace(/\.[^/.]+$/, "");
  // Replace underscores, dashes and percent-encodings with spaces
  name = name.replace(/[_%\-+]/g, " ");
  // Remove leading/trailing paths if any
  const parts = name.split("/");
  name = parts[parts.length - 1] || name;
  // Capitalize words
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Maps file names to appropriate vocal category and design aesthetics
function parseVoiceTrack(fileName: string, data: ArrayBuffer): Voice {
  const lowercase = fileName.toLowerCase();
  const cleanBase = cleanName(fileName);

  let name = cleanBase;
  let color = "amber"; // fallback color

  if (lowercase.includes("soprano") || lowercase.includes("sop")) {
    name = "Soprano";
    color = "indigo";
  } else if (lowercase.includes("alto") || lowercase.includes("alt")) {
    name = "Alto";
    color = "pink";
  } else if (lowercase.includes("tenor") || lowercase.includes("ten")) {
    name = "Tenor";
    color = "sky";
  } else if (lowercase.includes("bass") || lowercase.includes("bas")) {
    name = "Bass";
    color = "emerald";
  } else if (lowercase.includes("lead") || lowercase.includes("melody")) {
    name = "Lead";
    color = "violet";
  } else if (lowercase.includes("organ") || lowercase.includes("accomp")) {
    name = "Accompaniment";
    color = "rose";
  }

  // Create unique ID
  const id = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    name,
    color,
    volume: 0.8,
    isMuted: false,
    isSolo: false,
    audioData: data,
  };
}

export async function parseHymnZip(file: File, userPassword?: string): Promise<Hymn> {
  const reader = new ZipReader(new BlobReader(file));
  let entries;
  try {
    entries = await reader.getEntries();
  } catch (err) {
    throw new Error("Invalid or corrupted zip archive.");
  }

  const voices: Voice[] = [];
  const audioExtensions = [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac"];

  // Check if any of the audio entries are encrypted (password protected)
  const audioEntries = entries.filter((entry) => {
    if (entry.directory) return false;
    return audioExtensions.some((ext) => entry.filename.toLowerCase().endsWith(ext));
  });

  if (audioEntries.length === 0) {
    throw new Error("No valid MP3/audio tracks found inside the zip file.");
  }

  const isEncrypted = audioEntries.some((entry) => entry.encrypted);

  // We need to find a working password if encrypted
  let workingPassword: string | undefined = undefined;

  if (isEncrypted) {
    if (userPassword) {
      // First try the user-provided password
      try {
        const testEntry = audioEntries[0];
        await testEntry.getData(new Uint8ArrayWriter(), { password: userPassword });
        workingPassword = userPassword;
      } catch (err) {
        throw new Error("Incorrect password. Please try again.");
      }
    } else {
      // Try predetermined passwords
      let found = false;
      for (const pwd of PREDETERMINED_PASSWORDS) {
        try {
          const testEntry = audioEntries[0];
          await testEntry.getData(new Uint8ArrayWriter(), { password: pwd });
          workingPassword = pwd;
          found = true;
          break;
        } catch (e) {
          // keep trying
        }
      }

      if (!found) {
        // If none of the predetermined passwords worked, ask the user
        throw new PasswordRequiredError("This ZIP archive is password-protected.");
      }
    }
  }

  // Now extract all entries using the working password
  for (const entry of audioEntries) {
    try {
      const dataView = await entry.getData(new Uint8ArrayWriter(), {
        password: workingPassword,
      });
      // Copy arraybuffer to ensure clean isolated memory
      const arrayBuffer = dataView.buffer.slice(
        dataView.byteOffset,
        dataView.byteOffset + dataView.byteLength
      );
      const voice = parseVoiceTrack(entry.filename, arrayBuffer);
      voices.push(voice);
    } catch (err) {
      console.error(`Failed to read audio track: ${entry.filename}`, err);
      if (isEncrypted) {
        throw new Error(`Failed to decrypt or read track "${entry.filename}".`);
      }
    }
  }

  // Look for info.txt inside the ZIP archive (matching case-insensitively)
  let infoMetadata: InfoMetadata = {};
  const infoEntry = entries.find(
    (entry) => !entry.directory && entry.filename.toLowerCase().endsWith("info.txt")
  );

  if (infoEntry) {
    try {
      const dataView = await infoEntry.getData(new Uint8ArrayWriter(), {
        password: workingPassword,
      });
      const text = new TextDecoder("utf-8").decode(dataView);
      infoMetadata = parseInfoText(text);
    } catch (err) {
      console.error("Failed to read or parse info.txt:", err);
    }
  }

  await reader.close();

  if (voices.length === 0) {
    throw new Error("No valid audio tracks could be successfully extracted from the ZIP archive.");
  }

  // Determine hymn name based on zip filename
  const hymnName = cleanName(file.name);
  const duration = 120; // Default placeholder, updated dynamically when loaded

  return {
    id: `hymn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: hymnName,
    voices,
    duration,
    createdAt: Date.now(),
    lyrics: infoMetadata.lyrics,
    music: infoMetadata.music,
    arranger: infoMetadata.arranger,
    info: infoMetadata.info,
    tags: infoMetadata.tags,
  };
}

// ---------- Web Worker offload ----------

let _worker: Worker | null = null;
let _requestId = 0;
const _pending = new Map<number, { resolve: (h: Hymn) => void; reject: (e: any) => void }>();

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL("./zipParser.worker.ts", import.meta.url), { type: "module" });
    _worker.onmessage = (e: MessageEvent) => {
      const { requestId, hymn, error, isPasswordRequired } = e.data;
      const p = _pending.get(requestId);
      if (!p) return;
      _pending.delete(requestId);
      if (error) {
        const err: any = new Error(error);
        if (isPasswordRequired) err.isPasswordRequired = true;
        p.reject(err);
      } else {
        p.resolve(hymn);
      }
    };
  }
  return _worker;
}

/**
 * Parse a ZIP file using a Web Worker (off main thread).
 * Falls back to the synchronous path if the worker is unavailable.
 */
export async function parseHymnZipWorker(file: File, userPassword?: string): Promise<Hymn> {
  try {
    const worker = getWorker();
    const id = ++_requestId;
    const arrayBuffer = await file.arrayBuffer();
    return await new Promise<Hymn>((resolve, reject) => {
      _pending.set(id, { resolve, reject });
      worker.postMessage({ fileData: arrayBuffer, fileName: file.name, password: userPassword, requestId: id });
    });
  } catch {
    // Fallback: run on main thread
    return parseHymnZip(file, userPassword);
  }
}
