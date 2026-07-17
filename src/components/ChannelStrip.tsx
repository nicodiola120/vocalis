import React, { useEffect, useRef, useState } from "react";
import { Voice } from "../types";
import { player } from "../lib/audioEngine";
import { Volume2, VolumeX, Mic } from "lucide-react";

interface ChannelStripProps {
  voice: Voice;
  onVolumeChange: (vol: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onPanChange: (pan: number) => void;
  isPlaying: boolean;
  expanded?: boolean;
}

export const ChannelStrip: React.FC<ChannelStripProps> = ({
  voice,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onPanChange,
  isPlaying,
  expanded,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [level, setLevel] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  // Animate the LED level meter when playing
  useEffect(() => {
    const updateMeter = () => {
      if (isPlaying) {
        const rawLevel = player.getChannelAudioLevel(voice.id);
        setLevel((prev) => {
          if (rawLevel > prev) return rawLevel;
          return prev * 0.85 + rawLevel * 0.15;
        });
      } else {
        setLevel((prev) => (prev > 0.01 ? prev * 0.7 : 0));
      }
      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    updateMeter();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, voice.id]);

  const updateVolumeFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const relativeY = rect.bottom - e.clientY;
    let percentage = relativeY / rect.height;
    percentage = Math.max(0, Math.min(1, percentage));
    onVolumeChange(percentage);
  };

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateVolumeFromPointer(e);
    if (sliderRef.current) {
      sliderRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateVolumeFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    if (sliderRef.current) {
      sliderRef.current.releasePointerCapture(e.pointerId);
    }
  };

  // Color Mapping based on standard parts or custom colors
  const getColorClasses = (col: string) => {
    switch (col) {
      case "indigo":
        return {
          text: "text-indigo-400",
          bg: "bg-indigo-500",
          accent: "indigo",
          border: "border-indigo-500/20",
          shadow: "shadow-indigo-500/10",
        };
      case "pink":
        return {
          text: "text-pink-400",
          bg: "bg-pink-500",
          accent: "pink",
          border: "border-pink-500/20",
          shadow: "shadow-pink-500/10",
        };
      case "sky":
        return {
          text: "text-sky-400",
          bg: "bg-sky-500",
          accent: "sky",
          border: "border-sky-500/20",
          shadow: "shadow-sky-500/10",
        };
      case "emerald":
        return {
          text: "text-emerald-400",
          bg: "bg-emerald-500",
          accent: "emerald",
          border: "border-emerald-500/20",
          shadow: "shadow-emerald-500/10",
        };
      default:
        return {
          text: "text-amber-400",
          bg: "bg-amber-500",
          accent: "amber",
          border: "border-amber-500/20",
          shadow: "shadow-amber-500/10",
        };
    }
  };

  const themeColors = getColorClasses(voice.color);

  // Generate 32 LED segments: Red (top), Yellow (mid), Green (low)
  const numSegments = 32;
  const segments = Array.from({ length: numSegments }).map((_, idx) => {
    const segIndex = numSegments - 1 - idx; // 31 is top, 0 is bottom
    const isLit = level * numSegments > segIndex;
    
    // Determine LED Color based on position
    let activeColor = "bg-emerald-500 shadow-[0_0_4px_#10b981]";
    let inactiveColor = "bg-emerald-950/40";

    if (segIndex >= 24) {
      // Top 8 Red
      activeColor = "bg-rose-500 shadow-[0_0_4px_#f43f5e]";
      inactiveColor = "bg-rose-950/30";
    } else if (segIndex >= 16) {
      // Middle 8 Yellow
      activeColor = "bg-amber-400 shadow-[0_0_4px_#fbbf24]";
      inactiveColor = "bg-amber-950/30";
    }

    return (
      <div
        key={segIndex}
        className={`flex-1 w-full rounded-none transition-colors duration-75 ${
          isLit ? activeColor : inactiveColor
        }`}
      />
    );
  });

  return (
    <div
      id={`strip-${voice.id}`}
      className={`flex flex-col glass-panel rounded-2xl ${expanded ? 'h-full overflow-hidden' : ''} ${
        voice.isSolo 
          ? "border-amber-400/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
          : "shadow-lg shadow-black/15"
      } p-2 lg:p-3 w-full select-none transition-all duration-300 ${expanded ? '' : 'hover:scale-[1.01] hover:border-white/15'}`}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5">
          <Mic className={`h-3.5 w-3.5 ${themeColors.text}`} />
          <span className="font-display font-semibold text-slate-100 text-xs tracking-wide">
            {voice.name === "Soprano" ? "S" : voice.name === "Alto" ? "A" : voice.name === "Tenor" ? "T" : voice.name === "Bass" ? "B" : voice.name === "Instrument" ? "Ins" : voice.name}
          </span>
        </div>
      </div>

      {/* Sliders and Visualizer Row */}
      <div className={`flex ${expanded ? 'flex-col portrait:flex-col landscape:flex-row' : 'flex-row'} items-stretch justify-center gap-3 ${expanded ? 'flex-1 min-h-0' : 'h-40 lg:h-48'} my-1`}>
        
        {/* Combined Fader + LED Visualizer */}
        <div className="flex flex-col items-center flex-1 h-full relative">
          <div className="text-[10px] font-mono text-slate-500 mb-1">0</div>
          
          <div
            ref={sliderRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-8 h-full bg-white/5 rounded-full flex items-center justify-center cursor-pointer border border-white/10 select-none group overflow-hidden"
          >
            {/* LED segments overlay — fills the entire track */}
            <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col px-0.5 py-0.5 gap-px pointer-events-none">
              {segments}
            </div>

            {/* Slider Knob — sits on top of LEDs */}
            <div
              className="absolute w-6 h-6 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.35)] will-change-[bottom] cursor-grab active:cursor-grabbing flex items-center justify-center z-10"
              style={{ 
                bottom: `calc(${voice.volume * 100}% - 12px)`,
                border: `4px solid ${
                  voice.color === "indigo" ? "#3b82f6" :
                  voice.color === "pink" ? "#ec4899" :
                  voice.color === "sky" ? "#0ea5e9" :
                  voice.color === "emerald" ? "#10b981" : "#f59e0b"
                }`
              }}
            >
              <div className="w-1 h-1 bg-slate-900 rounded-full" />
            </div>
          </div>
          
          <div className="text-[10px] font-mono text-slate-500 mt-1">-60</div>
        </div>

        {/* S/M buttons — right side in landscape, bottom in portrait */}
        <div className={`${expanded ? 'flex flex-col justify-center gap-2 shrink-0' : 'w-7 min-w-[28px] flex flex-col h-full gap-1.5 shrink-0 justify-end'}`}>
          {expanded ? (
            <>
              <button
                id={`solo-${voice.id}`}
                onClick={onSoloToggle}
                className={`px-3 py-1.5 rounded border font-bold text-xs transition-all duration-150 cursor-pointer ${
                  voice.isSolo
                    ? "bg-amber-500 border-amber-400 text-slate-950"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                }`}
              >
                S
              </button>
              <button
                id={`mute-${voice.id}`}
                onClick={onMuteToggle}
                className={`px-3 py-1.5 rounded border font-bold text-xs transition-all duration-150 cursor-pointer ${
                  voice.isMuted
                    ? "bg-rose-500 border-rose-400 text-slate-950"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                }`}
              >
                M
              </button>
            </>
          ) : (
          <>
            {/* Full: VOL display + PAN + M/S */}
            <div className="flex items-center justify-between text-xs text-slate-300 bg-white/5 border border-white/5 px-2 py-1 rounded-lg font-mono">
              <span className="text-[9px] text-slate-500">VOL:</span>
              <span className="text-slate-100 font-medium text-[11px]">
                {Math.round(voice.volume * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                id={`solo-${voice.id}`}
                onClick={onSoloToggle}
                className={`py-1 px-2 rounded-lg border font-bold text-[11px] transition-all duration-150 cursor-pointer ${
                  voice.isSolo
                    ? "bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
                }`}
                title="Solo this channel (mutes all non-solo channels)"
              >
                S
              </button>

              <button
                id={`mute-${voice.id}`}
                onClick={onMuteToggle}
                className={`py-1 px-2 rounded-lg border font-bold text-[11px] transition-all duration-150 cursor-pointer ${
                  voice.isMuted
                    ? "bg-rose-500 border-rose-400 text-slate-950 shadow-md shadow-rose-500/10"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
                }`}
                title="Mute this channel"
              >
                M
              </button>
            </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
