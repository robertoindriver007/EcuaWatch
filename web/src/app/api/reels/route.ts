import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const DB = process.env.MONGODB_DB || 'ecuador_intel';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';
    const cursor = searchParams.get('cursor') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '6'), 20);

    const client = await clientPromise;
    const db = client.db(DB);
    const col = db.collection('reels');

    const query: Record<string, unknown> = {};
    if (category) query.category = category;
    if (cursor) query._id = { $lt: cursor };

    const items = await col
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? String(results[results.length - 1]._id) : null;

    return NextResponse.json({
      reels: results.map(r => ({ ...r, id: String(r._id), _id: undefined })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('[API /reels] Error:', error);

    // Fallback to seed content
    const { ORGANIC_REELS } = await import('@/lib/seed-content');
    return NextResponse.json({
      reels: ORGANIC_REELS,
      nextCursor: null,
      hasMore: false,
      source: 'seed-fallback',
    });
  }
}

// POST: Create new reel (AI-generated or citizen upload)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const required = ['title', 'description', 'category', 'province'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing: ${field}` }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db(DB);

    const doc = {
      title: body.title,
      description: body.description,
      videoUrl: body.videoUrl || '',
      thumbnailUrl: body.thumbnailUrl || '',
      duration: body.duration || 60,
      author: body.author || { name: 'EcuaWatch IA', avatar: '🤖', verified: true },
      category: body.category,
      tags: body.tags || [],
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      province: body.province,
      aiGenerated: body.aiGenerated ?? true,
      createdAt: new Date(),
      // AI metadata
      generatedBy: body.generatedBy || null,
      sourceData: body.sourceData || null,
      script: body.script || null,
    };

    const result = await db.collection('reels').insertOne(doc);

    return NextResponse.json({
      success: true,
      id: String(result.insertedId),
      message: 'Reel created',
    }, { status: 201 });
  } catch (error) {
    console.error('[API /reels POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
