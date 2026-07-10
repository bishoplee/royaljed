import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Level } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { schoolSlug } = await params;
    const body = await req.json();
    const { title, description, level } = body;

    if (!title || !level) {
      return NextResponse.json({ error: 'Missing title or level' }, { status: 400 });
    }

    // Verify school
    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug.toLowerCase().trim() },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Create module
    const maxSortModule = await prisma.module.findFirst({
      where: { schoolId: school.id },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = maxSortModule ? maxSortModule.sortOrder + 1 : 0;

    const createdModule = await prisma.module.create({
      data: {
        schoolId: school.id,
        title,
        description,
        level: level as Level,
        sortOrder,
      },
    });

    return NextResponse.json({ success: true, module: createdModule });
  } catch (error: any) {
    console.error('Error creating module:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
