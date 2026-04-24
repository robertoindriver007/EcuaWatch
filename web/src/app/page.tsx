"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import SwarmPanel from "@/components/SwarmPanel";
import FeedCard from "@/components/feed/FeedCard";
import FeedTabs from "@/components/feed/FeedTabs";
import type { FeedItem, FeedTab, Reel, Community } from "@/lib/types";
import {
  TrendingUp, ChevronRight, Film, Users,
  MessageSquare, Loader2, RefreshCw, Database,
  FileText, AlertTriangle, BarChart3
} from "lucide-react";

const EcuadorMap = dynamic(() => import("@/components/map/EcuadorMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] rounded-2xl bg-gradient-to-br from-[#0c1426] to-[#0f1d35] animate-pulse flex items-center justify-center text-white/20 text-sm">Cargando mapa...</div>,
});

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ── Metrics fetched from real MongoDB stats ── */
type DbStats = {
  feed_items: number;
  reels: number;
  communities: number;
  community_posts: number;
  total_collections: number;
  health_score: number;
};

export default function Home() {
  const [feedTab, setFeedTab] = useState<FeedTab>('paraTi');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Real data from APIs
  const [reels, setReels] = useState<Reel[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [recentTags, setRecentTags] = useState<string[]>([]);

  // Fetch sidebar data from real APIs
  useEffect(() => {
    // Reels from API
    fetch('/api/reels?limit=3')
      .then(r => r.json())
      .then(d => { if (d.reels?.length) setReels(d.reels); })
      .catch(() => {});

    // Communities from API
    fetch('/api/comunidad')
      .then(r => r.json())
      .then(d => { if (d.communities?.length) setCommunities(d.communities); })
      .catch(() => {});

    // Real DB stats from swarm API
    fetch('/api/swarm')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.coverage) {
          const lookup = Object.fromEntries(d.coverage.map((c: { name: string; docs: number }) => [c.name, c.docs]));
          setDbStats({
            feed_items: lookup['feed_items'] || 0,
            reels: lookup['reels'] || 0,
            communities: lookup['communities'] || 0,
            community_posts: lookup['community_posts'] || 0,
            total_collections: d.coverage.length,
            health_score: d.diagnostics?.score_salud ?? d.diagnostics?.health_score ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Extract real tags from feed items
  useEffect(() => {
    if (feedItems.length > 0) {
      const allTags: string[] = [];
      feedItems.forEach(item => {
        if (item.tags) allTags.push(...item.tags);
      });
      const unique = [...new Set(allTags)].slice(0, 7);
      setRecentTags(unique);
    }
  }, [feedItems]);

  // Fetch feed from API
  const fetchFeed = useCallback(async (tab: FeedTab, cursor?: string) => {
    try {
      const params = new URLSearchParams({ tab, limit: '10' });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/feed?${params}`);
      return await res.json();
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

  // Load more (infinite scroll)
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

  // IntersectionObserver
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

      {/* ── MAIN GRID ─────────────────────────────────────────── */}
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* ── LEFT SIDEBAR ─────────────────────────── */}
          <aside className="hidden md:flex md:col-span-3 flex-col gap-4">

            {/* Real trending tags from feed */}
            {recentTags.length > 0 && (
              <div className="glass-card p-4">
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                  <TrendingUp size={13} className="text-[#0EA5E9]" /> Temas del Feed
                </h3>
                <ul className="space-y-1.5">
                  {recentTags.map(tag => (
                    <li key={tag} className="text-[12px] font-semibold text-gray-700 hover:text-[#0EA5E9] cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-sky-50">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reels from API */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <Film size={13} className="text-purple-500" /> Reels Cívicos
              </h3>
              {reels.length > 0 ? (
                <div className="space-y-2.5">
                  {reels.map(r => (
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
              ) : (
                <p className="text-[11px] text-gray-400 italic">Cargando reels...</p>
              )}
              <a href="/reels" className="block mt-3 text-center text-[11px] font-semibold text-[#0EA5E9] hover:underline">
                Ver todos los reels →
              </a>
            </div>

            {/* Real DB stats */}
            {dbStats && (
              <div className="glass-card p-4">
                <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Database size={13} className="text-emerald-500" /> Base de Datos
                </h3>
                <ul className="space-y-2">
                  <StatRow icon={FileText} label="Feed items" value={dbStats.feed_items} />
                  <StatRow icon={Film} label="Reels" value={dbStats.reels} />
                  <StatRow icon={Users} label="Comunidades" value={dbStats.communities} />
                  <StatRow icon={MessageSquare} label="Posts debate" value={dbStats.community_posts} />
                  <StatRow icon={Database} label="Colecciones" value={dbStats.total_collections} />
                </ul>
                {dbStats.health_score > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Salud del sistema</span>
                    <span className={`text-[11px] font-bold ${dbStats.health_score >= 70 ? 'text-emerald-500' : dbStats.health_score >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                      {dbStats.health_score}/100
                    </span>
                  </div>
                )}
              </div>
            )}
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

            {/* Loading more */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="text-[#0EA5E9] animate-spin" />
              </div>
            )}

            {/* Manual load more */}
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

            {/* Real communities from API */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users size={13} className="text-purple-500" /> Comunidades
              </h3>
              {communities.length > 0 ? (
                <ul className="space-y-2">
                  {communities.filter(c => c.trending).slice(0, 4).map(c => (
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
                  {communities.filter(c => c.trending).length === 0 && communities.slice(0, 4).map(c => (
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
              ) : (
                <p className="text-[11px] text-gray-400 italic">Cargando comunidades...</p>
              )}
              <a href="/comunidad" className="block mt-2 text-center text-[11px] font-semibold text-[#0EA5E9] hover:underline">
                Ver todas →
              </a>
            </div>

            {/* Swarm Intelligence Panel — REAL data from /api/swarm */}
            <SwarmPanel />
          </aside>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-20 md:h-0" />
    </>
  );
}

/* ── Helper component ── */
function StatRow({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between text-[11px]">
      <span className="flex items-center gap-1.5 text-gray-500">
        <Icon size={11} /> {label}
      </span>
      <span className="font-mono font-bold text-gray-900">{value.toLocaleString()}</span>
    </li>
  );
}
