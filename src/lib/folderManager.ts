import { Directory, Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const HANDLE_KEY = "vocalis_folder_handle";
const CAPACITOR_FOLDER_KEY = "vocalis_capacitor_folder";
const CAPACITOR_SUBFOLDER = "VocalisLibrary";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (isNativePlatform()) {
    return pickFolderNative();
  }
  return pickFolderWeb();
}

async function pickFolderNative(): Promise<FileSystemDirectoryHandle | null> {
  const folderName = promptFolderName();
  if (!folderName) return null;

  try {
    await Filesystem.mkdir({
      path: `${CAPACITOR_SUBFOLDER}/${folderName}`,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch {
    // Directory may already exist, that's fine
  }

  localStorage.setItem(CAPACITOR_FOLDER_KEY, folderName);
  return createNativeHandle(folderName);
}

function promptFolderName(): string | null {
  const name = window.prompt("Enter a name for your library folder:", "My Hymns");
  if (!name || !name.trim()) return null;
  return name.trim();
}

async function pickFolderWeb(): Promise<FileSystemDirectoryHandle | null> {
  if (!("showDirectoryPicker" in window)) {
    throw new Error(
      "Folder selection requires Chrome, Edge, or the desktop app."
    );
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await persistHandle(handle);
    return handle;
  } catch (err: any) {
    if (err.name === "AbortError") return null;
    throw err;
  }
}

function createNativeHandle(name: string): NativeDirectoryHandle {
  return new NativeDirectoryHandle(name);
}

class NativeDirectoryHandle {
  kind: "directory" = "directory";
  name: string;
  private basePath: string;

  constructor(name: string) {
    this.name = name;
    this.basePath = `${CAPACITOR_SUBFOLDER}/${name}`;
  }

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    try {
      const result = await Filesystem.readdir({
        path: this.basePath,
        directory: Directory.Documents,
      });
      for (const entry of result.files) {
        const entryPath = `${this.basePath}/${entry.name}`;
        const isDir = entry.type === "directory";
        const handle = isDir
          ? new NativeDirectoryHandle(entry.name)
          : new NativeFileHandle(entryPath);
        yield [entry.name, handle as unknown as FileSystemHandle];
      }
    } catch {
      // Directory doesn't exist yet
    }
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<NativeFileHandle> {
    return new NativeFileHandle(`${this.basePath}/${name}`);
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<NativeDirectoryHandle> {
    if (options?.create) {
      await Filesystem.mkdir({
        path: `${this.basePath}/${name}`,
        directory: Directory.Documents,
        recursive: true,
      });
    }
    return new NativeDirectoryHandle(name);
  }

  async removeEntry(name: string): Promise<void> {
    await Filesystem.deleteFile({
      path: `${this.basePath}/${name}`,
      directory: Directory.Documents,
    });
  }
}

class NativeFileHandle {
  kind: "file" = "file";
  name: string;
  private fullPath: string;

  constructor(fullPath: string) {
    this.fullPath = fullPath;
    this.name = fullPath.split("/").pop() || fullPath;
  }

  async getFile(): Promise<File> {
    const result = await Filesystem.readFile({
      path: this.fullPath,
      directory: Directory.Documents,
    });

    const base64 = result.data as string;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new File([bytes], this.name, { type: "application/zip" });
  }

  async createWritable(): Promise<NativeWritableStream> {
    return new NativeWritableStream(this.fullPath);
  }
}

class NativeWritableStream {
  private path: string;
  private chunks: (ArrayBuffer | Blob | string)[] = [];

  constructor(path: string) {
    this.path = path;
  }

  async write(data: BufferSource | Blob | string): Promise<void> {
    this.chunks.push(data);
  }

  async close(): Promise<void> {
    const parts: Uint8Array[] = [];
    for (const chunk of this.chunks) {
      if (typeof chunk === "string") {
        const encoder = new TextEncoder();
        parts.push(encoder.encode(chunk));
      } else if (chunk instanceof Blob) {
        const buf = await chunk.arrayBuffer();
        parts.push(new Uint8Array(buf));
      } else {
        parts.push(new Uint8Array(chunk));
      }
    }

    const totalSize = parts.reduce((acc, p) => acc + p.length, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.length;
    }

    const base64 = btoa(
      Array.from(combined)
        .map((b) => String.fromCharCode(b))
        .join("")
    );

    await Filesystem.writeFile({
      path: this.path,
      data: base64,
      directory: Directory.Documents,
      encoding: undefined as any,
    });
  }
}

export async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  const tx = db.transaction("handles", "readwrite");
  tx.objectStore("handles").put(handle, HANDLE_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (isNativePlatform()) {
    return getStoredHandleNative();
  }
  return getStoredHandleWeb();
}

async function getStoredHandleNative(): Promise<FileSystemDirectoryHandle | null> {
  const folderName = localStorage.getItem(CAPACITOR_FOLDER_KEY);
  if (!folderName) return null;

  try {
    await Filesystem.mkdir({
      path: `${CAPACITOR_SUBFOLDER}/${folderName}`,
      directory: Directory.Documents,
      recursive: true,
    });
    return createNativeHandle(folderName);
  } catch {
    return null;
  }
}

async function getStoredHandleWeb(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    const tx = db.transaction("handles", "readonly");
    const req = tx.objectStore("handles").get(HANDLE_KEY);
    const handle: FileSystemDirectoryHandle | undefined = await new Promise(
      (resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    if (!handle) return null;
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return null;
    return handle;
  } catch {
    return null;
  }
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("VocalisFolderHandles", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listZipFiles(
  handle: FileSystemDirectoryHandle
): Promise<{ name: string; fileHandle: FileSystemFileHandle }[]> {
  const results: { name: string; fileHandle: FileSystemFileHandle }[] = [];
  for await (const [key, value] of handle.entries()) {
    if (
      value.kind === "file" &&
      key.toLowerCase().endsWith(".zip")
    ) {
      results.push({ name: key, fileHandle: value as unknown as FileSystemFileHandle });
    }
  }
  return results;
}

export async function writeZipToFolder(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  data: ArrayBuffer
): Promise<void> {
  const zipName = fileName.toLowerCase().endsWith(".zip") ? fileName : `${fileName}.zip`;
  const fileHandle = await handle.getFileHandle(zipName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function readZipFromFolder(
  fileHandle: FileSystemFileHandle
): Promise<File> {
  const file = await fileHandle.getFile();
  return file;
}

export async function deleteZipFromFolder(
  handle: FileSystemDirectoryHandle,
  fileName: string
): Promise<void> {
  const zipName = fileName.toLowerCase().endsWith(".zip") ? fileName : `${fileName}.zip`;
  await handle.removeEntry(zipName);
}

export async function getFolderName(
  handle: FileSystemDirectoryHandle
): Promise<string> {
  return handle.name;
}
