"use client";
import { useState } from "react";
import type { FeedTab } from "@/lib/types";
import { TrendingUp, Clock, MapPin, AlertTriangle } from "lucide-react";

const TABS: { id: FeedTab; label: string; icon: typeof TrendingUp }[] = [
  { id: 'paraTi', label: 'Para Ti', icon: TrendingUp },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'tuCiudad', label: 'Tu Ciudad', icon: MapPin },
  { id: 'denuncias', label: 'Denuncias', icon: AlertTriangle },
];

interface Props { active: FeedTab; onChange: (tab: FeedTab) => void; }

export default function FeedTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-200 ${
            active === tab.id ? 'bg-[#0EA5E9] text-white shadow-lg shadow-sky-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <tab.icon size={13} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
