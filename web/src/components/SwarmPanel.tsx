'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain, Database, Shield, Zap, RefreshCw, ChevronDown,
  ChevronUp, AlertTriangle, CheckCircle, Clock, Loader2
} from 'lucide-react';

type SwarmTask = {
  agent: string;
  task: string;
  priority: string;
  data_source: string;
  estimated_docs: number;
  rationale: string;
};

type IntelEntry = {
  domain: string;
  proposal: string;
  priority: string;
  timestamp: string;
};

type CoverageStat = {
  name: string;
  docs: number;
};

type AlertEntry = {
  type: string;
  severity: string;
  description: string;
};

const AGENT_ICONS: Record<string, typeof Brain> = {
  DataEngineer: Database,
  Researcher: Brain,
  SecurityAuditor: Shield,
  MLEngineer: Zap,
  UXDesigner: Zap,
};

const PRIORITY_COLORS: Record<string, string> = {
  'CRÍTICO': 'bg-red-50 text-red-700 border-red-200',
  'ALTA': 'bg-amber-50 text-amber-700 border-amber-200',
  'MEDIA': 'bg-sky-50 text-sky-700 border-sky-200',
  'BLOCKER': 'bg-red-50 text-red-700 border-red-200',
  'ADMIN': 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function SwarmPanel() {
  const [intel, setIntel] = useState<IntelEntry[]>([]);
  const [coverage, setCoverage] = useState<CoverageStat[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tasks, setTasks] = useState<SwarmTask[]>([]);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/swarm');
      const data = await res.json();
      if (data.success) {
        setIntel(data.intel || []);
        setCoverage(data.coverage || []);
        setAlerts(data.alerts || []);
        setHealthScore(data.diagnostics?.score_salud ?? null);
      }
    } catch { /* silent */ }
  };

  useEffect(() => { fetchState(); }, []);

  const triggerAutoImprove = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/swarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directive: 'auto' }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
      }
    } catch { /* silent */ }
    setGenerating(false);
  };

  const totalDocs = coverage.reduce((s, c) => s + c.docs, 0);
  const activeCols = coverage.filter(c => c.docs > 0).length;

  return (
    <div className="glass-card p-0 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Brain size={15} className="text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest">
              Motor IA Autónomo
            </h3>
            <p className="text-[10px] text-gray-400">
              {coverage.length} colecciones · {totalDocs.toLocaleString()} documentos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Health badge */}
          {healthScore !== null && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              healthScore >= 70 ? 'bg-green-50 text-green-700 border-green-200' :
              healthScore >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-red-50 text-red-700 border-red-200'
            }`}>
              Salud: {healthScore}/100
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* Expandable Body */}
      {expanded && (
        <div className="border-t border-gray-100 animate-fade-in-up">

          {/* Auto-Improve button */}
          <div className="p-4 border-b border-gray-50 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
            <button
              onClick={triggerAutoImprove}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg py-2.5 transition-all disabled:opacity-50"
            >
              {generating ? (
                <><Loader2 size={13} className="animate-spin" /> Gemini generando directivas…</>
              ) : (
                <><Zap size={13} /> Auto-Mejorar Sistema (Gemini)</>
              )}
            </button>
          </div>

          {/* Generated Tasks */}
          {tasks.length > 0 && (
            <div className="p-4 border-b border-gray-50">
              <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-2">
                Directivas IA Generadas
              </h4>
              <ul className="space-y-2">
                {tasks.map((t, i) => {
                  const IconComp = AGENT_ICONS[t.agent] || Brain;
                  return (
                    <li key={i} className="flex items-start gap-2 text-[11px] bg-white rounded-lg p-2 border border-gray-100">
                      <IconComp size={13} className="text-purple-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-bold text-gray-900">{t.agent}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0 rounded-full border ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS['MEDIA']}`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-gray-600 leading-snug">{t.task}</p>
                        {t.data_source !== 'interno' && (
                          <p className="text-[9px] text-sky-500 mt-0.5 truncate">⫸ {t.data_source}</p>
                        )}
                      </div>
                      <span className="text-gray-400 text-[9px] whitespace-nowrap">~{t.estimated_docs?.toLocaleString()} docs</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="p-4 border-b border-gray-50">
              <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">
                Alertas Activas ({alerts.length})
              </h4>
              <ul className="space-y-1.5">
                {alerts.slice(0, 5).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px]">
                    <AlertTriangle size={11} className={a.severity === 'critica' ? 'text-red-500' : 'text-amber-500'} />
                    <span className="text-gray-600">{a.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coverage stats */}
          <div className="p-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Cobertura de Datos ({activeCols}/{coverage.length} activas)
            </h4>
            <div className="grid grid-cols-2 gap-1">
              {coverage.slice(0, 12).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-[10px] px-1.5 py-1 rounded">
                  <span className="text-gray-500 truncate mr-1">{c.name.replace(/\./g, ' › ')}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {c.docs > 0
                      ? <CheckCircle size={9} className="text-green-500" />
                      : <Clock size={9} className="text-gray-300" />}
                    <span className="font-mono text-gray-700">{c.docs.toLocaleString()}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Latest agent intel */}
          {intel.length > 0 && (
            <div className="p-4 border-t border-gray-50">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Últimas Acciones del Swarm
              </h4>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {intel.slice(0, 8).map((entry, i) => (
                  <li key={i} className="text-[10px] text-gray-500 flex items-start gap-1.5">
                    <span className="text-purple-400">▸</span>
                    <span><strong className="text-gray-700">[{entry.domain}]</strong> {entry.proposal.slice(0, 120)}…</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Refresh */}
          <div className="p-3 border-t border-gray-50 flex justify-center">
            <button
              onClick={fetchState}
              className="text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={10} /> Actualizar estado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
