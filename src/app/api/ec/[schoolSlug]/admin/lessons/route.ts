import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Level, LessonType } from '@prisma/client';

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
    const { moduleId, title, description, lessonType, level, isFreePreview } = body;

    if (!moduleId || !title || !lessonType || !level) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify module belongs to school
    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug.toLowerCase().trim() },
    });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const curriculumModule = await prisma.module.findUnique({
      where: { id: moduleId },
    });
    if (!curriculumModule || curriculumModule.schoolId !== school.id) {
      return NextResponse.json({ error: 'Module not found or school mismatch' }, { status: 404 });
    }

    // Get max sort order
    const maxSortLesson = await prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = maxSortLesson ? maxSortLesson.sortOrder + 1 : 0;

    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title,
        description,
        lessonType: lessonType as LessonType,
        level: level as Level,
        isFreePreview: !!isFreePreview,
        sortOrder,
        videoStatus: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, lesson });
  } catch (error: any) {
    console.error('Error creating lesson:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
