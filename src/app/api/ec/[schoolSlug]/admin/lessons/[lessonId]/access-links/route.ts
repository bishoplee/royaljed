import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function buildToken() {
  return randomBytes(24).toString('hex');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; lessonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
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

    const links = await prisma.accessLink.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'desc' },
      include: { student: true },
    });

    return NextResponse.json({ success: true, links });
  } catch (error: any) {
    console.error('Error fetching access links:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; lessonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { schoolSlug, lessonId } = await params;
    const body = await req.json();
    const { expiresAt, maxViews, studentId } = body;

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

    const parsedExpiresAt = new Date(expiresAt);
    if (Number.isNaN(parsedExpiresAt.getTime()) || parsedExpiresAt <= new Date()) {
      return NextResponse.json({ error: 'A valid future expiration date is required' }, { status: 400 });
    }

    const parsedMaxViews = Number(maxViews ?? 1);
    if (!Number.isInteger(parsedMaxViews) || parsedMaxViews < 1) {
      return NextResponse.json({ error: 'maxViews must be a positive integer' }, { status: 400 });
    }

    if (studentId) {
      const student = await prisma.user.findFirst({
        where: {
          id: studentId,
          schoolId: school.id,
        },
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });
      }
    }

    const link = await prisma.accessLink.create({
      data: {
        lessonId,
        studentId: studentId || null,
        token: buildToken(),
        expiresAt: parsedExpiresAt,
        maxViews: parsedMaxViews,
      },
      include: { student: true },
    });

    return NextResponse.json({ success: true, link });
  } catch (error: any) {
    console.error('Error creating access link:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; lessonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { schoolSlug, lessonId } = await params;
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
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

    await prisma.accessLink.delete({
      where: { id: linkId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting access link:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
