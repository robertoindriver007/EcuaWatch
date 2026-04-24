'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, X, AlertCircle, Loader2 } from 'lucide-react';

type Indicator = {
  id: string;
  title: string;
  value: string;
  trend: 'up' | 'down';
  cause: string;
  effect: string;
  traceability: string;
};

export default function TopTicker() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0 });
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/indicators')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.indicators?.length) {
          setIndicators(data.indicators);
        }
      })
      .catch(() => { /* no fallback — if API fails, ticker stays empty */ })
      .finally(() => setLoading(false));
  }, []);

  const handleMouseEnter = (id: string, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setCardPos({ x: Math.min(rect.left, window.innerWidth - 340) });
    setHoveredId(id);
  };

  const active = indicators.find(i => i.id === hoveredId);

  if (dismissed) return null;

  // If no real data loaded, show minimal status bar
  if (!loading && indicators.length === 0) {
    return (
      <div className="relative w-full bg-[#0a0f1c] text-white py-1 border-b border-[#1e3a5f]" style={{ zIndex: 100 }}>
        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500">
          <AlertCircle size={10} />
          <span>Indicadores en espera — Los agentes IA generarán datos reales próximamente</span>
          <button onClick={() => setDismissed(true)} className="ml-4 text-gray-600 hover:text-white"><X size={10} /></button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative w-full bg-[#0a0f1c] text-white py-1 border-b border-[#1e3a5f]" style={{ zIndex: 100 }}>
        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500">
          <Loader2 size={10} className="animate-spin" />
          <span>Cargando indicadores desde Gemini IA...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Ticker Bar ─────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative w-full bg-[#0a0f1c] text-white py-1 border-b border-[#1e3a5f] overflow-hidden select-none"
        style={{ zIndex: 100 }}
      >
        {/* LIVE badge */}
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-[#0a0f1c] via-[#0a0f1c] to-transparent pr-6">
          <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-emerald-500 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            GEMINI IA
          </span>
        </div>

        {/* Dismiss */}
        <button onClick={() => setDismissed(true)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-gray-500 hover:text-white transition-colors">
          <X size={12} />
        </button>

        {/* Scrolling indicators */}
        <div
          className="flex items-center gap-0 animate-ticker whitespace-nowrap pl-24 pr-8"
          style={{ animation: 'ticker-scroll 40s linear infinite' }}
        >
          {[...indicators, ...indicators].map((ind, i) => (
            <button
              key={`${ind.id}-${i}`}
              onMouseEnter={(e) => handleMouseEnter(ind.id, e)}
              onMouseLeave={() => setTimeout(() => setHoveredId(null), 300)}
              className="inline-flex items-center gap-2 px-5 text-[11px] cursor-pointer group border-r border-white/10 last:border-0 hover:bg-white/5 transition-colors py-1"
            >
              <span className="text-gray-400 font-medium">{ind.title}</span>
              <span className={`font-bold font-mono ${ind.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {ind.value}
              </span>
              {ind.trend === 'up'
                ? <TrendingUp size={11} className="text-emerald-400" />
                : <TrendingDown size={11} className="text-red-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hover Traceability Card ─────────── */}
      {hoveredId && active && (
        <div
          className="fixed top-9 z-[200] w-80 pointer-events-none"
          style={{ left: Math.max(16, cardPos.x) }}
          onMouseEnter={() => setHoveredId(hoveredId)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div
            className="rounded-xl border border-white/10 p-4 shadow-2xl"
            style={{
              background: 'rgba(10, 15, 28, 0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={13} className="text-sky-400" />
                <span className="text-sky-400 text-[10px] font-bold uppercase tracking-widest">Análisis IA</span>
              </div>
              <span className={`text-xs font-bold font-mono ${active.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {active.value}
              </span>
            </div>

            <h3 className="text-white font-bold text-sm mb-3">{active.title}</h3>

            <div className="space-y-2.5">
              <InfoRow label="⚡ CAUSA" text={active.cause} color="text-amber-400" />
              <InfoRow label="💥 EFECTO" text={active.effect} color="text-red-400" />
              <InfoRow label="🔗 TRAZABILIDAD" text={active.traceability} color="text-sky-400" />
            </div>

            <div className="mt-3 pt-2 border-t border-white/10">
              <p className="text-[9px] text-gray-500 text-center">Generado por Gemini IA · Datos de MongoDB Atlas</p>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </>
  );
}

function InfoRow({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div>
      <span className={`text-[9px] font-bold uppercase tracking-widest ${color}`}>{label}</span>
      <p className="text-gray-300 text-[11px] leading-snug mt-0.5">{text}</p>
    </div>
  );
}
