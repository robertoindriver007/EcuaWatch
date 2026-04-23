"use client";
import { Home, Film, Compass, Users, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Inicio' },
  { href: '/reels', icon: Film, label: 'Reels' },
  { href: '/explorar', icon: Compass, label: 'Explorar' },
  { href: '/comunidad', icon: Users, label: 'Comunidad' },
  { href: '#perfil', icon: User, label: 'Perfil' },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-200/60 safe-area-bottom" id="mobile-bottom-nav">
      <div className="flex items-center justify-around py-2 px-1">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${isActive ? 'text-[#0EA5E9]' : 'text-gray-400 hover:text-gray-600'}`}>
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[9px] font-semibold ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-[#0EA5E9] mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
