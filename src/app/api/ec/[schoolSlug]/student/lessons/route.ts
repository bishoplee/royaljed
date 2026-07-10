import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  const { schoolSlug } = await params;

  if (!schoolSlug) {
    return NextResponse.json({ error: 'Missing school slug' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedSlug = schoolSlug.toLowerCase().trim();
  const school = await prisma.school.findUnique({
    where: { slug: normalizedSlug },
  });

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 });
  }

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== normalizedSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lessons = await prisma.lesson.findMany({
    where: {
      active: true,
      module: {
        schoolId: school.id,
      },
    },
    include: {
      module: true,
    },
    orderBy: [
      {
        module: {
          sortOrder: 'asc',
        },
      },
      {
        sortOrder: 'asc',
      },
    ],
  });

  return NextResponse.json({
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      lessonType: lesson.lessonType,
      level: lesson.level,
      moduleTitle: lesson.module.title,
      videoPath: lesson.videoPath,
      streamUrl:
        lesson.lessonType === 'VIDEO' && lesson.videoPath
          ? `/api/ec/${normalizedSlug}/lessons/${lesson.id}/stream/index.m3u8`
          : null,
      isFreePreview: lesson.isFreePreview,
    })),
  });
}
