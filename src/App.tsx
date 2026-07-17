import { useState, useEffect, useRef, FormEvent } from "react";
import { Hymn, Voice } from "./types";
import { player } from "./lib/audioEngine";
import { getAllHymns, saveHymn, deleteHymn } from "./lib/db";
import { generateDemoHymns } from "./lib/demoHymns";
import { downloadAndSynthesizeOnlineHymn, OnlineHymnItem } from "./lib/onlineRepository";
import { pickFolder, getStoredHandle, listZipFiles, writeZipToFolder, readZipFromFolder, deleteZipFromFolder } from "./lib/folderManager";
import { HymnList } from "./components/HymnList";
import { PlaybackControls } from "./components/PlaybackControls";
import { ChannelStrip } from "./components/ChannelStrip";
import { Dropzone } from "./components/Dropzone";
import { Toast, ToastMessage } from "./components/Toast";
import { motion, AnimatePresence } from "motion/react";
import { Sliders, Volume2, Plus, Info, RefreshCw, X, Edit3, Music, AlertTriangle, Folder, FolderOpen, ArrowRight, Check, Play, Pause, Square, Repeat } from "lucide-react";
import { LiveUpdate } from "@capawesome/capacitor-live-update";

const VOICE_ORDER: Record<string, number> = {
  soprano: 1,
  alto: 2,
  tenor: 3,
  bass: 4,
  base: 4,
  lead: 5,
  accompaniment: 6,
  organ: 7,
};

function getVoiceOrder(name: string): number {
  const norm = name.toLowerCase();
  for (const [key, value] of Object.entries(VOICE_ORDER)) {
    if (norm.includes(key)) {
      return value;
    }
  }
  return 99;
}

export default function App() {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [activeHymn, setActiveHymn] = useState<Hymn | null>(null);

  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [assignedFolderName, setAssignedFolderName] = useState<string>(() => {
    return localStorage.getItem("vocalis_assigned_folder_name") || "";
  });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showHymnSidebar, setShowHymnSidebar] = useState(false);
  const [showMixer, setShowMixer] = useState(false);

  // Mirrors of player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.8);

  // UI state overlays
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isLoadingActiveHymn, setIsLoadingActiveHymn] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [movingHymnId, setMovingHymnId] = useState<string | null>(null);
  const [moveFolderInput, setMoveFolderInput] = useState<string>("");

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Password ZIP support state
  const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [zipPasswordInput, setZipPasswordInput] = useState("");

  // Import folder picker state
  const [importFolder, setImportFolder] = useState<string>("offline-cache");

  // Toast notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pushToast = (type: ToastMessage["type"], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initialize: restore folder handle, scan folder, load library
  useEffect(() => {
    const initializeLibrary = async () => {
      try {
        // Try to restore folder handle from previous session
        const storedHandle = await getStoredHandle();
        if (storedHandle) {
          setFolderHandle(storedHandle);
          setAssignedFolderName(storedHandle.name);
          localStorage.setItem("vocalis_assigned_folder_name", storedHandle.name);

          // Scan folder for ZIPs and load them
          await syncFolderToLibrary(storedHandle);
        } else {
          // No folder handle, load from IndexedDB only
          let loaded = await getAllHymns();
          const demoTracks = loaded.filter(h => h.isDemo);
          if (demoTracks.length > 0) {
            for (const demo of demoTracks) {
              await deleteHymn(demo.id);
            }
            loaded = await getAllHymns();
          }
          setHymns(loaded);
          if (loaded.length > 0) {
            handleSelectHymn(loaded[0]);
          }
        }
      } catch (err) {
        console.error("Library initialization failed:", err);
      }
    };
    initializeLibrary();
  }, []);

  // Scan the assigned folder and load hymns from it
  const syncFolderToLibrary = async (handle: FileSystemDirectoryHandle) => {
    const { parseHymnZipWorker } = await import("./lib/zipParser");
    const zipFiles = await listZipFiles(handle);
    const loaded = await getAllHymns();
    const existingNames = new Set(loaded.map(h => h.name.toLowerCase()));
    let added = 0;

    for (const { name, fileHandle } of zipFiles) {
      const displayName = name.replace(/\.zip$/i, "").replace(/[_%\-+]/g, " ")
        .split(" ").filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

      if (existingNames.has(displayName.toLowerCase())) continue;

      try {
        const file = await readZipFromFolder(fileHandle);
        const hymn = await parseHymnZipWorker(file);
        await saveHymn(hymn);
        added++;
      } catch (err) {
        console.warn(`Failed to parse ${name} from folder:`, err);
      }
    }

    const final = await getAllHymns();
    setHymns(final);
    if (final.length > 0 && !activeHymn) {
      handleSelectHymn(final[0]);
    }
  };

  // Assign or change the filesystem folder
  const handlePickFolder = async () => {
    try {
      const handle = await pickFolder();
      if (!handle) return;
      setFolderHandle(handle);
      setAssignedFolderName(handle.name);
      localStorage.setItem("vocalis_assigned_folder_name", handle.name);
      await syncFolderToLibrary(handle);
    } catch (err: any) {
      pushToast("error", err.message || "Failed to select folder.");
    }
  };

  // Write a ZIP file to the assigned folder
  const writeToFolder = async (fileName: string, data: ArrayBuffer) => {
    let handle = folderHandle;
    if (!handle) {
      handle = await getStoredHandle();
      if (handle) {
        setFolderHandle(handle);
      }
    }
    if (!handle) return;
    try {
      await writeZipToFolder(handle, fileName, data);
    } catch (err) {
      console.error("Failed to write to assigned folder:", err);
    }
  };

  // Delete a ZIP file from the assigned folder
  const deleteFromFolder = async (hymnName: string) => {
    let handle = folderHandle;
    if (!handle) {
      handle = await getStoredHandle();
      if (handle) {
        setFolderHandle(handle);
      }
    }
    if (!handle) return;
    try {
      const zips = await listZipFiles(handle);
      const normalizedName = hymnName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = zips.find(z => {
        const clean = z.name.toLowerCase().replace(/\.zip$/i, "").replace(/[^a-z0-9]/g, "");
        return clean === normalizedName;
      });
      if (match) {
        await deleteZipFromFolder(handle, match.name);
      }
    } catch (err) {
      console.error("Failed to delete from assigned folder:", err);
    }
  };

  // Sync callbacks with Web Audio Engine
  useEffect(() => {
    player.setCallbacks(
      () => {
        // State update callback
        const state = player.getPlaybackState();
        setIsPlaying(state.isPlaying);
        setIsLooping(state.isLooping);
        setDuration(state.duration);
        setMasterVolume(state.masterVolume);
      },
      () => {
        // Playback finished callback
        setIsPlaying(false);
        setCurrentTime(0);
      }
    );
  }, []);

  // Live Update: check for updates on app launch (Android/iOS only)
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const { isNativePlatform } = await import("@capacitor/core");
        if (!isNativePlatform()) return;

        // Notify plugin app is ready (prevents rollback)
        await LiveUpdate.ready();

        // Fetch version manifest from GitHub Pages
        const response = await fetch(
          "https://nicodiola120.github.io/vocalis/version.json",
          { cache: "no-store" }
        );
        if (!response.ok) return;

        const manifest = await response.json();
        const currentVersion = localStorage.getItem("vocalis_version") || "0.0.0";

        if (manifest.version && manifest.version !== currentVersion && manifest.bundleUrl) {
          console.log(`[LiveUpdate] New version available: ${manifest.version} (current: ${currentVersion})`);

          // Download the new bundle
          await LiveUpdate.downloadBundle({
            url: manifest.bundleUrl,
            bundleId: manifest.bundleId,
          });

          // Set it as next bundle and reload
          await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
          localStorage.setItem("vocalis_version", manifest.version);
          await LiveUpdate.reload();
        } else {
          console.log(`[LiveUpdate] App is up to date (${currentVersion})`);
        }
      } catch (err) {
        console.log("[LiveUpdate] Update check skipped:", err);
      }
    };

    checkForUpdates();
  }, []);

  // Frame-accurate animation ticker to drive timeline scrubbers
  useEffect(() => {
    let animFrameId: number;
    const tick = () => {
      if (player.getPlaybackState().isPlaying) {
        setCurrentTime(player.getCurrentTime());
      }
      animFrameId = requestAnimationFrame(tick);
    };
    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  // Listen for toast events from child components (e.g. HymnList)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type && detail?.message) {
        pushToast(detail.type, detail.message);
      }
    };
    window.addEventListener("vocalis-toast", handler);
    return () => window.removeEventListener("vocalis-toast", handler);
  }, []);

  // Keyboard shortcut (Spacebar) to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            (activeEl as HTMLElement).isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        if (activeHymn) {
          if (isPlaying) {
            player.pause();
          } else {
            player.play();
          }
        }
      }
      // Android hardware volume buttons → master volume
      if (e.keyCode === 24 || e.keyCode === 166) {
        e.preventDefault();
        const next = Math.min(1, masterVolume + 0.05);
        player.setMasterVolume(next);
        setMasterVolume(next);
      }
      if (e.keyCode === 25 || e.keyCode === 167) {
        e.preventDefault();
        const next = Math.max(0, masterVolume - 0.05);
        player.setMasterVolume(next);
        setMasterVolume(next);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, activeHymn, masterVolume]);

  // Handles active hymn loading with progress bars
  const handleSelectHymn = async (hymn: Hymn) => {
    setIsLoadingActiveHymn(true);
    setLoadProgress(0);
    try {
      player.stop();
      setActiveHymn(hymn);
      await player.loadHymn(hymn, (progress) => {
        setLoadProgress(progress);
      });
      // Capture calculated audio buffer durations
      const state = player.getPlaybackState();
      setDuration(state.duration);
      setCurrentTime(0);

      // Persist the actual calculated duration in IndexedDB and component state if it differs
      if (state.duration > 0 && Math.abs((hymn.duration || 0) - state.duration) > 0.5) {
        const updatedHymn = { ...hymn, duration: state.duration };
        await saveHymn(updatedHymn);
        setActiveHymn(updatedHymn);
        setHymns((prevHymns) =>
          prevHymns.map((h) => (h.id === hymn.id ? updatedHymn : h))
        );
      }
    } catch (err) {
      console.error("Failed to load chosen hymn track:", err);
    } finally {
      setIsLoadingActiveHymn(false);
    }
  };

  // Import ZIP package handler
  const handleFileAccepted = async (file: File) => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      // Lazy load Zip parser dynamically to optimize bundle load sizes
      const { parseHymnZipWorker } = await import("./lib/zipParser");
      const hymn = await parseHymnZipWorker(file);
      hymn.folder = importFolder || assignedFolderName || "offline-cache";

      // Write ZIP to assigned folder
      const arrayBuffer = await file.arrayBuffer();
      const zipFileName = file.name.endsWith(".zip") ? file.name : `${file.name}.zip`;
      await writeToFolder(zipFileName, arrayBuffer);

      await saveHymn(hymn);

      const loaded = await getAllHymns();
      setHymns(loaded);

      setImportSuccess(`Imported "${hymn.name}" with ${hymn.voices.length} active parts!`);
      pushToast("success", `Imported "${hymn.name}"`);
      handleSelectHymn(hymn);

      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess(null);
      }, 2200);
    } catch (err: any) {
      if (err.isPasswordRequired) {
        setPendingZipFile(file);
        setShowPasswordPrompt(true);
        setImportError(null);
      } else {
        setImportError(err.message || "Failed to parse ZIP file.");
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingZipFile) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const { parseHymnZipWorker } = await import("./lib/zipParser");
      const hymn = await parseHymnZipWorker(pendingZipFile, zipPasswordInput);
      hymn.folder = importFolder || assignedFolderName || "offline-cache";

      // Write ZIP to assigned folder
      const arrayBuffer = await pendingZipFile.arrayBuffer();
      const zipFileName = pendingZipFile.name.endsWith(".zip") ? pendingZipFile.name : `${pendingZipFile.name}.zip`;
      await writeToFolder(zipFileName, arrayBuffer);

      await saveHymn(hymn);

      const loaded = await getAllHymns();
      setHymns(loaded);

      setImportSuccess(`Imported "${hymn.name}" with ${hymn.voices.length} active parts!`);
      pushToast("success", `Imported "${hymn.name}"`);
      handleSelectHymn(hymn);

      // Clean up states
      setPendingZipFile(null);
      setZipPasswordInput("");
      setShowPasswordPrompt(false);

      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess(null);
      }, 2200);
    } catch (err: any) {
      setImportError(err.message || "Incorrect password or decryption error.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteHymn = async (id: string) => {
    try {
      const target = hymns.find(h => h.id === id);
      if (target) {
        await deleteFromFolder(target.name);
      }
      if (activeHymn?.id === id) {
        player.stop();
        setActiveHymn(null);
      }
      await deleteHymn(id);
      const loaded = await getAllHymns();
      setHymns(loaded);
      if (loaded.length > 0) {
        handleSelectHymn(loaded[0]);
      } else {
        setDuration(0);
        setCurrentTime(0);
      }
    } catch (err) {
      console.error("Delete track failed:", err);
    }
  };

  const handleMoveHymn = async (hymnId: string, destFolder: string) => {
    try {
      const target = hymns.find((h) => h.id === hymnId);
      if (!target) return;
      const updated = { ...target, folder: destFolder.trim() || "offline-cache" };
      await saveHymn(updated);
      
      const loaded = await getAllHymns();
      setHymns(loaded);
      
      if (activeHymn?.id === hymnId) {
        setActiveHymn(updated);
      }
      setMovingHymnId(null);
      setMoveFolderInput("");
    } catch (err) {
      console.error("Failed to move hymn:", err);
    }
  };

  const handleResetDemoCommit = async () => {
    setShowResetConfirmModal(false);
    player.stop();
    player.clearCache();
    setActiveHymn(null);

    const loaded = await getAllHymns();
    for (const h of loaded) {
      await deleteHymn(h.id);
    }

    const demos = generateDemoHymns();
    for (const d of demos) {
      await saveHymn(d);
    }

    const fresh = await getAllHymns();
    setHymns(fresh);
    if (fresh.length > 0) {
      handleSelectHymn(fresh[0]);
    }
  };

  // Modifies channel fader levels and pushes them into Audio Engine and DB state
  const volumeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVoiceVolume = async (voiceId: string, vol: number) => {
    if (!activeHymn) return;
    const updatedVoices = activeHymn.voices.map((v) => {
      if (v.id === voiceId) {
        return { ...v, volume: vol, isMuted: false };
      }
      return v;
    });
    const updatedHymn = { ...activeHymn, voices: updatedVoices };
    player.updateActiveHymn(updatedHymn);
    player.updateAllVoiceGains();
    setActiveHymn(updatedHymn);
    // Debounce only the IndexedDB write
    if (volumeSaveTimerRef.current) clearTimeout(volumeSaveTimerRef.current);
    volumeSaveTimerRef.current = setTimeout(() => {
      saveHymn(updatedHymn);
    }, 500);
  };

  // Solo logic (exclusive listening state)
  const handleVoiceSolo = async (voiceId: string) => {
    if (!activeHymn) return;
    const updatedVoices = activeHymn.voices.map((v) => {
      if (v.id === voiceId) {
        return { ...v, isSolo: !v.isSolo };
      }
      return v;
    });

    const updatedHymn = { ...activeHymn, voices: updatedVoices };
    player.updateActiveHymn(updatedHymn);
    player.updateAllVoiceGains();
    setActiveHymn(updatedHymn);
    await saveHymn(updatedHymn);
  };

  // Mute logic (silence track state)
  const handleVoiceMute = async (voiceId: string) => {
    if (!activeHymn) return;
    const updatedVoices = activeHymn.voices.map((v) => {
      if (v.id === voiceId) {
        return { ...v, isMuted: !v.isMuted };
      }
      return v;
    });

    const updatedHymn = { ...activeHymn, voices: updatedVoices };
    player.updateActiveHymn(updatedHymn);
    player.updateAllVoiceGains();
    setActiveHymn(updatedHymn);
    await saveHymn(updatedHymn);
  };

  // Modifies channel pan levels and pushes them into Audio Engine and DB state
  const handleVoicePan = async (voiceId: string, pan: number) => {
    if (!activeHymn) return;
    const updatedVoices = activeHymn.voices.map((v) => {
      if (v.id === voiceId) {
        return { ...v, pan };
      }
      return v;
    });

    const updatedHymn = { ...activeHymn, voices: updatedVoices };
    player.updateActiveHymn(updatedHymn);
    const targetVoice = updatedVoices.find((v) => v.id === voiceId);
    if (targetVoice) {
      player.updateVoicePan(targetVoice);
    }
    setActiveHymn(updatedHymn);
    await saveHymn(updatedHymn);
  };

  const handleDownloadOnlineHymn = async (item: OnlineHymnItem, onProgress: (msg: string) => void) => {
    try {
      const result = await downloadAndSynthesizeOnlineHymn(item, onProgress);
      const downloadedHymn = result.hymn;
      downloadedHymn.folder = assignedFolderName || "offline-cache";
      
      // Write ZIP to assigned folder if we have the raw data
      if (result.zipData) {
        const zipFileName = `${item.name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}.zip`;
        await writeToFolder(zipFileName, result.zipData);
      }
      
      // Save it to IndexedDB
      await saveHymn(downloadedHymn);
      
      // Update state
      setHymns((prev) => [downloadedHymn, ...prev]);
      
      // Select the downloaded hymn immediately so the user can hear it!
      await handleSelectHymn(downloadedHymn);
    } catch (err) {
      console.error("Failed downloading and synthesizing online hymn:", err);
      throw err;
    }
  };

  const triggerRenameDialog = () => {
    if (!activeHymn) return;
    setRenameValue(activeHymn.name);
    setShowRenameModal(true);
  };

  const handleRenameCommit = async () => {
    if (!activeHymn || !renameValue.trim()) return;
    const updated = { ...activeHymn, name: renameValue.trim() };
    await saveHymn(updated);
    setActiveHymn(updated);
    
    // Reload list
    const loaded = await getAllHymns();
    setHymns(loaded);
    setShowRenameModal(false);
    pushToast("success", `Renamed to "${renameValue.trim()}"`);
  };

  return (
    <div className="flex flex-col h-screen w-screen app-bg text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* Header bar — normal flow, hidden in mixer */}
      {!showMixer && (
        <header className="h-12 border-b border-white/5 bg-white/5 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHymnSidebar(!showHymnSidebar)}
              className="p-1.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/30 text-white border border-blue-400/20 cursor-pointer hover:bg-blue-500 transition-colors"
            >
              <Sliders className="h-4 w-4" />
            </button>
            <span className="font-display font-bold text-sm tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-blue-200 to-blue-100">
              VOCALIS • Choir Voice Mixer
            </span>
          </div>
        </header>
      )}

      {/* Sidebar toggle — removed in mixer, accessible when mixer is closed */}

      {/* Main workspace layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation - Hidden by default, toggled via button */}
        <AnimatePresence>
          {showHymnSidebar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setShowHymnSidebar(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showHymnSidebar && (
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-12 bottom-0 z-50"
            >
              <HymnList
                hymns={hymns}
                activeHymnId={activeHymn?.id || null}
                onSelectHymn={(h) => { handleSelectHymn(h); setShowHymnSidebar(false); }}
                onDeleteHymn={handleDeleteHymn}
                onAddClick={() => setShowImportModal(true)}
                onResetDemo={() => setShowResetConfirmModal(true)}
                assignedFolderName={assignedFolderName}
                onFolderClick={handlePickFolder}
                onDownloadOnlineHymn={handleDownloadOnlineHymn}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Workspace */}
        <main className="flex-1 overflow-hidden bg-transparent flex flex-col relative">
          
          {isLoadingActiveHymn ? (
            /* Loading State Backdrop */
            <div className="absolute inset-0 bg-[#05070a]/60 backdrop-blur-xl z-40 flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
              <div className="flex flex-col items-center gap-1.5">
                <span className="font-semibold text-sm text-slate-200">
                  Decoding Audio Tracks
                </span>
                <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {loadProgress}% complete
                </span>
              </div>
            </div>
          ) : null}

          {activeHymn ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Playback controls - fills available space */}
              <div className="flex-1 min-h-0 px-4 lg:px-8 pt-4 pb-4">
                <div className="max-w-7xl mx-auto w-full h-full">
                  <PlaybackControls
                    name={activeHymn.name}
                    isPlaying={isPlaying}
                    isLooping={isLooping}
                    currentTime={currentTime}
                    duration={duration}
                    masterVolume={masterVolume}
                    onPlay={() => player.play()}
                    onPause={() => player.pause()}
                    onStop={() => player.stop()}
                    onLoopToggle={() => player.setLooping(!isLooping)}
                    onVolumeChange={(vol) => { player.setMasterVolume(vol); setMasterVolume(vol); }}
                    onSeek={(secs) => player.seek(secs)}
                    onRename={triggerRenameDialog}
                    lyrics={activeHymn.lyrics}
                    music={activeHymn.music}
                    arranger={activeHymn.arranger}
                    info={activeHymn.info}
                    tags={activeHymn.tags}
                    showMixer={showMixer}
                    onToggleMixer={() => setShowMixer(!showMixer)}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Blank state if no tracks are chosen */
            <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-md mx-auto text-center gap-6">
              <div className="p-4 bg-white/5 rounded-3xl border border-white/10 text-slate-400 shadow-xl">
                <Music className="h-10 w-10 text-blue-400 animate-pulse" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display font-bold text-slate-200 text-lg">
                  No Track Selected
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Select a hymn track from the sidebar to start practicing, or import a zipped choir pack to load custom multi-channel recordings.
                </p>
              </div>
              <button
                id="btn-blank-import"
                onClick={() => setShowImportModal(true)}
                className="py-2.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs border border-blue-400/20 shadow-md shadow-blue-600/10 cursor-pointer"
              >
                Import ZIP Bundle
              </button>
            </div>
          )}

          {/* Full-screen mixer overlay */}
          {activeHymn && showMixer && (
            <div className="absolute inset-0 z-30 bg-[#05070a]/95 backdrop-blur-xl flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-4 lg:px-8 pt-3 pb-2 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2 shrink-0">
                  <Music className="h-3.5 w-3.5 text-blue-400" />
                  <h3 className="font-display font-semibold text-slate-300 text-xs tracking-wide">
                    MIXER
                  </h3>
                  <span className="text-[9px] font-mono text-slate-500">
                    {activeHymn.voices.length}CH
                  </span>
                </div>
                {/* Hymn name — truncated */}
                <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[120px]" title={activeHymn.name}>
                  {activeHymn.name}
                </span>
                {/* Scrub bar — landscape only */}
                <div className="flex-1 min-w-0 hidden landscape:block">
                  <input
                    id="mixer-timeline-scrub"
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => player.seek(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer focus:outline-none accent-blue-500
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-500"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-slate-500 mt-0.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Play / Pause toggle */}
                  <button
                    onClick={() => isPlaying ? player.pause() : player.play()}
                    className={`p-2 rounded-lg border cursor-pointer transition-all ${
                      isPlaying
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  {/* Stop */}
                  <button
                    onClick={() => player.stop()}
                    className="p-2 rounded-lg border bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-all"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                  {/* Loop toggle */}
                  <button
                    onClick={() => player.setLooping(!isLooping)}
                    className={`p-2 rounded-lg border cursor-pointer transition-all ${
                      isLooping
                        ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                        : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Toggle Loop"
                  >
                    <Repeat className="h-4 w-4" />
                  </button>
                  {/* Master volume */}
                  <Volume2 className="h-3.5 w-3.5 text-slate-500 shrink-0 hidden landscape:block" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={masterVolume}
                    onChange={(e) => { player.setMasterVolume(parseFloat(e.target.value)); setMasterVolume(parseFloat(e.target.value)); }}
                    className="w-16 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 hidden landscape:block"
                  />
                </div>
                <button
                  id="btn-close-mixer"
                  onClick={() => setShowMixer(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 cursor-pointer transition-all text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <X className="h-4 w-4" />
                  CLOSE
                </button>
              </div>
              {/* Scrub bar below header in portrait only */}
              <div className="px-4 lg:px-8 pt-2 pb-1 shrink-0 border-b border-white/5 landscape:hidden">
                <input
                  id="mixer-timeline-scrub-portrait"
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => player.seek(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer focus:outline-none accent-blue-500
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-500"
                />
                <div className="flex items-center justify-between mt-1">
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 flex-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    <Volume2 className="h-3 w-3 text-slate-500" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={masterVolume}
                      onChange={(e) => { player.setMasterVolume(parseFloat(e.target.value)); setMasterVolume(parseFloat(e.target.value)); }}
                      className="w-14 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden px-4 lg:px-8 py-4 flex flex-col">
                <div className="flex flex-row gap-3 w-full max-w-7xl mx-auto flex-1 min-h-0">
                  {[...activeHymn.voices]
                    .sort((a, b) => getVoiceOrder(a.name) - getVoiceOrder(b.name))
                    .map((voice) => (
                          <div key={voice.id} className="flex-1 min-w-0 h-full flex flex-col">
                        <ChannelStrip
                          voice={voice}
                          onVolumeChange={(vol) => handleVoiceVolume(voice.id, vol)}
                          onMuteToggle={() => handleVoiceMute(voice.id)}
                          onSoloToggle={() => handleVoiceSolo(voice.id)}
                          onPanChange={(pan) => handleVoicePan(voice.id, pan)}
                          isPlaying={isPlaying}
                          expanded
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer statistics bar */}
      <footer className="h-8 border-t border-white/5 bg-white/5 px-4 lg:px-6 flex items-center justify-between shrink-0 text-[10px] text-slate-500 select-none overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="hidden sm:inline">All voices are synchronized</span>
          <span className="sm:hidden">Synced</span>
        </div>
        
        <div className="font-mono text-[10px] tracking-wide flex items-center gap-2 lg:gap-4 shrink-0">
          <span className="hidden sm:inline">44100 Hz</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden md:inline">32-bit float</span>
          <span className="hidden md:inline">•</span>
          <span className="text-blue-400 font-semibold uppercase">
            {activeHymn ? `${activeHymn.voices.length}CH` : "0CH"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Volume2 className="h-3.5 w-3.5" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => { player.setMasterVolume(parseFloat(e.target.value)); setMasterVolume(parseFloat(e.target.value)); }}
            className="w-20 lg:w-28 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>
      </footer>

      {/* --- POPUP OVERLAY MODAL: ZIP IMPORT --- */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0c15]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative"
            >
              <button
                id="close-import-modal"
                onClick={() => {
                  if (!isImporting) setShowImportModal(false);
                }}
                className="absolute top-4 right-4 p-1 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-pointer"
                disabled={isImporting}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-2xl">
                  <Sliders className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <h3 className="font-display font-bold text-slate-200 text-sm">
                    Import Choir Tracks
                  </h3>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    ZIP Archive Bundle
                  </span>
                </div>
              </div>

              <Dropzone
                onFileAccepted={handleFileAccepted}
                isProcessing={isImporting}
                errorMsg={importError}
                successMsg={importSuccess}
              />

              <div className="mt-4 space-y-2">
                <label className="text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase block">
                  Save to Folder
                </label>
                <div className="flex gap-2">
                  <select
                    id="import-folder-select"
                    value={importFolder}
                    onChange={(e) => setImportFolder(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {(() => {
                      const existingFolders = Array.from(
                        new Set(hymns.map((h) => h.folder || "offline-cache"))
                      ) as string[];
                      if (!existingFolders.includes("offline-cache")) {
                        existingFolders.unshift("offline-cache");
                      }
                      return existingFolders.map((f) => (
                        <option key={f} value={f} className="bg-[#0b0c15] text-slate-200">
                          {f}
                        </option>
                      ));
                    })()}
                  </select>
                  <input
                    id="import-folder-new"
                    type="text"
                    value={(() => {
                      const known = hymns.map((h) => h.folder || "offline-cache");
                      const unique = Array.from(new Set(known));
                      return unique.includes(importFolder) ? "" : importFolder;
                    })()}
                    onChange={(e) => setImportFolder(e.target.value.trim() || "offline-cache")}
                    placeholder="or type new..."
                    className="w-36 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- POPUP OVERLAY MODAL: RENAME HYMN --- */}
      <AnimatePresence>
        {showRenameModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0c15]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-left"
            >
              <button
                id="close-rename-modal"
                onClick={() => setShowRenameModal(false)}
                className="absolute top-4 right-4 p-1 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-2xl">
                  <Edit3 className="h-4 w-4" />
                </div>
                <h3 className="font-display font-bold text-slate-200 text-sm">
                  Rename Hymn Track
                </h3>
              </div>

              <div className="space-y-4">
                <input
                  id="rename-hymn-input"
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="Hymn Name"
                />
                
                <div className="flex gap-2 justify-end">
                  <button
                    id="rename-cancel"
                    onClick={() => setShowRenameModal(false)}
                    className="py-1.5 px-3 rounded-lg text-slate-400 hover:text-slate-200 font-semibold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="rename-save"
                    onClick={handleRenameCommit}
                    className="py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer border border-blue-400/20 shadow-md shadow-blue-600/10"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- POPUP OVERLAY MODAL: ZIP PASSWORD PROMPT --- */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0c15]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-left"
            >
              <button
                id="close-password-modal"
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setPendingZipFile(null);
                  setZipPasswordInput("");
                }}
                className="absolute top-4 right-4 p-1 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-600/15 border border-yellow-500/20 text-yellow-400 rounded-2xl">
                  <Info className="h-4 w-4" />
                </div>
                <h3 className="font-display font-bold text-slate-200 text-sm">
                  Password Required
                </h3>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  This ZIP archive is protected by a password. Please enter the password to decrypt and import the tracks.
                </p>

                <input
                  id="zip-password-input"
                  type="password"
                  value={zipPasswordInput}
                  onChange={(e) => setZipPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="Enter archive password"
                  autoFocus
                  required
                />

                {importError && (
                  <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                    {importError}
                  </div>
                )}
                
                <div className="flex gap-2 justify-end">
                  <button
                    id="password-cancel"
                    type="button"
                    onClick={() => {
                      setShowPasswordPrompt(false);
                      setPendingZipFile(null);
                      setZipPasswordInput("");
                    }}
                    className="py-1.5 px-3 rounded-lg text-slate-400 hover:text-slate-200 font-semibold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="password-submit"
                    type="submit"
                    disabled={isImporting}
                    className="py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer border border-blue-400/20 shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                  >
                    {isImporting ? "Decrypting..." : "Decrypt & Import"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- POPUP OVERLAY MODAL: CONFIRM RESEED/RESET DEMOS --- */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0c15]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-left"
            >
              <button
                id="close-reset-confirm-modal"
                onClick={() => setShowResetConfirmModal(false)}
                className="absolute top-4 right-4 p-1 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-600/15 border border-amber-500/20 text-amber-400 rounded-2xl">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="font-display font-bold text-slate-200 text-sm">
                  Reseed Demo Hymns?
                </h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  This action will erase all of your custom imported hymns and restore the default high-fidelity demo hymns. This cannot be undone.
                </p>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    id="reset-confirm-cancel"
                    onClick={() => setShowResetConfirmModal(false)}
                    className="py-1.5 px-3 rounded-lg text-slate-400 hover:text-slate-200 font-semibold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="reset-confirm-proceed"
                    onClick={handleResetDemoCommit}
                    className="py-1.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer border border-amber-400/20 shadow-md shadow-amber-600/10"
                  >
                    Reseed Library
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- POPUP OVERLAY MODAL: ASSIGN FILESYSTEM FOLDER --- */}
      <AnimatePresence>
        {showFolderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0c15]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-left"
            >
              <button
                id="close-folder-modal"
                onClick={() => setShowFolderModal(false)}
                className="absolute top-4 right-4 p-1 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-2xl">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-display font-bold text-slate-200 text-sm">
                    Assigned Library Folder
                  </h3>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Source of Truth for All Hymns
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  All hymns are saved as ZIP files inside your chosen folder. This folder is the library source — hymns imported, downloaded from cloud, or dragged in are always stored here.
                </p>

                {assignedFolderName && (
                  <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <Folder className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-xs text-blue-300 font-semibold">{assignedFolderName}</span>
                  </div>
                )}

                <button
                  id="btn-pick-folder"
                  onClick={async () => {
                    await handlePickFolder();
                    setShowFolderModal(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs border border-blue-400/20 shadow-md shadow-blue-600/10 cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  {assignedFolderName ? "Change Folder" : "Choose Folder on Disk"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}
