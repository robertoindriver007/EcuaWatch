"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import SoftGateModal from "@/components/auth/SoftGateModal";
import InFeedAd from "@/components/ads/InFeedAd";
import SwarmPanel from "@/components/SwarmPanel";
import FeedCard from "@/components/feed/FeedCard";
import FeedTabs from "@/components/feed/FeedTabs";
import { ORGANIC_FEED, COMMUNITIES, ORGANIC_REELS } from "@/lib/seed-content";
import type { FeedTab } from "@/lib/types";
import {
  TrendingUp, ChevronRight, Circle, Film, Users,
  Gavel, ShieldAlert, BarChart2, MapPin, Eye,
  MessageSquare, Zap, Radio
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

  // Filter feed based on tab
  const feedItems = feedTab === 'denuncias'
    ? ORGANIC_FEED.filter(f => f.type === 'citizen')
    : feedTab === 'trending'
    ? [...ORGANIC_FEED].sort((a, b) => b.likes - a.likes)
    : ORGANIC_FEED;

  return (
    <>
      <SoftGateModal />

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

            {/* Feed items */}
            {feedItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                <FeedCard item={item} index={idx} />
                {idx === 2 && <InFeedAd adSlot="1234567890" adFormat="fluid" adLayout="in-article" />}
              </React.Fragment>
            ))}

            {/* Load more */}
            <button className="w-full glass-card p-3 text-center text-[12px] font-semibold text-[#0EA5E9] hover:bg-sky-50 transition-colors">
              Cargar más publicaciones ↓
            </button>
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
