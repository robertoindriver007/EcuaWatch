"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import SwarmPanel from "@/components/SwarmPanel";
import FeedCard from "@/components/feed/FeedCard";
import FeedTabs from "@/components/feed/FeedTabs";
import { COMMUNITIES, ORGANIC_REELS } from "@/lib/seed-content";
import type { FeedItem, FeedTab } from "@/lib/types";
import {
  TrendingUp, ChevronRight, Circle, Film, Users,
  Gavel, ShieldAlert, BarChart2, MapPin, Eye,
  MessageSquare, Zap, Radio, Loader2, RefreshCw
} from "lucide-react";

// Dynamic import for 3D map (heavy component)
const EcuadorMap = dynamic(() => import("@/components/map/EcuadorMap"), { ssr: false, loading: () => <div className="h-[420px] rounded-2xl bg-gradient-to-br from-[#0c1426] to-[#0f1d35] animate-pulse flex items-center justify-center text-white/20 text-sm">Cargando mapa...</div> });

const TRENDING = [
  { tag: "#LeyTributariaUrgent", cat: "Política", count: "12K", hot: true },
  { tag: "#ContratoEmergencia", cat: "SERCOP", count: "9.1K", hot: true },
  { tag: "#MunicipiosBajoLupa", cat: "Contraloría", count: "8.4K", hot: false },
  { tag: "#SERCOPWatch", cat: "Contratos", count: "5.1K", hot: false },
  { tag: "#RoboGuayas", cat: "Denuncia", count: "3.9K", hot: false },
  { tag: "#SaludPública", cat: "Manabí", count: "3.2K", hot: false },
  { tag: "#RegistroOficial", cat: "Legislación", count: "2.2K", hot: false },
];

const METRICS = [
  { label: "IVA Recaudado (mes)", value: "$340M", trend: "up" as const, delta: "+4.2%" },
  { label: "Adjudicaciones SERCOP", value: "$22.4M", trend: "down" as const, delta: "-8%" },
  { label: "Contratos bajo auditoría", value: "47", trend: "up" as const, delta: "+12" },
  { label: "Denuncias ciudadanas", value: "1,204", trend: "up" as const, delta: "+89 hoy" },
  { label: "Leyes aprobadas (abril)", value: "7", trend: "up" as const, delta: "+2" },
  { label: "Anomalías IA detectadas", value: "23", trend: "up" as const, delta: "+5 nuevas" },
];

const LIVE_EVENTS = [
  { title: "🔴 Sesión Asamblea — Código Tributario", viewers: 12400, active: true },
  { title: "💬 Debate: Presupuesto Guayaquil 2026", viewers: 3200, active: true },
  { title: "📊 Análisis IA: Contratos Emergencia Q1", viewers: 890, active: false },
];

function formatNum(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function Home() {
  const [feedTab, setFeedTab] = useState<FeedTab>('paraTi');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch feed from API
  const fetchFeed = useCallback(async (tab: FeedTab, cursor?: string) => {
    try {
      const params = new URLSearchParams({ tab, limit: '10' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/feed?${params}`);
      const data = await res.json();

      return data;
    } catch (err) {
      console.error('[Feed] Error:', err);
      return null;
    }
  }, []);

  // Load initial feed or when tab changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const data = await fetchFeed(feedTab);
      if (!cancelled && data) {
        setFeedItems(data.items || []);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore || false);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [feedTab, fetchFeed]);

  // Load more (infinite scroll trigger)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);

    const data = await fetchFeed(feedTab, nextCursor);
    if (data) {
      setFeedItems(prev => [...prev, ...(data.items || [])]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore || false);
    }
    setLoadingMore(false);
  }, [feedTab, nextCursor, hasMore, loadingMore, fetchFeed]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      {/* ── HERO: 3D Ecuador Map ──────────────────────────────── */}
      <section className="container mx-auto px-4 pt-4 pb-2 max-w-6xl">
        <EcuadorMap />
      </section>

      {/* ── LIVE Events Bar ──────────────────────────────────── */}
      <div className="container mx-auto px-4 max-w-6xl mb-4">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {LIVE_EVENTS.map((ev, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all flex-shrink-0 ${ev.active ? 'bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-200/50 hover:border-red-300' : 'bg-gray-50 border border-gray-200/60 hover:bg-gray-100'}`}>
              {ev.active && <Radio size={12} className="text-red-500 animate-pulse" />}
              <span className="text-[11px] font-semibold text-gray-800 whitespace-nowrap">{ev.title}</span>
              <span className="text-[9px] text-gray-400 flex items-center gap-1"><Eye size={9} /> {formatNum(ev.viewers)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────── */}
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* ── LEFT SIDEBAR ─────────────────────────── */}
          <aside className="hidden md:flex md:col-span-3 flex-col gap-4">
            {/* Trending */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp size={13} className="text-[#0EA5E9]" /> Tendencias
              </h3>
              <ul className="space-y-2.5">
                {TRENDING.map(t => (
                  <li key={t.tag} className="group cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">{t.cat}</span>
                      {t.hot && <Zap size={9} className="text-amber-500" />}
                      <span className="text-[9px] text-gray-300 ml-auto">{t.count}</span>
                    </div>
                    <p className="text-[12px] font-semibold text-gray-900 group-hover:text-[#0EA5E9] transition-colors leading-tight">{t.tag}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Reels preview */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <Film size={13} className="text-purple-500" /> Reels Cívicos
              </h3>
              <div className="space-y-2.5">
                {ORGANIC_REELS.slice(0, 3).map(r => (
                  <a key={r.id} href="/reels" className="flex items-center gap-2.5 group cursor-pointer">
                    <div className="w-10 h-14 rounded-lg bg-gradient-to-b from-purple-900 to-indigo-950 flex items-center justify-center flex-shrink-0">
                      <Film size={14} className="text-white/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 group-hover:text-[#0EA5E9] transition-colors truncate">{r.title}</p>
                      <p className="text-[9px] text-gray-400">{formatNum(r.views)} vistas · {r.duration}s</p>
                    </div>
                  </a>
                ))}
              </div>
              <a href="/reels" className="block mt-3 text-center text-[11px] font-semibold text-[#0EA5E9] hover:underline">
                Ver todos los reels →
              </a>
            </div>

            {/* Quick links */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3">Vigilar</h3>
              <ul className="space-y-1">
                {[
                  { icon: Gavel, label: "Asamblea Nacional", count: "28 leyes" },
                  { icon: ShieldAlert, label: "Contraloría", count: "47 alertas" },
                  { icon: BarChart2, label: "SERCOP", count: "1.2K contratos" },
                  { icon: MapPin, label: "GAD Guayaquil", count: "384 denuncias" },
                ].map(({ icon: Icon, label, count }) => (
                  <li key={label} className="flex items-center gap-2 text-[12px] text-gray-600 hover:text-[#0EA5E9] hover:bg-sky-50 rounded-lg px-2 py-1.5 cursor-pointer transition-colors">
                    <Icon size={13} />
                    <span className="flex-1">{label}</span>
                    <span className="text-[9px] text-gray-300 font-mono">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* ── CENTER FEED ──────────────────────────── */}
          <div className="col-span-1 md:col-span-6 space-y-4">
            {/* Action bar */}
            <div className="glass-card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-[#10B981] bg-gradient-to-br from-sky-100 to-green-100 flex items-center justify-center text-[11px] font-black text-gray-500">TÚ</div>
              <input type="text" placeholder="Reportar anomalía, buscar contrato o funcionario…" className="bg-gray-50 text-sm flex-1 rounded-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-shadow" />
            </div>

            {/* Feed tabs */}
            <FeedTabs active={feedTab} onChange={setFeedTab} />

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="glass-card p-5 animate-pulse">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-gray-200 rounded w-1/3" />
                        <div className="h-2 bg-gray-100 rounded w-1/4" />
                      </div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-5/6" />
                  </div>
                ))}
              </div>
            )}

            {/* Feed items */}
            {!loading && feedItems.map((item, idx) => (
              <FeedCard key={item.id} item={item} index={idx} />
            ))}

            {/* Empty state */}
            {!loading && feedItems.length === 0 && (
              <div className="glass-card p-8 text-center">
                <MessageSquare size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No hay publicaciones en esta categoría</p>
                <button onClick={() => setFeedTab('paraTi')} className="mt-2 text-[#0EA5E9] text-sm font-semibold hover:underline">
                  Ver todas →
                </button>
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="text-[#0EA5E9] animate-spin" />
              </div>
            )}

            {/* Manual load more (backup) */}
            {!loading && hasMore && !loadingMore && (
              <button onClick={loadMore} className="w-full glass-card p-3 text-center text-[12px] font-semibold text-[#0EA5E9] hover:bg-sky-50 transition-colors flex items-center justify-center gap-2">
                <RefreshCw size={12} /> Cargar más publicaciones
              </button>
            )}

            {/* End of feed */}
            {!loading && !hasMore && feedItems.length > 0 && (
              <p className="text-center text-[11px] text-gray-300 py-4">— Has llegado al final —</p>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ────────────────────────── */}
          <aside className="hidden md:flex md:col-span-3 flex-col gap-4">
            {/* Fiscal metrics */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest">Métricas Fiscales</h3>
                <span className="text-[9px] text-gray-400">En vivo</span>
              </div>
              <ul className="space-y-2.5">
                {METRICS.map(m => (
                  <li key={m.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">{m.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[12px] text-gray-900">{m.value}</span>
                      <span className={m.trend === "up" ? "metric-up" : "metric-down"}>{m.trend === "up" ? "▲" : "▼"} {m.delta}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Communities sidebar */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users size={13} className="text-purple-500" /> Comunidades
              </h3>
              <ul className="space-y-2">
                {COMMUNITIES.filter(c => c.trending).slice(0, 4).map(c => (
                  <li key={c.id}>
                    <a href="/comunidad" className="flex items-center gap-2 hover:bg-sky-50 rounded-lg px-1 py-1.5 transition-colors cursor-pointer">
                      <span className="text-lg">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-[9px] text-gray-400">{formatNum(c.members)} miembros</p>
                      </div>
                      <ChevronRight size={12} className="text-gray-300" />
                    </a>
                  </li>
                ))}
              </ul>
              <a href="/comunidad" className="block mt-2 text-center text-[11px] font-semibold text-[#0EA5E9] hover:underline">
                Ver todas →
              </a>
            </div>

            {/* System status */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3">Estado del Sistema</h3>
              <ul className="space-y-2">
                {[
                  { label: "Scraper Legislativo", ok: true },
                  { label: "Datos SERCOP", ok: true },
                  { label: "Motor IA Gemini", ok: true },
                  { label: "Alertas en tiempo real", ok: true },
                  { label: "MongoDB Atlas", ok: true },
                ].map(({ label, ok }) => (
                  <li key={label} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">{label}</span>
                    <span className="flex items-center gap-1 font-medium" style={{ color: ok ? "#10B981" : "#F97316" }}>
                      <Circle size={7} fill="currentColor" /> {ok ? "Activo" : "Pausado"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Swarm Intelligence Panel */}
            <SwarmPanel />
          </aside>
        </div>
      </div>

      {/* Bottom spacing for mobile nav */}
      <div className="h-20 md:h-0" />
    </>
  );
}
