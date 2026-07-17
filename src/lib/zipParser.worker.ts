import { ZipReader, BlobReader, Uint8ArrayWriter } from "@zip.js/zip.js";

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
        metadata.tags = val.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
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
        currentValueLines = trimmedLine.slice(keyPrefix.length + 1).trim() ? [trimmedLine.slice(keyPrefix.length + 1).trim()] : [];
        foundKey = true;
        break;
      }
    }
    if (!foundKey && currentKey) {
      currentValueLines.push(trimmedLine);
    }
  }
  commitCurrent();
  return metadata;
}

const PREDETERMINED_PASSWORDS = ["vocalis", "vocalis123", "choir", "sing", "hymn"];

function cleanName(raw: string): string {
  let name = raw.replace(/\.[^/.]+$/, "");
  name = name.replace(/[_%\-+]/g, " ");
  const parts = name.split("/");
  name = parts[parts.length - 1] || name;
  return name.split(" ").filter((w) => w.length > 0).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function parseVoiceTrack(fileName: string, data: ArrayBuffer) {
  const lowercase = fileName.toLowerCase();
  let name = cleanName(fileName);
  let color = "amber";

  if (lowercase.includes("soprano") || lowercase.includes("sop")) { name = "Soprano"; color = "indigo"; }
  else if (lowercase.includes("alto") || lowercase.includes("alt")) { name = "Alto"; color = "pink"; }
  else if (lowercase.includes("tenor") || lowercase.includes("ten")) { name = "Tenor"; color = "sky"; }
  else if (lowercase.includes("bass") || lowercase.includes("bas")) { name = "Bass"; color = "emerald"; }
  else if (lowercase.includes("lead") || lowercase.includes("melody")) { name = "Lead"; color = "violet"; }
  else if (lowercase.includes("organ") || lowercase.includes("accomp")) { name = "Accompaniment"; color = "rose"; }

  return { id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, name, color, volume: 0.8, isMuted: false, isSolo: false, audioData: data };
}

self.onmessage = async (e: MessageEvent) => {
  const { fileData, fileName, password, requestId } = e.data as {
    fileData: ArrayBuffer;
    fileName: string;
    password?: string;
    requestId: string;
  };

  try {
    const file = new File([fileData], fileName, { type: "application/zip" });
    const reader = new ZipReader(new BlobReader(file));
    let entries;
    try {
      entries = await reader.getEntries();
    } catch {
      throw new Error("Invalid or corrupted zip archive.");
    }

    const audioExtensions = [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac"];
    const audioEntries = entries.filter((entry) => !entry.directory && audioExtensions.some((ext) => entry.filename.toLowerCase().endsWith(ext)));

    if (audioEntries.length === 0) throw new Error("No valid MP3/audio tracks found inside the zip file.");

    const isEncrypted = audioEntries.some((entry) => entry.encrypted);
    let workingPassword: string | undefined = undefined;

    if (isEncrypted) {
      if (password) {
        try {
          await audioEntries[0].getData(new Uint8ArrayWriter(), { password });
          workingPassword = password;
        } catch {
          throw new Error("Incorrect password. Please try again.");
        }
      } else {
        let found = false;
        for (const pwd of PREDETERMINED_PASSWORDS) {
          try {
            await audioEntries[0].getData(new Uint8ArrayWriter(), { password: pwd });
            workingPassword = pwd;
            found = true;
            break;
          } catch { /* keep trying */ }
        }
        if (!found) throw { isPasswordRequired: true, message: "This ZIP archive is password-protected." };
      }
    }

    const voices = [];
    for (const entry of audioEntries) {
      try {
        const dataView = await entry.getData(new Uint8ArrayWriter(), { password: workingPassword });
        const arrayBuffer = dataView.buffer.slice(dataView.byteOffset, dataView.byteOffset + dataView.byteLength);
        voices.push(parseVoiceTrack(entry.filename, arrayBuffer));
      } catch (err) {
        if (isEncrypted) throw new Error(`Failed to decrypt or read track "${entry.filename}".`);
      }
    }

    let infoMetadata: InfoMetadata = {};
    const infoEntry = entries.find((entry) => !entry.directory && entry.filename.toLowerCase().endsWith("info.txt"));
    if (infoEntry) {
      try {
        const dataView = await infoEntry.getData(new Uint8ArrayWriter(), { password: workingPassword });
        infoMetadata = parseInfoText(new TextDecoder("utf-8").decode(dataView));
      } catch { /* ignore */ }
    }

    await reader.close();

    if (voices.length === 0) throw new Error("No valid audio tracks could be successfully extracted from the ZIP archive.");

    const hymnName = cleanName(fileName);
    const hymn = {
      id: `hymn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: hymnName,
      voices,
      duration: 120,
      createdAt: Date.now(),
      lyrics: infoMetadata.lyrics,
      music: infoMetadata.music,
      arranger: infoMetadata.arranger,
      info: infoMetadata.info,
      tags: infoMetadata.tags,
    };

    // Transfer audio ArrayBuffers back to main thread
    const transferables = voices.map((v: any) => v.audioData).filter((d: any) => d instanceof ArrayBuffer);
    (self as any).postMessage({ requestId, hymn, error: null }, transferables);
  } catch (err: any) {
    const isPasswordRequired = err?.isPasswordRequired === true;
    (self as any).postMessage({ requestId, hymn: null, error: err.message || String(err), isPasswordRequired });
  }
};
