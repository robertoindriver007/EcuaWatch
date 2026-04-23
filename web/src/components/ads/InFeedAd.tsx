'use client';
import React, { useEffect, useRef } from 'react';

interface InFeedAdProps {
  adSlot: string;          // Your Google AdSense slot ID
  adFormat?: string;       // 'auto' | 'fluid' | 'rectangle'
  adLayout?: string;       // 'in-article' when inside feed
  className?: string;
}

/**
 * InFeedAd — Non-invasive Google AdSense unit that blends into the feed.
 * It renders as a subtle "Patrocinado" card, matching EcuaWatch's aesthetic.
 */
export default function InFeedAd({ adSlot, adFormat = 'auto', adLayout = 'in-article', className = '' }: InFeedAdProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    // Avoid double-pushing on strict mode re-renders
    if (pushed.current) return;
    pushed.current = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {
      console.warn('[AdSense] Not loaded yet:', e);
    }
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Subtle sponsored label */}
      <div className="flex items-center gap-1.5 mb-1.5 px-1">
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">Patrocinado</span>
      </div>

      <div ref={adRef} className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"   // ← Replace with your AdSense publisher ID
          data-ad-slot={adSlot}
          data-ad-format={adFormat}
          data-ad-layout={adLayout}
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
