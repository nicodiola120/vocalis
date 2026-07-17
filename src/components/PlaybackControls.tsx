import React from "react";
import { Play, Pause, Square, Volume2, VolumeX, Repeat, Sliders } from "lucide-react";

interface PlaybackControlsProps {
  name: string;
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  masterVolume: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onLoopToggle: () => void;
  onVolumeChange: (vol: number) => void;
  onSeek: (seconds: number) => void;
  onRename: () => void;
  lyrics?: string;
  music?: string;
  arranger?: string;
  info?: string;
  tags?: string[];
  showMixer?: boolean;
  onToggleMixer?: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  name,
  isPlaying,
  isLooping,
  currentTime,
  duration,
  masterVolume,
  onPlay,
  onPause,
  onStop,
  onLoopToggle,
  onVolumeChange,
  onSeek,
  onRename,
  lyrics,
  music,
  arranger,
  info,
  tags,
  showMixer,
  onToggleMixer,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl text-left relative overflow-hidden select-none flex flex-col h-full">
      {/* Title + metadata — top area */}
      <div className="mb-2 shrink-0">
        <div className="flex items-start gap-3">
          <h1
            className="font-display font-bold text-slate-100 text-xl lg:text-2xl truncate flex-1 min-w-0 cursor-pointer hover:text-blue-400 transition-colors"
            onClick={onRename}
            title="Rename Hymn"
          >
            {name}
          </h1>
          {onToggleMixer && (
            <button
              id="btn-toggle-mixer"
              onClick={onToggleMixer}
              className="shrink-0 p-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 cursor-pointer transition-all"
              title="Open Mixer"
            >
              <Sliders className="h-7 w-7" />
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap sm:gap-x-4 gap-y-1 mt-1.5">
          {lyrics && <span className="text-xs text-slate-400"><span className="font-bold text-slate-300">Lyrics:</span> {lyrics}</span>}
          {music && <span className="text-xs text-slate-400"><span className="font-bold text-slate-300">Music:</span> {music}</span>}
          {arranger && <span className="text-xs text-slate-400"><span className="font-bold text-slate-300">Arr:</span> {arranger}</span>}
        </div>
      </div>
      {/* Separator + info */}
      {info && (
        <div className="shrink-0 border-t border-white/10 pt-2 mb-2">
          <p className="text-xs text-slate-400 leading-relaxed">{info}</p>
        </div>
      )}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 shrink-0 mb-2">
          {tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/15 rounded text-[10px] text-blue-300/80 font-mono">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Spacer pushes controls to bottom */}
      <div className="flex-1" />

      {/* Transport + Time + Volume */}
      <div className="flex items-center gap-3 shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <button
            id="control-play"
            onClick={onPlay}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              isPlaying
                ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <Play className={`h-5 w-5 ${isPlaying ? "fill-white" : ""}`} />
          </button>
          <button
            id="control-pause"
            onClick={onPause}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              !isPlaying && currentTime > 0
                ? "bg-white/15 border-white/10 text-white"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <Pause className="h-5 w-5" />
          </button>
          <button
            id="control-stop"
            onClick={onStop}
            className="p-3 rounded-xl border bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-all"
          >
            <Square className="h-5 w-5" />
          </button>
          <button
            id="control-loop"
            onClick={onLoopToggle}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              isLooping
                ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Toggle Loop"
          >
            <Repeat className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-baseline gap-1.5 px-2">
          <span className="font-mono text-lg font-semibold text-slate-100 tracking-tight">
            {formatTime(currentTime)}
          </span>
          <span className="font-mono text-xs text-slate-500">
            /{formatTime(duration)}
          </span>
        </div>

        <button
          id="btn-master-mute"
          onClick={() => onVolumeChange(masterVolume > 0 ? 0 : 0.8)}
          className="text-slate-400 hover:text-slate-200 cursor-pointer transition-colors shrink-0"
        >
          {masterVolume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-rose-500" />}
        </button>
        <input
          id="master-volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Scrub bar — full width */}
      <div className="shrink-0">
        <input
          id="playback-timeline-scrub"
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer focus:outline-none accent-blue-500
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-500"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
