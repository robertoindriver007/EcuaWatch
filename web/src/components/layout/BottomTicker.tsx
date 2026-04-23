import React from 'react';

export default function BottomTicker() {
  return (
    <div className="fixed bottom-0 z-50 w-full bg-gray-100 border-t border-gray-300 text-gray-600 text-[10px] uppercase font-mono py-1 px-4 overflow-hidden whitespace-nowrap flex items-center shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex animate-marquee-reverse space-x-16">
        <span className="flex items-center">
          <span className="h-1.5 w-1.5 bg-green-500 rounded-full mr-1.5"></span>
          SERCOP DATA: Sincronizado (Hace 2h)
        </span>
        <span className="flex items-center">
          <span className="h-1.5 w-1.5 bg-green-500 rounded-full mr-1.5"></span>
          SRI CATASTRO: Sincronizado (Hace 45m)
        </span>
        <span className="flex items-center">
          <span className="h-1.5 w-1.5 bg-yellow-500 rounded-full mr-1.5"></span>
          FLUJO FINANCIERO: +$4.2M Transacciones diarias monitoreadas
        </span>
        <span className="flex items-center">
          <span className="h-1.5 w-1.5 bg-blue-500 rounded-full mr-1.5"></span>
          CGE ALERTAS: 12 nuevas anomalías detectadas en Gobiernos Locales.
        </span>
        <span>
            ECUAWATCH BLOCKCHAIN STATE: OK. Hash rate estable.
        </span>
      </div>
    </div>
  );
}
