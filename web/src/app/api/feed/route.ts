import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const DB = process.env.MONGODB_DB || 'ecuador_intel';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'paraTi';
    const cursor = searchParams.get('cursor') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 30);
    const province = searchParams.get('province') || '';

    const client = await clientPromise;
    const db = client.db(DB);
    const col = db.collection('feed_items');

    // Build query based on tab
    const query: Record<string, unknown> = {};

    if (cursor) {
      query._id = { $lt: cursor };
    }

    switch (tab) {
      case 'trending':
        // Sort by engagement (likes + comments + shares)
        break;
      case 'tuCiudad':
        if (province) query.province = province;
        break;
      case 'denuncias':
        query.type = 'citizen';
        break;
      default: // paraTi — all content
        break;
    }

    const sortField: Record<string, 1 | -1> = tab === 'trending'
      ? { likes: -1, _id: -1 }
      : { _id: -1 };

    const items = await col
      .find(query)
      .sort(sortField)
      .limit(limit + 1)
      .toArray();

    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? String(results[results.length - 1]._id) : null;

    return NextResponse.json({
      items: results.map(item => ({
        ...item,
        id: String(item._id),
        _id: undefined,
      })),
      nextCursor,
      hasMore,
      tab,
    });
  } catch (error) {
    console.error('[API /feed] Error:', error);

    // Fallback: return seed content if DB is empty or unavailable
    const { ORGANIC_FEED } = await import('@/lib/seed-content');

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'paraTi';
    let items = [...ORGANIC_FEED];

    if (tab === 'trending') items.sort((a, b) => b.likes - a.likes);
    if (tab === 'denuncias') items = items.filter(i => i.type === 'citizen');

    return NextResponse.json({
      items,
      nextCursor: null,
      hasMore: false,
      tab,
      source: 'seed-fallback',
    });
  }
}

// POST: Create new feed item (citizen report, AI-generated alert, etc.)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const required = ['type', 'source', 'headline', 'body', 'province'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db(DB);

    const doc = {
      type: body.type,
      source: body.source,
      sourceCode: body.sourceCode || body.source.slice(0, 2).toUpperCase(),
      sourceColor: body.sourceColor || '#0EA5E9',
      time: new Date().toISOString(),
      badge: body.badge || '📍 PUBLICACIÓN',
      location: body.location || '',
      province: body.province,
      headline: body.headline,
      body: body.body,
      tags: body.tags || [],
      impact: body.impact || 'MEDIO',
      likes: 0,
      comments: 0,
      shares: 0,
      mediaUrl: body.mediaUrl || null,
      mediaType: body.mediaType || null,
      aiGenerated: body.aiGenerated || false,
      createdAt: new Date(),
    };

    const result = await db.collection('feed_items').insertOne(doc);

    return NextResponse.json({
      success: true,
      id: String(result.insertedId),
      message: 'Feed item created',
    }, { status: 201 });
  } catch (error) {
    console.error('[API /feed POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
