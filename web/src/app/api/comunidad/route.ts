import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const DB = process.env.MONGODB_DB || 'ecuador_intel';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';

    const client = await clientPromise;
    const db = client.db(DB);

    const query: Record<string, unknown> = {};
    if (category && category !== 'todas') query.category = category;

    const communities = await db.collection('communities')
      .find(query)
      .sort({ members: -1 })
      .toArray();

    return NextResponse.json({
      communities: communities.map(c => ({ ...c, id: String(c._id), _id: undefined })),
      total: communities.length,
    });
  } catch (error) {
    console.error('[API /comunidad] Error:', error);

    const { COMMUNITIES } = await import('@/lib/seed-content');
    const category = new URL(req.url).searchParams.get('category') || '';
    const filtered = category && category !== 'todas'
      ? COMMUNITIES.filter(c => c.category === category)
      : COMMUNITIES;

    return NextResponse.json({
      communities: filtered,
      total: filtered.length,
      source: 'seed-fallback',
    });
  }
}

// POST: Create a new community post (discussion thread)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { communityId, title, content, author } = body;

    if (!communityId || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB);

    const post = {
      communityId,
      title,
      content,
      author: author || { name: 'Ciudadano Anónimo', avatar: '👤' },
      upvotes: 0,
      downvotes: 0,
      comments: 0,
      replies: [],
      aiGenerated: body.aiGenerated || false,
      createdAt: new Date(),
    };

    const result = await db.collection('community_posts').insertOne(post);

    // Increment postsToday counter
    await db.collection('communities').updateOne(
      { _id: communityId },
      { $inc: { postsToday: 1 } }
    );

    return NextResponse.json({
      success: true,
      id: String(result.insertedId),
    }, { status: 201 });
  } catch (error) {
    console.error('[API /comunidad POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
