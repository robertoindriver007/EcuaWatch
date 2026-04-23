import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const DB = process.env.MONGODB_DB || 'ecuador_intel';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || ''; // ley, contrato, entidad, persona, provincia
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const client = await clientPromise;
    const db = client.db(DB);

    // Multi-collection search
    const results: Record<string, unknown>[] = [];

    if (!type || type === 'feed') {
      const feedItems = await db.collection('feed_items')
        .find(q ? { $or: [
          { headline: { $regex: q, $options: 'i' } },
          { body: { $regex: q, $options: 'i' } },
          { tags: { $regex: q, $options: 'i' } },
          { province: { $regex: q, $options: 'i' } },
        ] } : {})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      results.push(...feedItems.map(i => ({ ...i, _type: 'feed', id: String(i._id), _id: undefined })));
    }

    if (!type || type === 'reel') {
      const reels = await db.collection('reels')
        .find(q ? { $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { tags: { $regex: q, $options: 'i' } },
        ] } : {})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      results.push(...reels.map(r => ({ ...r, _type: 'reel', id: String(r._id), _id: undefined })));
    }

    if (!type || type === 'community') {
      const communities = await db.collection('communities')
        .find(q ? { $or: [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { tags: { $regex: q, $options: 'i' } },
        ] } : {})
        .limit(limit)
        .toArray();
      results.push(...communities.map(c => ({ ...c, _type: 'community', id: String(c._id), _id: undefined })));
    }

    return NextResponse.json({
      results,
      total: results.length,
      query: q,
    });
  } catch (error) {
    console.error('[API /search] Error:', error);

    // Fallback with seed suggestions
    const { SEARCH_SUGGESTIONS } = await import('@/lib/seed-content');
    const q = new URL(req.url).searchParams.get('q') || '';
    const filtered = q
      ? SEARCH_SUGGESTIONS.filter(s => s.title.toLowerCase().includes(q.toLowerCase()) || s.subtitle.toLowerCase().includes(q.toLowerCase()))
      : SEARCH_SUGGESTIONS;

    return NextResponse.json({
      results: filtered,
      total: filtered.length,
      query: q,
      source: 'seed-fallback',
    });
  }
}
