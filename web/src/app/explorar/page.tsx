"use client";
import SmartSearch from "@/components/search/SmartSearch";
import { PROVINCES } from "@/lib/seed-content";
import { Search, MapPin, FileText, Building2, BarChart2, Users, TrendingUp, ExternalLink, Loader2, Database } from "lucide-react";
import { useState, useEffect } from "react";

const QUICK_FILTERS = ['Leyes', 'Contratos', 'Entidades', 'Provincias', 'Denuncias', 'Datos Abiertos'] as const;

type DbCoverage = { name: string; docs: number };

export default function ExplorarPage() {
  const [activeFilter, setActiveFilter] = useState<string>('Leyes');
  const [coverage, setCoverage] = useState<DbCoverage[]>([]);
  const [feedItems, setFeedItems] = useState<Array<{ id: string; headline: string; source: string; sourceCode: string; sourceColor: string; location: string; impact: string; time: string }>>([]);
  const [communities, setCommunities] = useState<Array<{ id: string; name: string; icon: string; coverColor: string; members: number; postsToday: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [swarmRes, feedRes, comRes] = await Promise.allSettled([
          fetch('/api/swarm').then(r => r.json()),
          fetch('/api/feed?limit=5').then(r => r.json()),
          fetch('/api/comunidad').then(r => r.json()),
        ]);

        if (swarmRes.status === 'fulfilled' && swarmRes.value.coverage) {
          setCoverage(swarmRes.value.coverage);
        }
        if (feedRes.status === 'fulfilled' && feedRes.value.items) {
          setFeedItems(feedRes.value.items);
        }
        if (comRes.status === 'fulfilled' && comRes.value.communities) {
          setCommunities(comRes.value.communities);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  // Calculate real stats from coverage
  const getCollectionCount = (name: string) => coverage.find(c => c.name === name)?.docs || 0;
  const totalDocs = coverage.reduce((s, c) => s + c.docs, 0);
  const activeCollections = coverage.filter(c => c.docs > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0f1d35] via-[#0c1426] to-[#1a0a2e] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl md:text-4xl font-black mb-3">Explorar el Estado</h1>
          <p className="text-white/60 text-sm mb-6">
            {loading ? 'Conectando con base de datos...' : `${totalDocs.toLocaleString()} documentos indexados en ${activeCollections} colecciones activas`}
          </p>
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

        {/* Real stats from MongoDB */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: FileText, label: 'Feed items', value: getCollectionCount('feed_items'), color: '#3B82F6' },
            { icon: Database, label: 'Reels generados', value: getCollectionCount('reels'), color: '#8B5CF6' },
            { icon: Users, label: 'Comunidades', value: getCollectionCount('communities'), color: '#10B981' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: s.color }}><s.icon size={20} /></div>
                <span className="text-[11px] text-gray-400 font-medium">{s.label}</span>
              </div>
              <p className="font-mono font-black text-2xl text-gray-900">
                {loading ? <Loader2 size={20} className="animate-spin text-gray-300" /> : s.value.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Datos reales de MongoDB Atlas</p>
            </div>
          ))}
        </div>

        {/* Province grid — coordinates are real, stats are from seed (marked) */}
        <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2"><MapPin size={14} className="text-[#0EA5E9]" /> Provincias de Ecuador</h2>
        <p className="text-[10px] text-gray-400 mb-3">Datos de población reales · Estadísticas de contratos pendientes de verificación</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
          {PROVINCES.slice(0, 12).map(p => (
            <a key={p.id} href={`/explorar?q=${p.name}`} className="bg-white rounded-xl p-3 border border-gray-100 hover:border-[#0EA5E9] hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[12px] text-gray-900 group-hover:text-[#0EA5E9] transition-colors">{p.name}</span>
              </div>
              <div className="text-[9px] text-gray-400">
                <span>{p.population.toLocaleString()} hab.</span>
              </div>
            </a>
          ))}
        </div>

        {/* Real communities from API */}
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Users size={14} className="text-[#8B5CF6]" /> Comunidades activas</h2>
        {communities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {communities.filter(c => c.postsToday > 0 || communities.length <= 4).slice(0, 4).map(c => (
              <a key={c.id} href="/comunidad" className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${c.coverColor}15` }}>{c.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[12px] text-gray-900">{c.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{c.members.toLocaleString()} miembros · {c.postsToday} posts hoy</p>
                </div>
                <ExternalLink size={14} className="text-gray-300" />
              </a>
            ))}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-4 mb-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : (
          <p className="text-[11px] text-gray-400 italic mb-8">No hay comunidades disponibles</p>
        )}

        {/* Real recent activity from API */}
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><BarChart2 size={14} className="text-[#F59E0B]" /> Actividad reciente</h2>
        {feedItems.length > 0 ? (
          <div className="space-y-2 mb-8">
            {feedItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: item.sourceColor }}>{item.sourceCode}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900 truncate">{item.headline}</p>
                  <p className="text-[10px] text-gray-400">{item.source} · {item.location}</p>
                </div>
                {item.impact && (
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${item.impact === 'ALTO' ? 'bg-red-50 text-red-500' : item.impact === 'MEDIO' ? 'bg-amber-50 text-amber-500' : 'bg-green-50 text-green-500'}`}>{item.impact}</span>
                )}
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-4 mb-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : (
          <p className="text-[11px] text-gray-400 italic mb-8">No hay actividad reciente</p>
        )}

        {/* Coverage map from real MongoDB */}
        {coverage.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Database size={14} className="text-emerald-500" /> Cobertura de datos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
              {coverage.filter(c => c.docs > 0).map(c => (
                <div key={c.name} className="bg-white rounded-xl p-3 border border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{c.name.replace(/\./g, ' › ')}</p>
                  <p className="font-mono font-bold text-lg text-gray-900">{c.docs.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-400">documentos</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
