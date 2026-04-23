import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  const tabs = [
    { name: "Inicio", path: "/", icon: "🏠" },
    { name: "Reels", path: "/reels", icon: "🎬" },
    { name: "Comunidad", path: "/comunidad", icon: "👥" },
    { name: "Explorar", path: "/explorar", icon: "🔍" },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center mr-6 group">
          <span className="text-xl font-bold tracking-tighter text-ecua-blue group-hover:opacity-80 transition-opacity">
            Ecua<span className="text-gray-900">Watch</span>
          </span>
          <span className="ml-2 text-[8px] font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 px-1.5 py-0.5 rounded-full uppercase tracking-widest">IA</span>
        </Link>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-xl px-4">
          <Link href="/explorar" className="block">
            <div className="relative group cursor-pointer">
              <input
                type="text"
                placeholder="🔍 Buscar leyes, contratos, funcionarios, datos..."
                className="w-full bg-gray-100 border border-transparent text-gray-900 text-sm rounded-full focus:ring-ecua-blue focus:border-ecua-blue block p-2 px-4 transition-all duration-300 cursor-pointer pointer-events-none"
                readOnly
                tabIndex={-1}
              />
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="hidden md:flex items-center gap-1">
          {tabs.map(tab => (
            <Link
              key={tab.path}
              href={tab.path}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-sky-50 hover:text-[#0EA5E9] whitespace-nowrap transition-all duration-200"
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
