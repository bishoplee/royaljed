import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; lessonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { schoolSlug, lessonId } = await params;

    // Fetch lesson
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            school: true,
          },
        },
      },
    });

    if (!lesson) {
      return new NextResponse('Lesson not found', { status: 404 });
    }

    // Tenant check
    if (
      session.user.role !== 'SUPER_ADMIN' &&
      session.user.schoolId !== lesson.module.school.id
    ) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Fetch active progress from Redis if present
    const progressData = await redis.get(`lesson:progress:${lessonId}`);
    let progress = null;
    if (progressData) {
      try {
        progress = JSON.parse(progressData);
      } catch (e) {
        console.error('Error parsing progress JSON from redis:', e);
      }
    }

    return NextResponse.json({
      id: lesson.id,
      videoPath: lesson.videoPath,
      videoStatus: lesson.videoStatus || 'PENDING',
      videoError: lesson.videoError,
      progress,
    });
  } catch (error: any) {
    console.error('Error in lesson status API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
