"use client";
import type { FeedItem } from "@/lib/types";
import { Heart, MessageCircle, Share2, Bookmark, BarChart2, Bot, MapPin, ChevronRight } from "lucide-react";
import { useState } from "react";

const impactStyle: Record<string, string> = {
  ALTO: "bg-red-50 text-red-600 border-red-200",
  MEDIO: "bg-amber-50 text-amber-700 border-amber-200",
  BAJO: "bg-green-50 text-green-700 border-green-200",
};

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const likeCount = liked ? item.likes + 1 : item.likes;

  return (
    <article
      className="glass-card p-4 animate-fade-in-up hover:shadow-lg transition-shadow duration-300"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black shadow-md" style={{ backgroundColor: item.sourceColor }}>
            {item.sourceCode}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-[12px] font-bold text-gray-900">{item.source}</h4>
              {item.aiGenerated && <Bot size={12} className="text-purple-500" />}
            </div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <MapPin size={9} /> {item.location} · {item.time}
            </p>
          </div>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${impactStyle[item.impact]}`}>
          {item.impact}
        </span>
      </div>

      {/* Badge */}
      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{item.badge}</span>

      {/* Headline */}
      <h2 className="text-sm font-bold text-gray-900 mt-1 mb-2 leading-snug hover:text-[#0EA5E9] cursor-pointer transition-colors">
        {item.headline}
      </h2>

      {/* Body */}
      <p className="text-[12px] text-gray-600 leading-relaxed mb-3">{item.body}</p>

      {/* Media placeholder */}
      {item.mediaType && (
        <div className={`rounded-xl mb-3 flex items-center justify-center ${item.mediaType === 'chart' ? 'bg-gradient-to-br from-sky-50 to-purple-50 h-32' : 'bg-gray-100 h-40'}`}>
          {item.mediaType === 'chart' && <BarChart2 size={28} className="text-[#0EA5E9]/50" />}
          {item.mediaType === 'video' && (
            <div className="relative w-full h-full rounded-xl bg-gray-900/5 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[#0EA5E9] ml-1" />
              </div>
            </div>
          )}
          {item.mediaType === 'image' && <MapPin size={28} className="text-gray-300" />}
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.tags.map(tag => (
          <span key={tag} className="text-[10px] text-[#0EA5E9] bg-sky-50 px-2.5 py-0.5 rounded-full font-medium cursor-pointer hover:bg-sky-100 transition-colors">{tag}</span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button onClick={() => setLiked(!liked)} className={`flex items-center gap-1 text-[11px] transition-colors ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {formatNum(likeCount)}
        </button>
        <button className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#0EA5E9] transition-colors">
          <MessageCircle size={15} /> {formatNum(item.comments)}
        </button>
        <button className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-green-500 transition-colors">
          <Share2 size={15} /> {formatNum(item.shares)}
        </button>
        <button onClick={() => setSaved(!saved)} className={`transition-colors ${saved ? 'text-amber-500' : 'text-gray-400 hover:text-amber-400'}`}>
          <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  );
}
