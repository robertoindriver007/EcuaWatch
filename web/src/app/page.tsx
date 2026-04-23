import React from "react";
import SoftGateModal from "@/components/auth/SoftGateModal";
import InFeedAd from "@/components/ads/InFeedAd";
import SwarmPanel from "@/components/SwarmPanel";
import {
  ShieldAlert, Gavel, BarChart2, MapPin, TrendingUp,
  TrendingDown, ChevronRight, Circle
} from "lucide-react";

// ── Static mock feed (will be replaced by MongoDB SSR later) ─────────────────
const FEED_ITEMS = [
  {
    id: "f1",
    type: "alert",
    source: "Contraloría General",
    sourceCode: "CGE",
    sourceColor: "#EF4444",
    time: "Hace 3 min",
    badge: "🔴 ALERTA FISCAL",
    location: "El Oro",
    headline: "Adjudicación directa de $1.2M sin proceso competitivo",
    body: "El contrato aparece vinculado a 3 empresas inhabilitadas previamente en el SERCOP. La Contraloría activa proceso de auditoría especial.",
    tags: ["#CorrienteOro", "#SERCOPWatch"],
    impact: "ALTO",
  },
  {
    id: "f2",
    type: "law",
    source: "Asamblea Nacional",
    sourceCode: "AN",
    sourceColor: "#3B82F6",
    time: "Hace 22 min",
    badge: "⚖️ LEGISLATIVO",
    location: "Quito",
    headline: "Aprobado en primer debate: Art. 14 del Código Tributario — Nuevas tasas a exportaciones agrícolas",
    body: "98 votos a favor, 22 en contra. La reforma entra en vigencia en 60 días. Afecta directamente a exportadores de banano y camarón de la Costa.",
    tags: ["#LeyTributaria", "#Asamblea"],
    impact: "MEDIO",
  },
  {
    id: "f3",
    type: "citizen",
    source: "Luis Ciudadano",
    sourceCode: "LC",
    sourceColor: "#10B981",
    time: "Hace 1 h",
    badge: "📍 DENUNCIA CIUDADANA",
    location: "Tarqui, Guayaquil",
    headline: "Obra aceptada en SERCOP pero calle sigue destruida — #RoboGuayas",
    body: "La plataforma oficial registra la obra como 'Recibida con satisfacción', pero los vecinos muestran video de la condición real a la fecha.",
    tags: ["#RoboGuayas", "#ObraPublica"],
    impact: "MEDIO",
  },
];

const METRICS = [
  { label: "IVA Recaudado (mes)", value: "$340M", trend: "up" as const, delta: "+4.2%" },
  { label: "Adjudicaciones", value: "$22.4M", trend: "down" as const, delta: "-8%" },
  { label: "Contratos bajo audit", value: "47", trend: "up" as const, delta: "+12" },
  { label: "Denuncias ciudadanas", value: "1,204", trend: "up" as const, delta: "+89 hoy" },
];

const TRENDING = [
  { tag: "#LeyTributariaUrgent", cat: "Política", count: "12K" },
  { tag: "#MunicipiosBajoLupa", cat: "Contraloría", count: "8.4K" },
  { tag: "#SERCOPWatch", cat: "Contratos", count: "5.1K" },
  { tag: "#RoboGuayas", cat: "Denuncia", count: "3.9K" },
  { tag: "#RegistroOficial", cat: "Legislación", count: "2.2K" },
];

// ── Impact colour mapping ────────────────────────────────────────────────────
const impactStyle: Record<string, string> = {
  ALTO:  "bg-red-50 text-red-600 border-red-200",
  MEDIO: "bg-amber-50 text-amber-700 border-amber-200",
  BAJO:  "bg-green-50 text-green-700 border-green-200",
};

export default function Home() {
  return (
    <>
      <SoftGateModal />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ── LEFT SIDEBAR ───────────────────────────────────── */}
          <aside className="hidden md:flex md:col-span-3 flex-col gap-4">
            {/* Trending */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp size={13} className="text-ecua-sky" />
                Tendencias
              </h3>
              <ul className="space-y-3">
                {TRENDING.map((t) => (
                  <li key={t.tag} className="group cursor-pointer">
                    <span className="text-[10px] text-gray-400">{t.cat} · {t.count} menciones</span>
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0EA5E9] transition-colors leading-tight">
                      {t.tag}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick links */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3">Vigilar</h3>
              <ul className="space-y-1">
                {[
                  { icon: Gavel,      label: "Asamblea Nacional" },
                  { icon: ShieldAlert, label: "Contraloría" },
                  { icon: BarChart2,  label: "Registro Oficial" },
                  { icon: MapPin,     label: "GAD Guayaquil" },
                ].map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 text-[12px] text-gray-600 hover:text-[#0EA5E9] hover:bg-sky-50 rounded-lg px-2 py-1.5 cursor-pointer transition-colors"
                  >
                    <Icon size={13} />
                    {label}
                    <ChevronRight size={11} className="ml-auto text-gray-300" />
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* ── CENTER FEED ────────────────────────────────────── */}
          <div className="col-span-1 md:col-span-6 space-y-4">

            {/* Search / Action bar */}
            <div className="glass-card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-[#10B981] bg-gradient-to-br from-sky-100 to-green-100 flex items-center justify-center text-[11px] font-black text-gray-500">
                TÚ
              </div>
              <input
                type="text"
                placeholder="Reportar anomalía, buscar contrato o funcionario…"
                className="bg-gray-50 text-sm flex-1 rounded-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-shadow"
              />
            </div>

            {/* Feed items */}
            {FEED_ITEMS.map((item, idx) => (
              <React.Fragment key={item.id}>
                <article className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-sm"
                        style={{ backgroundColor: item.sourceColor }}
                      >
                        {item.sourceCode}
                      </div>
                      <div>
                        <h4 className="text-[12px] font-bold text-gray-900 leading-tight">{item.source}</h4>
                        <p className="text-[10px] text-gray-400">
                          <span className="mr-1">📍</span>{item.location} · {item.time}
                        </p>
                      </div>
                    </div>
                    {/* Impact badge */}
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${impactStyle[item.impact]}`}>
                      {item.impact}
                    </span>
                  </div>

                  {/* Category */}
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{item.badge}</span>

                  {/* Headline */}
                  <h2 className="text-sm font-bold text-gray-900 mt-0.5 mb-2 leading-snug hover:text-[#0EA5E9] cursor-pointer transition-colors">
                    {item.headline}
                  </h2>

                  {/* Body */}
                  <p className="text-[12px] text-gray-600 leading-relaxed mb-3">{item.body}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-[#0EA5E9] bg-sky-50 px-2 py-0.5 rounded-full font-medium cursor-pointer hover:bg-sky-100 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>

                {/* Insert InFeed Ad after 2nd item */}
                {idx === 1 && (
                  <InFeedAd adSlot="1234567890" adFormat="fluid" adLayout="in-article" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ── RIGHT SIDEBAR ──────────────────────────────────── */}
          <aside className="hidden md:flex md:col-span-3 flex-col gap-4">

            {/* Fiscal metrics */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest">Métricas Fiscales</h3>
                <span className="text-[9px] text-gray-400">Actualizado · hoy</span>
              </div>
              <ul className="space-y-3">
                {METRICS.map((m) => (
                  <li key={m.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">{m.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[12px] text-gray-900">{m.value}</span>
                      <span className={m.trend === "up" ? "metric-up" : "metric-down"}>
                        {m.trend === "up" ? "▲" : "▼"} {m.delta}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <button className="w-full mt-4 gradient-border text-[11px] font-semibold text-[#0EA5E9] rounded-lg px-3 py-2 hover:bg-sky-50 transition-colors">
                Ver dashboard completo →
              </button>
            </div>

            {/* Status panel */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3">Estado del Sistema</h3>
              <ul className="space-y-2">
                {[
                  { label: "Scraper Legislativo",  ok: true  },
                  { label: "Datos SERCOP",          ok: true  },
                  { label: "Registro Oficial",       ok: true  },
                  { label: "Alerta en tiempo real", ok: false },
                ].map(({ label, ok }) => (
                  <li key={label} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-600">{label}</span>
                    <span className="flex items-center gap-1 font-medium" style={{ color: ok ? "#10B981" : "#F97316" }}>
                      <Circle size={7} fill="currentColor" />
                      {ok ? "Activo" : "Pausado"}
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
    </>
  );
}
