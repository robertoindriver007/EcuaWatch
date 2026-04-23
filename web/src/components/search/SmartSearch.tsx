"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, FileText, Building2, User, Hash, TrendingUp } from "lucide-react";
import { SEARCH_SUGGESTIONS } from "@/lib/seed-content";

const TYPE_ICONS: Record<string, typeof MapPin> = { ley: FileText, contrato: FileText, entidad: Building2, persona: User, provincia: MapPin, tema: Hash };
const TYPE_COLORS: Record<string, string> = { ley: '#3B82F6', contrato: '#EF4444', entidad: '#8B5CF6', persona: '#10B981', provincia: '#F59E0B', tema: '#0EA5E9' };

export default function SmartSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on query
  const filtered = query.length > 0
    ? SEARCH_SUGGESTIONS.filter(s => s.title.toLowerCase().includes(query.toLowerCase()) || s.subtitle.toLowerCase().includes(query.toLowerCase()))
    : SEARCH_SUGGESTIONS.slice(0, 5);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard navigation
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && selectedIdx >= 0) { window.location.href = filtered[selectedIdx].url; }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  }, [filtered, selectedIdx]);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className={`relative flex items-center bg-white/90 backdrop-blur-md rounded-2xl border transition-all duration-300 ${open ? 'border-[#0EA5E9] shadow-lg shadow-sky-100 ring-2 ring-sky-100' : 'border-gray-200 shadow-sm hover:shadow-md'}`}>
        <Search size={18} className="absolute left-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setSelectedIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Buscar leyes, contratos, entidades, personas, provincias..."
          className="w-full pl-11 pr-10 py-3.5 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none rounded-2xl"
          id="smart-search-input"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSelectedIdx(-1); inputRef.current?.focus(); }} className="absolute right-4 text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-2xl shadow-sky-100/50 overflow-hidden z-50 animate-fade-in-up">
          {/* Trending header when no query  */}
          {!query && (
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-[#0EA5E9]" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tendencias de búsqueda</span>
            </div>
          )}

          {/* Results */}
          {filtered.length > 0 ? filtered.map((s, idx) => {
            const Icon = TYPE_ICONS[s.type] || Hash;
            return (
              <a
                key={s.title}
                href={s.url}
                className={`flex items-center gap-3 px-4 py-3 transition-all duration-150 hover:bg-sky-50/60 ${idx === selectedIdx ? 'bg-sky-50/80' : ''} ${idx < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[s.type] }}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                  <p className="text-[11px] text-gray-400 truncate">{s.subtitle}</p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 flex-shrink-0">{s.type}</span>
              </a>
            );
          }) : (
            <div className="px-4 py-8 text-center">
              <Search size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No se encontraron resultados para &quot;{query}&quot;</p>
              <p className="text-[11px] text-gray-300 mt-1">Prueba con otro término o navega las comunidades</p>
            </div>
          )}

          {/* Shortcut hint */}
          <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] text-gray-300">↑↓ navegar · Enter seleccionar · Esc cerrar</span>
            <span className="text-[10px] text-gray-300 font-mono">Ctrl+K</span>
          </div>
        </div>
      )}
    </div>
  );
}
