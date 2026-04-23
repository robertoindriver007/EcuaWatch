'use client';
import React, { useEffect } from 'react';

/**
 * OutbrainWidget — "Descubre más en la web" recommendation engine.
 * Positioned at the bottom of the page, after main content.
 * This generates passive revenue through content recommendations.
 *
 * NOTE: Replace OB_AD_CODE below with your Outbrain widget code after signup at outbrain.com
 */
export default function OutbrainWidget() {
  useEffect(() => {
    // Load Outbrain script only once
    if (document.getElementById('outbrain-script')) return;
    const script = document.createElement('script');
    script.id = 'outbrain-script';
    script.src = 'https://widgets.outbrain.com/outbrain.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="w-full border-t border-gray-100 mt-8 pt-6 pb-4 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Outbrain label */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">
            Más que podrías encontrar interesante
          </span>
          <span className="text-[9px] text-gray-300">by Outbrain</span>
        </div>

        {/* Outbrain widget anchor — replace data attributes with your own */}
        <div
          className="OUTBRAIN"
          data-src="https://ecuawatch.vercel.app"    // ← Replace with your live URL
          data-widget-id="OB_ECUAWATCH_MAIN"         // ← Replace with your Outbrain widget ID after signup
          data-ob-template="EcuaWatch"
        />
      </div>
    </div>
  );
}
