"use client";
import SmartSearch from "@/components/search/SmartSearch";
import { ORGANIC_FEED, PROVINCES, COMMUNITIES } from "@/lib/seed-content";
import { Search, MapPin, FileText, Building2, BarChart2, Users, TrendingUp, ExternalLink } from "lucide-react";
import { useState } from "react";

const QUICK_FILTERS = ['Leyes', 'Contratos', 'Entidades', 'Provincias', 'Denuncias', 'Datos Abiertos'] as const;

export default function ExplorarPage() {
  const [activeFilter, setActiveFilter] = useState<string>('Leyes');

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0f1d35] via-[#0c1426] to-[#1a0a2e] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl md:text-4xl font-black mb-3">Explorar el Estado</h1>
          <p className="text-white/60 text-sm mb-6">Busca entre 47,000+ contratos, 2,100+ leyes, 4,800+ entidades y 24 provincias</p>
          <SmartSearch />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-5">
        {/* Quick filters */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 flex gap-2 overflow-x-auto scrollbar-hide">
          {QUICK_FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${activeFilter === f ? 'bg-[#0EA5E9] text-white shadow-lg shadow-sky-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{f}</button>
          ))}
        </div>

        {/* Results grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Featured stat cards */}
          {[
            { icon: FileText, label: 'Leyes activas', value: '2,147', color: '#3B82F6', delta: '+28 este mes' },
            { icon: Building2, label: 'Contratos SERCOP', value: '47,392', color: '#EF4444', delta: '$4.2B total' },
            { icon: MapPin, label: 'Entidades monitoreadas', value: '4,831', color: '#10B981', delta: '24 provincias' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: s.color }}><s.icon size={20} /></div>
                <span className="text-[11px] text-gray-400 font-medium">{s.label}</span>
              </div>
              <p className="font-mono font-black text-2xl text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><TrendingUp size={10} className="text-green-500" /> {s.delta}</p>
            </div>
          ))}
        </div>

        {/* Province grid */}
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><MapPin size={14} className="text-[#0EA5E9]" /> Provincias de Ecuador</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
          {PROVINCES.slice(0, 12).map(p => (
            <a key={p.id} href={`/explorar?q=${p.name}`} className="bg-white rounded-xl p-3 border border-gray-100 hover:border-[#0EA5E9] hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[12px] text-gray-900 group-hover:text-[#0EA5E9] transition-colors">{p.name}</span>
                <span className={`w-2 h-2 rounded-full ${p.riskLevel === 'alto' ? 'bg-red-500' : p.riskLevel === 'medio' ? 'bg-amber-500' : 'bg-green-500'}`} />
              </div>
              <div className="grid grid-cols-2 gap-1 text-[9px] text-gray-400">
                <span>{p.alerts} alertas</span>
                <span>{p.contracts} contratos</span>
                <span>{p.denuncias} denuncias</span>
                <span>{p.activeDebates} debates</span>
              </div>
            </a>
          ))}
        </div>

        {/* Trending communities */}
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Users size={14} className="text-[#8B5CF6]" /> Comunidades activas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {COMMUNITIES.filter(c => c.trending).map(c => (
            <a key={c.id} href={`/comunidad`} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${c.coverColor}15` }}>{c.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[12px] text-gray-900">{c.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{c.members.toLocaleString()} miembros · {c.postsToday} posts hoy</p>
              </div>
              <ExternalLink size={14} className="text-gray-300" />
            </a>
          ))}
        </div>

        {/* Recent feed preview */}
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><BarChart2 size={14} className="text-[#F59E0B]" /> Actividad reciente</h2>
        <div className="space-y-2 mb-8">
          {ORGANIC_FEED.slice(0, 5).map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: item.sourceColor }}>{item.sourceCode}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-900 truncate">{item.headline}</p>
                <p className="text-[10px] text-gray-400">{item.source} · {item.time} · {item.location}</p>
              </div>
              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${item.impact === 'ALTO' ? 'bg-red-50 text-red-500' : item.impact === 'MEDIO' ? 'bg-amber-50 text-amber-500' : 'bg-green-50 text-green-500'}`}>{item.impact}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
