import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: 'School slug is required' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { slug: slug.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        brandColor: true,
      },
    });

    if (!school) {
      return NextResponse.json({ error: 'School space not found' }, { status: 404 });
    }

    return NextResponse.json(school);
  } catch (error) {
    console.error('Error fetching school details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
