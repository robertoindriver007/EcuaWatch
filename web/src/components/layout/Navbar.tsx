import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  const tabs = [
    { name: "Inicio", path: "/" },
    { name: "Explorar (Mapas 3D)", path: "/explore" },
    { name: "Premium (B2B)", path: "/premium" },
    { name: "Marketplace", path: "/marketplace" },
    { name: "Servicios", path: "/services" },
    { name: "Datos", path: "/data" },
    { name: "Gráficos", path: "/graphics" },
    { name: "Eventos", path: "/events" },
    { name: "Workspaces", path: "/workspaces" },
    { name: "Shorts/Reels", path: "/reels" },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center mr-6">
          <span className="text-xl font-bold tracking-tighter text-ecua-blue">
            Ecua<span className="text-gray-900">Watch</span>
          </span>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-xl px-4">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="🔍 Buscar leyes, empresas, contratos o personas..."
              className="w-full bg-gray-100 border border-transparent text-gray-900 text-sm rounded-full focus:ring-ecua-blue focus:border-ecua-blue block p-2 px-4 transition-all duration-300"
            />
          </div>
        </div>

        {/* Auth Placeholders / Mini-profile */}
        <div className="flex items-center space-x-3 ml-4">
          <button className="text-sm font-semibold text-gray-700 hover:text-ecua-blue px-3 py-2">
            Iniciar Sesión
          </button>
          <button className="text-sm font-semibold text-white bg-ecua-blue hover:bg-blue-700 px-4 py-2 rounded-md transition-colors">
            Unirse
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="w-full bg-white border-t border-gray-100 overflow-x-auto no-scrollbar">
        <ul className="flex items-center space-x-1 px-4 py-1 text-xs font-medium text-gray-600">
          {tabs.map((tab) => (
            <li key={tab.name}>
              <Link 
                href={tab.path}
                className="px-3 py-1.5 rounded-md hover:bg-gray-100 hover:text-gray-900 whitespace-nowrap transition-colors block"
              >
                {tab.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
