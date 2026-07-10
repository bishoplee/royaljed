import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureStorageDirs, PRACTICE_DIR, STORAGE_ROOT } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

const AUDIO_MIME_MAP: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

function getFileExtension(file: File) {
  return AUDIO_MIME_MAP[file.type] || file.name.split('.').pop() || 'webm';
}

export async function POST(
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

  const formData = await req.formData();
  const lessonIdValue = formData.get('lessonId');
  const studentAudio = formData.get('studentAudio');

  if (!lessonIdValue || typeof lessonIdValue !== 'string') {
    return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
  }

  if (!studentAudio || !(studentAudio instanceof File)) {
    return NextResponse.json({ error: 'studentAudio file is required' }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonIdValue },
    include: {
      module: {
        include: {
          school: true,
        },
      },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  if (lesson.module.school.slug.toLowerCase().trim() !== normalizedSlug) {
    return NextResponse.json({ error: 'Lesson does not belong to this school' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: 'Student account not found' }, { status: 404 });
  }

  if (session.user.role !== 'SUPER_ADMIN' && user.schoolId !== school.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  ensureStorageDirs();

  const studentPracticeDir = path.join(PRACTICE_DIR, school.id, lesson.id, user.id);
  await fs.promises.mkdir(studentPracticeDir, { recursive: true });

  const extension = getFileExtension(studentAudio);
  const fileName = `practice-${Date.now()}.${extension}`;
  const audioFilePath = path.join(studentPracticeDir, fileName);
  const buffer = Buffer.from(await studentAudio.arrayBuffer());

  await fs.promises.writeFile(audioFilePath, buffer);

  const relativePath = path.relative(STORAGE_ROOT, audioFilePath).replace(/\\/g, '/');

  const practiceSession = await prisma.practiceSession.create({
    data: {
      studentId: user.id,
      lessonId: lesson.id,
      studentAudioPath: relativePath,
    },
  });

  return NextResponse.json({ success: true, practiceSession });
}
