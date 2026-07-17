import React, { useState } from "react";
import { Hymn } from "../types";
import { Search, Music, Plus, RotateCw, Trash2, Database, Cloud, Download, Check, Loader2 } from "lucide-react";
import { ONLINE_REPOSITORY, OnlineHymnItem } from "../lib/onlineRepository";

interface HymnListProps {
  hymns: Hymn[];
  activeHymnId: string | null;
  onSelectHymn: (hymn: Hymn) => void;
  onDeleteHymn: (id: string) => void;
  onAddClick: () => void;
  onResetDemo: () => void;
  assignedFolderName: string;
  onFolderClick: () => void;
  onDownloadOnlineHymn?: (item: OnlineHymnItem, onProgress: (msg: string) => void) => Promise<void>;
}

export const HymnList: React.FC<HymnListProps> = ({
  hymns,
  activeHymnId,
  onSelectHymn,
  onDeleteHymn,
  onAddClick,
  onResetDemo,
  assignedFolderName,
  onFolderClick,
  onDownloadOnlineHymn,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"local" | "online">("local");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState("");

  // Cloud repos state & refresh
  const [onlineHymns, setOnlineHymns] = useState<OnlineHymnItem[]>([]);
  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);

  const handleRefreshCloud = async () => {
    setIsRefreshingCloud(true);
    try {
      const { fetchCloudRepositoryFiles, fetchGitHubRepositoryFiles } = await import("../lib/onlineRepository");
      const [driveFiles, githubFiles] = await Promise.allSettled([
        fetchCloudRepositoryFiles(),
        fetchGitHubRepositoryFiles(),
      ]);

      const merged: OnlineHymnItem[] = [
        ...(driveFiles.status === "fulfilled" ? driveFiles.value : []),
        ...(githubFiles.status === "fulfilled" ? githubFiles.value : []),
      ];

      if (merged.length === 0) {
        const errors = [driveFiles, githubFiles]
          .filter((r) => r.status === "rejected")
          .map((r) => (r as PromiseRejectedResult).reason?.message || "Unknown error");
        throw new Error(errors.join("; ") || "No items found from any cloud source.");
      }

      setOnlineHymns(merged);
    } catch (err: any) {
      console.error(err);
      // Emit custom event so parent can show toast instead of alert
      window.dispatchEvent(new CustomEvent("vocalis-toast", { detail: { type: "error", message: err.message || "Failed to refresh cloud repository." } }));
    } finally {
      setIsRefreshingCloud(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredHymns = hymns.filter((h) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    if (h.name.toLowerCase().includes(term)) return true;
    if (h.tags && h.tags.some((tag) => tag.toLowerCase().includes(term))) return true;
    return false;
  });

  const filteredOnlineHymns = onlineHymns.filter((h) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    if (h.name.toLowerCase().includes(term)) return true;
    if (h.tags && h.tags.some((tag) => tag.toLowerCase().includes(term))) return true;
    return false;
  });

  const isAlreadyDownloaded = (name: string) => {
    return hymns.some((h) => h.name.toLowerCase() === name.toLowerCase());
  };

  const handleDownloadClick = async (item: OnlineHymnItem) => {
    if (downloadingId || !onDownloadOnlineHymn) return;
    setDownloadingId(item.id);
    setDownloadProgress("Initiating...");
    try {
      await onDownloadOnlineHymn(item, (msg) => {
        setDownloadProgress(msg);
      });
      setDownloadProgress("Success!");
      setTimeout(() => {
        setDownloadingId(null);
        setDownloadProgress("");
        setActiveTab("local");
      }, 1000);
    } catch (err) {
      console.error(err);
      setDownloadProgress("Failed!");
      setTimeout(() => {
        setDownloadingId(null);
        setDownloadProgress("");
      }, 2000);
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel w-80 shrink-0 select-none shadow-2xl overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-display font-bold text-slate-100 text-base tracking-wide flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-400" />
          HYMNS
        </h2>
        <button
          id="btn-add-hymn"
          onClick={onAddClick}
          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold animate-pulse"
          title="Import ZIP Bundle"
        >
          <Plus className="h-4 w-4" />
          IMPORT
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 py-3 grid grid-cols-2 gap-1.5 border-b border-white/5">
        <button
          id="tab-my-library"
          onClick={() => setActiveTab("local")}
          className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "local"
              ? "bg-blue-500/15 text-blue-300 border border-blue-500/20 shadow-inner"
              : "bg-white/5 text-slate-400 hover:text-slate-300 border border-transparent hover:border-white/5"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          Library
        </button>
        <button
          id="tab-cloud-library"
          onClick={() => setActiveTab("online")}
          className={`py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "online"
              ? "bg-blue-500/15 text-blue-300 border border-blue-500/20 shadow-inner"
              : "bg-white/5 text-slate-400 hover:text-slate-300 border border-transparent hover:border-white/5"
          }`}
        >
          <Cloud className="h-3.5 w-3.5 animate-pulse" />
          Download
        </button>
      </div>

      {/* Search Input & Cloud Refresh */}
      <div className="px-4 pt-4 pb-2 animate-fadeIn flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </span>
          <input
            id="hymns-search"
            type="text"
            placeholder={activeTab === "local" ? "Search local hymns..." : "Search cloud repos..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        {activeTab === "online" && (
          <button
            id="btn-refresh-cloud"
            onClick={handleRefreshCloud}
            disabled={isRefreshingCloud}
            className={`p-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 ${
              isRefreshingCloud ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title="Refresh cloud repository"
          >
            <RotateCw className={`h-4 w-4 ${isRefreshingCloud ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Hymn Items List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {activeTab === "local" ? (
          filteredHymns.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-600 font-medium">
              No hymns found. Try importing a ZIP or resetting demos!
            </div>
          ) : (
            filteredHymns.map((hymn) => {
              const isActive = hymn.id === activeHymnId;
              return (
                <div
                  key={hymn.id}
                  id={`hymn-item-${hymn.id}`}
                  onClick={() => onSelectHymn(hymn)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? "bg-blue-500/15 text-white border-l-4 border-l-blue-500 border-t border-b border-r border-white/10 shadow-lg shadow-blue-500/5"
                      : "text-slate-300 hover:bg-white/5 border border-transparent hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Music className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-400 animate-pulse" : "text-slate-500 group-hover:text-slate-300"}`} />
                    <div className="flex flex-col overflow-hidden text-left">
                      <span className="font-semibold text-xs truncate max-w-[150px]">
                        {hymn.name}
                      </span>
                      {hymn.isDemo && (
                        <span className={`text-[9px] ${isActive ? "text-blue-300" : "text-amber-500/80 font-medium"}`}>
                          Demo Track
                        </span>
                      )}
                      {hymn.tags && hymn.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 max-w-[150px]">
                          {hymn.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`text-[8px] px-1 py-0.2 rounded font-mono truncate max-w-[60px] ${
                                isActive
                                  ? "bg-blue-400/20 text-blue-200 border border-blue-400/20"
                                  : "bg-white/5 text-slate-400 border border-white/5"
                              }`}
                              title={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {deletingId === hymn.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`confirm-delete-${hymn.id}`}
                          onClick={() => {
                            onDeleteHymn(hymn.id);
                            setDeletingId(null);
                          }}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          id={`cancel-delete-${hymn.id}`}
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 rounded bg-white/10 text-slate-300 text-[10px] hover:bg-white/20 cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`font-mono text-[10px] ${isActive ? "text-blue-300" : "text-slate-500"}`}>
                          {formatDuration(hymn.duration)}
                        </span>
                        
                        {/* Delete Button (Visible on mobile/touch, and on hover for desktop) */}
                        <button
                          id={`delete-hymn-${hymn.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(hymn.id);
                          }}
                          className={`p-1 rounded opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                            isActive 
                              ? "text-blue-300 hover:text-white hover:bg-blue-700/30" 
                              : "text-slate-500 hover:text-rose-400 hover:bg-white/5"
                          }`}
                          title="Delete Hymn"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Dynamic online cloud repository list view */
          <div className="space-y-2 pb-4 animate-fadeIn">
            {filteredOnlineHymns.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-600 font-medium">
                No hymns found matching your search.
              </div>
            ) : (
              filteredOnlineHymns.map((item) => {
                const isDownloaded = isAlreadyDownloaded(item.name);
                const isDownloading = downloadingId === item.id;
                
                return (
                  <div
                    key={item.id}
                    id={`online-item-${item.id}`}
                    className="flex flex-col p-3 mx-1 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col text-left overflow-hidden">
                        <span className="font-bold text-xs text-slate-100 truncate">
                          {item.name}
                        </span>
                      </div>

                      <div className="shrink-0">
                        {isDownloaded ? (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 rounded-lg font-bold">
                            <Check className="h-3 w-3 shrink-0" />
                            INSTALLED
                          </div>
                        ) : isDownloading ? (
                          <div className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 border border-blue-500/20 rounded-lg font-bold font-mono">
                            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                            {downloadProgress.split(" ")[0]}
                          </div>
                        ) : (
                          <button
                            id={`download-btn-${item.id}`}
                            onClick={() => handleDownloadClick(item)}
                            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 border border-blue-500/20 hover:border-blue-500/30 rounded-lg font-bold cursor-pointer transition-all"
                            title="Download Choral Stem Bundle"
                          >
                            <Download className="h-3 w-3 shrink-0" />
                            GET
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Downloading status text */}
                    {isDownloading && (
                      <div className="text-[9px] text-blue-300/80 font-semibold font-mono mt-1.5 text-left bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10 animate-pulse">
                        {downloadProgress}
                      </div>
                    )}

                    {/* Metadata labels */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[8px] font-mono px-1.5 py-0.2 bg-white/5 text-slate-400 rounded-md border border-white/5">
                        {item.fileSize}
                      </span>
                      <span className="text-[8px] font-mono px-1.5 py-0.2 bg-white/5 text-slate-400 rounded-md border border-white/5">
                        {formatDuration(item.duration)}
                      </span>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[8px] font-mono px-1.5 py-0.2 bg-blue-500/5 text-blue-400/80 rounded-md border border-blue-500/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>


      {/* Sidebar Bottom Utilities */}
      <div className="p-3 border-t border-white/5 flex items-center justify-center bg-transparent">
        <span className="text-[10px] font-mono text-slate-600">
          {hymns.length} hymn{hymns.length !== 1 ? "s" : ""} in library
        </span>
      </div>
    </div>
  );
};
