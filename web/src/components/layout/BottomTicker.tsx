'use client';
import React, { useState, useEffect } from 'react';

type TickerItem = {
  text: string;
  color: string; // dot color
};

export default function BottomTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/swarm');
        const data = await res.json();

        if (data.success) {
          const newItems: TickerItem[] = [];

          // Real collection stats
          if (data.coverage?.length) {
            const total = data.coverage.reduce((s: number, c: { docs: number }) => s + c.docs, 0);
            newItems.push({
              text: `BASE DE DATOS: ${data.coverage.length} colecciones · ${total.toLocaleString()} documentos indexados`,
              color: 'bg-green-500',
            });
          }

          // Real health score
          const score = data.diagnostics?.score_salud ?? data.diagnostics?.health_score;
          if (score != null) {
            newItems.push({
              text: `SALUD DEL SISTEMA: ${score}/100 — ${score >= 70 ? 'OPERATIVO' : score >= 40 ? 'DEGRADADO' : 'CRÍTICO'}`,
              color: score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500',
            });
          }

          // Real alerts count
          if (data.alerts?.length) {
            newItems.push({
              text: `ALERTAS ACTIVAS: ${data.alerts.length} alertas de severidad alta/crítica detectadas`,
              color: 'bg-red-500',
            });
          }

          // Active collections
          const active = data.coverage?.filter((c: { docs: number }) => c.docs > 0).length || 0;
          newItems.push({
            text: `COBERTURA: ${active}/${data.coverage?.length || 0} colecciones con datos activos`,
            color: active > 5 ? 'bg-green-500' : 'bg-yellow-500',
          });

          // Last update timestamp
          newItems.push({
            text: `ÚLTIMA SINCRONIZACIÓN: ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`,
            color: 'bg-blue-500',
          });

          if (newItems.length > 0) {
            setItems(newItems);
          }
        }
      } catch {
        setItems([{
          text: 'ECUAWATCH: Conectando con base de datos...',
          color: 'bg-yellow-500',
        }]);
      }
    };
    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 z-40 w-full bg-gray-100 border-t border-gray-300 text-gray-600 text-[10px] uppercase font-mono py-1 px-4 overflow-hidden whitespace-nowrap flex items-center shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:z-50">
      <div className="flex animate-marquee-reverse space-x-16">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center">
            <span className={`h-1.5 w-1.5 ${item.color} rounded-full mr-1.5`} />
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
