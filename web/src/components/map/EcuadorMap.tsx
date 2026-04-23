"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { PROVINCES } from "@/lib/seed-content";
import type { Province } from "@/lib/types";
import { AlertTriangle, MapPin, BarChart2, Users, ChevronRight, X, TrendingUp, Shield, FileText } from "lucide-react";

// ── Ecuador SVG Province Paths (simplified boundaries) ──────────
const PROVINCE_PATHS: Record<string, string> = {
  'guayas': 'M175,345 L225,340 L235,380 L230,410 L195,420 L170,395 Z',
  'pichincha': 'M215,170 L260,165 L268,200 L255,220 L220,215 L210,190 Z',
  'manabi': 'M130,240 L180,235 L185,300 L170,320 L135,310 L125,270 Z',
  'azuay': 'M240,410 L280,405 L290,440 L275,460 L245,455 L235,430 Z',
  'el-oro': 'M185,445 L225,440 L230,475 L215,490 L190,485 L180,465 Z',
  'esmeraldas': 'M155,90 L210,85 L218,130 L200,150 L160,145 L148,115 Z',
  'tungurahua': 'M255,265 L285,260 L290,290 L278,300 L258,295 L250,280 Z',
  'los-rios': 'M190,300 L230,295 L238,335 L225,345 L195,340 L185,320 Z',
  'chimborazo': 'M260,310 L300,305 L308,345 L295,355 L265,350 L255,330 Z',
  'loja': 'M245,490 L290,485 L300,530 L280,545 L250,540 L240,515 Z',
  'imbabura': 'M220,120 L260,115 L265,150 L250,160 L225,155 L215,140 Z',
  'cotopaxi': 'M225,225 L270,220 L278,255 L262,268 L230,262 L220,245 Z',
  'santo-domingo': 'M185,195 L220,190 L225,225 L212,235 L190,230 L180,215 Z',
  'sucumbios': 'M300,90 L360,85 L368,135 L345,145 L305,140 L295,115 Z',
  'orellana': 'M340,155 L400,150 L408,210 L385,220 L345,215 L335,185 Z',
  'santa-elena': 'M115,345 L165,340 L170,380 L155,395 L120,390 L108,370 Z',
  'bolivar': 'M225,290 L260,285 L265,315 L252,325 L230,320 L220,305 Z',
  'canar': 'M235,380 L270,375 L278,405 L265,415 L240,410 L230,395 Z',
  'carchi': 'M225,78 L265,73 L270,105 L255,115 L230,110 L220,95 Z',
  'morona-santiago': 'M305,365 L370,360 L378,420 L355,430 L310,425 L300,395 Z',
  'napo': 'M290,210 L350,205 L358,260 L335,270 L295,265 L285,240 Z',
  'pastaza': 'M315,275 L385,270 L393,340 L370,350 L320,345 L310,310 Z',
  'zamora-chinchipe': 'M295,450 L345,445 L355,500 L335,510 L300,505 L290,480 Z',
  'galapagos': 'M20,175 L70,170 L75,215 L55,225 L25,220 L15,200 Z',
};

function formatValue(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const RISK_COLORS = { alto: '#EF4444', medio: '#F59E0B', bajo: '#10B981' };
const FILTER_OPTIONS = ['Alertas', 'Contratos', 'Denuncias', 'Debates'] as const;
type FilterKey = 'alerts' | 'contracts' | 'denuncias' | 'activeDebates';
const FILTER_KEYS: Record<typeof FILTER_OPTIONS[number], FilterKey> = { Alertas: 'alerts', Contratos: 'contracts', Denuncias: 'denuncias', Debates: 'activeDebates' };

export default function EcuadorMap() {
  const [selected, setSelected] = useState<Province | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('Alertas');
  const [rotation, setRotation] = useState({ x: 12, y: -8 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setRotation(r => ({ x: Math.max(-30, Math.min(30, r.x - dy * 0.3)), y: Math.max(-40, Math.min(40, r.y + dx * 0.3)) }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const maxVal = Math.max(...PROVINCES.map(p => p[FILTER_KEYS[filter]]));

  return (
    <section className="relative w-full" id="ecuador-map-section">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
            <MapPin size={20} className="text-[#0EA5E9]" />
            Mapa de Ecuador
            <span className="text-xs font-normal text-gray-400 ml-1">3D interactivo</span>
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Arrastra para rotar · Click en provincia para detalles</p>
        </div>
        {/* Filter pills */}
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${filter === f ? 'bg-[#0EA5E9] text-white shadow-lg shadow-sky-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{f}</button>
          ))}
        </div>
      </div>

      {/* 3D Map Container */}
      <div
        className="relative rounded-2xl overflow-hidden border border-gray-200/60 bg-gradient-to-br from-[#0c1426] via-[#0f1d35] to-[#0a1628] shadow-xl cursor-grab active:cursor-grabbing"
        style={{ perspective: '1200px', minHeight: '420px' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        {/* Ocean grid */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, rgba(14,165,233,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        {/* SVG Map */}
        <svg
          viewBox="0 0 450 580"
          className="w-full h-full transition-transform duration-200"
          style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`, transformStyle: 'preserve-3d' }}
        >
          {/* Neighboring countries (darkened) */}
          <path d="M0,0 L450,0 L450,580 L0,580 Z" fill="#080e1a" opacity="0.95" />
          <text x="120" y="60" fill="#1a2540" fontSize="10" fontFamily="Inter">COLOMBIA</text>
          <text x="350" y="300" fill="#1a2540" fontSize="10" fontFamily="Inter">PERÚ</text>
          <text x="30" y="300" fill="#1a2540" fontSize="9" fontFamily="Inter">OCÉANO PACÍFICO</text>

          {/* Ecuador glow base */}
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
            <linearGradient id="ecuGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.15" /><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.1" /></linearGradient>
          </defs>

          {/* Province shapes */}
          {PROVINCES.map(p => {
            const path = PROVINCE_PATHS[p.id];
            if (!path) return null;
            const val = p[FILTER_KEYS[filter]];
            const intensity = maxVal > 0 ? val / maxVal : 0;
            const isHovered = hovered === p.id;
            const isSelected = selected?.id === p.id;
            const color = RISK_COLORS[p.riskLevel];

            return (
              <g key={p.id}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}
                className="cursor-pointer"
              >
                <path
                  d={path}
                  fill={isSelected ? color : isHovered ? `${color}bb` : `rgba(14,165,233,${0.1 + intensity * 0.5})`}
                  stroke={isSelected ? '#fff' : isHovered ? '#0EA5E9' : '#1e3a5f'}
                  strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.8}
                  className="transition-all duration-200"
                  filter={isHovered || isSelected ? 'url(#glow)' : undefined}
                  style={{ transform: isHovered ? 'translateZ(8px)' : 'translateZ(0)', transformBox: 'fill-box', transformOrigin: 'center' }}
                />
                {/* Province indicator dot */}
                <circle cx={p.coords.cx} cy={p.coords.cy} r={isHovered ? 5 : 3 + intensity * 4} fill={color} opacity={0.9} className="transition-all duration-200">
                  {p.riskLevel === 'alto' && <animate attributeName="r" values={`${3 + intensity * 4};${6 + intensity * 4};${3 + intensity * 4}`} dur="2s" repeatCount="indefinite" />}
                </circle>
                {/* Province label */}
                {(isHovered || isSelected || p.riskLevel === 'alto') && (
                  <text x={p.coords.cx} y={p.coords.cy - 10} textAnchor="middle" fill="#e2e8f0" fontSize="8" fontFamily="Inter" fontWeight="600" className="pointer-events-none select-none">{p.name}</text>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(10, 520)">
            <text fill="#64748b" fontSize="8" fontFamily="Inter" fontWeight="600">NIVEL DE RIESGO</text>
            {(['alto', 'medio', 'bajo'] as const).map((r, i) => (
              <g key={r} transform={`translate(${i * 55}, 15)`}>
                <circle cx="5" cy="5" r="4" fill={RISK_COLORS[r]} />
                <text x="14" y="9" fill="#94a3b8" fontSize="7" fontFamily="Inter" style={{ textTransform: 'uppercase' }}>{r}</text>
              </g>
            ))}
          </g>
        </svg>

        {/* Hovered province tooltip */}
        {hovered && !selected && (() => {
          const p = PROVINCES.find(pr => pr.id === hovered);
          if (!p) return null;
          return (
            <div className="absolute top-4 right-4 bg-[#0f1d35]/95 backdrop-blur-md border border-sky-800/40 rounded-xl p-3 text-white w-56 pointer-events-none animate-fade-in-up z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS[p.riskLevel] }} />
                <span className="font-bold text-sm">{p.name}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{p.capital}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div><span className="text-gray-400">Alertas</span><br /><span className="font-mono font-bold text-red-400">{p.alerts}</span></div>
                <div><span className="text-gray-400">Contratos</span><br /><span className="font-mono font-bold text-sky-400">{formatValue(p.contractValue)}</span></div>
                <div><span className="text-gray-400">Denuncias</span><br /><span className="font-mono font-bold text-amber-400">{p.denuncias}</span></div>
                <div><span className="text-gray-400">Debates</span><br /><span className="font-mono font-bold text-purple-400">{p.activeDebates}</span></div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Selected Province Detail Panel */}
      {selected && (
        <div className="mt-4 glass-card p-5 animate-fade-in-up border-l-4" style={{ borderLeftColor: RISK_COLORS[selected.riskLevel] }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <MapPin size={18} style={{ color: RISK_COLORS[selected.riskLevel] }} />
                {selected.name}
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${selected.riskLevel === 'alto' ? 'bg-red-50 text-red-600' : selected.riskLevel === 'medio' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                  Riesgo {selected.riskLevel}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">Capital: {selected.capital} · Población: {selected.population.toLocaleString()}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: AlertTriangle, label: 'Alertas activas', value: selected.alerts, color: '#EF4444' },
              { icon: FileText, label: 'Contratos', value: `${selected.contracts} (${formatValue(selected.contractValue)})`, color: '#0EA5E9' },
              { icon: Shield, label: 'Denuncias', value: selected.denuncias, color: '#F59E0B' },
              { icon: Users, label: 'Debates activos', value: selected.activeDebates, color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon size={12} style={{ color: s.color }} />
                  <span className="text-[10px] text-gray-400">{s.label}</span>
                </div>
                <p className="font-mono font-bold text-gray-900 text-sm">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 bg-[#0EA5E9] text-white text-[11px] font-bold rounded-lg py-2 hover:bg-sky-600 transition-colors flex items-center justify-center gap-1">
              <BarChart2 size={13} /> Ver análisis completo <ChevronRight size={11} />
            </button>
            <button className="flex-1 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-lg py-2 hover:bg-gray-200 transition-colors flex items-center justify-center gap-1">
              <Users size={13} /> Unirse a comunidad <ChevronRight size={11} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
