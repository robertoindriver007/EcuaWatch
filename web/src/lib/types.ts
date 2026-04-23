// ── EcuaWatch V3: Shared Types ──────────────────────────────────
export type FeedTab = 'paraTi' | 'trending' | 'tuCiudad' | 'denuncias';

export interface FeedItem {
  id: string;
  type: 'alert' | 'law' | 'citizen' | 'data' | 'debate';
  source: string;
  sourceCode: string;
  sourceColor: string;
  time: string;
  badge: string;
  location: string;
  province: string;
  headline: string;
  body: string;
  tags: string[];
  impact: 'ALTO' | 'MEDIO' | 'BAJO';
  likes: number;
  comments: number;
  shares: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'chart';
  aiGenerated?: boolean;
}

export interface Reel {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  author: { name: string; avatar: string; verified: boolean };
  category: string;
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  province: string;
  aiGenerated: boolean;
  createdAt: string;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  coverColor: string;
  members: number;
  postsToday: number;
  category: 'ciudad' | 'tema' | 'institucion';
  trending: boolean;
  tags: string[];
  recentTopics: string[];
}

export interface Province {
  id: string;
  name: string;
  capital: string;
  population: number;
  contracts: number;
  contractValue: number;
  alerts: number;
  laws: number;
  denuncias: number;
  riskLevel: 'alto' | 'medio' | 'bajo';
  activeDebates: number;
  coords: { cx: number; cy: number };
}

export interface SearchSuggestion {
  type: 'ley' | 'contrato' | 'entidad' | 'persona' | 'provincia' | 'tema';
  title: string;
  subtitle: string;
  icon: string;
  url: string;
}
