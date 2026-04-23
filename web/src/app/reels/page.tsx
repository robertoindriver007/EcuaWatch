"use client";
import { useState, useRef, useEffect } from "react";
import { ORGANIC_REELS } from "@/lib/seed-content";
import { Heart, MessageCircle, Share2, Bookmark, Music, Bot, ChevronUp, ChevronDown, Play, Pause } from "lucide-react";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ReelsPage() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef(0);
  const reels = ORGANIC_REELS;
  const current = reels[currentIdx];

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStart.current - e.changedTouches[0].clientY;
    if (delta > 60 && currentIdx < reels.length - 1) setCurrentIdx(i => i + 1);
    if (delta < -60 && currentIdx > 0) setCurrentIdx(i => i - 1);
  };

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && currentIdx < reels.length - 1) setCurrentIdx(i => i + 1);
      if (e.key === 'ArrowUp' && currentIdx > 0) setCurrentIdx(i => i - 1);
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIdx, reels.length]);

  const toggleLike = (id: string) => setLiked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSave = (id: string) => setSaved(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Category gradient backgrounds
  const categoryBg: Record<string, string> = {
    'Legislativo': 'from-blue-900 via-blue-950 to-slate-950',
    'Datos': 'from-purple-900 via-indigo-950 to-slate-950',
    'Denuncia': 'from-red-900 via-red-950 to-slate-950',
    'Educativo': 'from-emerald-900 via-teal-950 to-slate-950',
    'Investigación': 'from-amber-900 via-orange-950 to-slate-950',
  };

  return (
    <div className="fixed inset-0 bg-black z-40 flex items-center justify-center" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Background */}
      <div className={`absolute inset-0 bg-gradient-to-b ${categoryBg[current.category] || 'from-gray-900 to-black'} transition-all duration-500`} />

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute w-1 h-1 bg-white/10 rounded-full reel-particle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s` }} />
        ))}
      </div>

      {/* Content area */}
      <div ref={containerRef} className="relative w-full max-w-lg h-full flex flex-col justify-end pb-24 md:pb-8 px-4">

        {/* Center play/pause */}
        <button onClick={() => setPlaying(!playing)} className="absolute inset-0 flex items-center justify-center z-10">
          {!playing && (
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-fade-in-up">
              <Play size={32} className="text-white ml-1" />
            </div>
          )}
        </button>

        {/* Progress indicator */}
        <div className="absolute top-4 left-4 right-16 flex gap-1 z-20">
          {reels.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20">
              <div className={`h-full rounded-full transition-all duration-300 ${i < currentIdx ? 'w-full bg-white' : i === currentIdx ? 'w-1/2 bg-white animate-progress' : 'w-0'}`} />
            </div>
          ))}
        </div>

        {/* Category badge */}
        <div className="absolute top-8 left-4 z-20">
          <span className="bg-white/15 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-white/10">
            {current.category}
          </span>
        </div>

        {/* Back to home */}
        <a href="/" className="absolute top-4 right-4 z-20 text-white/60 hover:text-white transition-colors text-xl font-light">✕</a>

        {/* Right sidebar actions */}
        <div className="absolute right-3 bottom-36 md:bottom-24 flex flex-col items-center gap-5 z-20">
          {/* Author */}
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center text-lg shadow-lg border-2 border-white">
              {current.author.avatar}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white text-[8px] font-bold border border-white">+</div>
          </div>

          {/* Like */}
          <button onClick={() => toggleLike(current.id)} className="flex flex-col items-center gap-0.5">
            <Heart size={26} className={liked.has(current.id) ? 'text-red-500 fill-red-500' : 'text-white'} />
            <span className="text-[10px] text-white font-semibold">{formatNum(current.likes + (liked.has(current.id) ? 1 : 0))}</span>
          </button>

          {/* Comment */}
          <button className="flex flex-col items-center gap-0.5">
            <MessageCircle size={26} className="text-white" />
            <span className="text-[10px] text-white font-semibold">{formatNum(current.comments)}</span>
          </button>

          {/* Share */}
          <button className="flex flex-col items-center gap-0.5">
            <Share2 size={24} className="text-white" />
            <span className="text-[10px] text-white font-semibold">{formatNum(current.shares)}</span>
          </button>

          {/* Save */}
          <button onClick={() => toggleSave(current.id)}>
            <Bookmark size={24} className={saved.has(current.id) ? 'text-amber-400 fill-amber-400' : 'text-white'} />
          </button>
        </div>

        {/* Navigation arrows (desktop) */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-4 flex-col gap-2 z-20">
          <button onClick={() => currentIdx > 0 && setCurrentIdx(i => i - 1)} disabled={currentIdx === 0} className="text-white/40 hover:text-white disabled:opacity-20 transition-colors"><ChevronUp size={24} /></button>
        </div>
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bottom-4 flex-col gap-2 z-20">
          <button onClick={() => currentIdx < reels.length - 1 && setCurrentIdx(i => i + 1)} disabled={currentIdx === reels.length - 1} className="text-white/40 hover:text-white disabled:opacity-20 transition-colors"><ChevronDown size={24} /></button>
        </div>

        {/* Bottom content */}
        <div className="relative z-20 mb-4">
          {/* Author line */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-bold text-sm">{current.author.name}</span>
            {current.author.verified && <span className="text-[#0EA5E9] text-xs">✓</span>}
            {current.aiGenerated && (
              <span className="flex items-center gap-0.5 text-purple-300 text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded-full"><Bot size={10} /> IA</span>
            )}
            <span className="text-white/40 text-[10px] ml-auto">{formatNum(current.views)} vistas</span>
          </div>

          {/* Title */}
          <h2 className="text-white font-bold text-base leading-snug mb-1.5">{current.title}</h2>

          {/* Description */}
          <p className="text-white/70 text-[12px] leading-relaxed mb-2 line-clamp-2">{current.description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {current.tags.map(tag => (
              <span key={tag} className="text-[10px] text-sky-300 bg-sky-400/10 px-2 py-0.5 rounded-full cursor-pointer hover:bg-sky-400/20 transition-colors">{tag}</span>
            ))}
          </div>

          {/* Audio indicator */}
          <div className="flex items-center gap-2 text-white/50 text-[10px]">
            <Music size={11} />
            <span className="truncate">Audio original · {current.duration}s</span>
            <div className="flex gap-0.5 ml-auto">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-0.5 bg-white/40 rounded-full reel-audio-bar" style={{ height: `${8 + Math.random() * 8}px`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Swipe hint (mobile) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:hidden text-white/20 text-[10px] flex items-center gap-1 animate-bounce">
        <ChevronUp size={14} /> Desliza para siguiente
      </div>
    </div>
  );
}
