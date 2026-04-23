"use client";
import { COMMUNITIES as SEED_COMMUNITIES } from "@/lib/seed-content";
import type { Community } from "@/lib/types";
import { Users, MessageSquare, TrendingUp, ChevronRight, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

type Category = 'todas' | 'ciudad' | 'tema' | 'institucion';
const CATS: { id: Category; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'ciudad', label: '🏙️ Ciudades' },
  { id: 'institucion', label: '🏛️ Instituciones' },
  { id: 'tema', label: '📊 Temas' },
];

function formatNum(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ComunidadPage() {
  const [cat, setCat] = useState<Category>('todas');
  const [search, setSearch] = useState('');
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch communities from API
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/comunidad?category=${cat === 'todas' ? '' : cat}`);
        const data = await res.json();
        if (!cancelled && data.communities?.length) {
          setCommunities(data.communities);
        } else if (!cancelled) {
          setCommunities(SEED_COMMUNITIES);
        }
      } catch {
        if (!cancelled) setCommunities(SEED_COMMUNITIES);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [cat]);

  const filtered = communities
    .filter(c => cat === 'todas' || c.category === cat)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0EA5E9] via-[#3B82F6] to-[#8B5CF6] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-black mb-2">Comunidades EcuaWatch</h1>
          <p className="text-white/80 text-sm max-w-lg">Únete a la red de vigilancia ciudadana más grande de Ecuador. Debate, denuncia, propone y fiscaliza junto a miles de ciudadanos comprometidos.</p>

          {/* Stats */}
          <div className="flex gap-6 mt-4">
            <div><span className="font-mono font-bold text-xl">{formatNum(communities.reduce((a, c) => a + c.members, 0))}</span><br /><span className="text-[10px] text-white/60">Ciudadanos activos</span></div>
            <div><span className="font-mono font-bold text-xl">{communities.length}</span><br /><span className="text-[10px] text-white/60">Comunidades</span></div>
            <div><span className="font-mono font-bold text-xl">{communities.reduce((a, c) => a + c.postsToday, 0)}</span><br /><span className="text-[10px] text-white/60">Posts hoy</span></div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-5">
        {/* Search & Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar comunidad..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-shadow"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${cat === c.id ? 'bg-[#0EA5E9] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{c.label}</button>
            ))}
          </div>
        </div>

        {/* Community Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
              {/* Color header */}
              <div className="h-2" style={{ backgroundColor: c.coverColor }} />
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm" style={{ backgroundColor: `${c.coverColor}15` }}>{c.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-sm">{c.name}</h3>
                      {c.trending && <span className="flex items-center gap-0.5 text-[9px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full"><TrendingUp size={9} /> Trend</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{c.description}</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><Users size={11} /> {formatNum(c.members)} miembros</span>
                  <span className="flex items-center gap-1"><MessageSquare size={11} /> {c.postsToday} posts hoy</span>
                </div>

                {/* Recent topics */}
                <div className="mt-3 space-y-1">
                  {c.recentTopics.slice(0, 2).map(topic => (
                    <div key={topic} className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#0EA5E9] cursor-pointer transition-colors">
                      <MessageSquare size={10} className="text-gray-300 flex-shrink-0" />
                      <span className="truncate">{topic}</span>
                    </div>
                  ))}
                </div>

                {/* Join button */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setJoined(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                    className={`flex-1 text-[11px] font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                      joined.has(c.id) ? 'bg-gray-100 text-gray-500' : 'text-white shadow-lg hover:opacity-90'
                    }`}
                    style={!joined.has(c.id) ? { backgroundColor: c.coverColor } : undefined}
                  >
                    {joined.has(c.id) ? '✓ Unido' : 'Unirse'}
                  </button>
                  <button className="px-3 py-2 bg-gray-50 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
