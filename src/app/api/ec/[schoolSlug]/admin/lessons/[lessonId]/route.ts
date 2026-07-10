import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { HLS_DIR, RAW_DIR } from '@/lib/storage';
import { Level, LessonType } from '@prisma/client';
import { redis } from '@/lib/redis';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; lessonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { schoolSlug, lessonId } = await params;
    const body = await req.json();
    const { moduleId, title, description, lessonType, level, isFreePreview } = body;

    if (!moduleId || !title || !lessonType || !level) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug.toLowerCase().trim() },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });

    if (!lesson || lesson.module.schoolId !== school.id) {
      return NextResponse.json({ error: 'Lesson not found or school mismatch' }, { status: 404 });
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        moduleId,
        title,
        description,
        lessonType: lessonType as LessonType,
        level: level as Level,
        isFreePreview: !!isFreePreview,
      },
    });

    return NextResponse.json({ success: true, lesson: updatedLesson });
  } catch (error: any) {
    console.error('Error updating lesson:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; lessonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { schoolSlug, lessonId } = await params;

    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug.toLowerCase().trim() },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });

    if (!lesson || lesson.module.schoolId !== school.id) {
      return NextResponse.json({ error: 'Lesson not found or school mismatch' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.accessLink.deleteMany({ where: { lessonId } });
      await tx.practiceSession.deleteMany({ where: { lessonId } });
      await tx.lesson.delete({ where: { id: lessonId } });
    });

    try {
      await redis.del(`lesson:progress:${lessonId}`);
    } catch {
      // Ignore Redis cleanup failures so the delete still succeeds.
    }

    try {
      const lessonDirs = [path.join(HLS_DIR, lessonId), path.join(RAW_DIR, lessonId)];
      for (const targetPath of lessonDirs) {
        await fs.rm(targetPath, { recursive: true, force: true });
      }

      const rawEntries = await fs.readdir(RAW_DIR);
      await Promise.all(
        rawEntries
          .filter((entry) => entry.startsWith(`${lessonId}`))
          .map((entry) => fs.rm(path.join(RAW_DIR, entry), { force: true }))
      );
    } catch (error) {
      console.error('Error cleaning lesson storage files:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting lesson:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
