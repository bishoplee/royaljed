import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureStorageDirs, TMP_DIR } from '@/lib/storage';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Role check: Only ADMIN or SUPER_ADMIN can upload lessons
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { schoolSlug } = await params;
    const body = await req.json();
    const { fileName, fileSize, lessonId } = body;

    if (!fileName || !fileSize || !lessonId) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileName, fileSize, lessonId' },
        { status: 400 }
      );
    }

    // Verify school
    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug.toLowerCase().trim() },
    });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Verify lesson exists and belongs to this school
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!lesson || lesson.module.schoolId !== school.id) {
      return NextResponse.json({ error: 'Lesson not found or access mismatch' }, { status: 404 });
    }

    // Make sure storage directories exist
    ensureStorageDirs();

    // Generate unique upload session ID
    const uploadId = randomUUID();
    const uploadPath = path.join(TMP_DIR, uploadId);
    fs.mkdirSync(uploadPath, { recursive: true });

    // Store metadata if needed (or just write file info)
    fs.writeFileSync(
      path.join(uploadPath, 'metadata.json'),
      JSON.stringify({
        uploadId,
        fileName,
        fileSize,
        lessonId,
        createdAt: new Date().toISOString(),
      })
    );

    // Return init metadata to the client
    return NextResponse.json({
      uploadId,
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
    });
  } catch (error: any) {
    console.error('Error in upload-init API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
