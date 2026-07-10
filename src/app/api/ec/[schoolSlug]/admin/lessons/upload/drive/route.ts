import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { HLS_DIR } from '@/lib/storage';
import { videoTranscodeQueue } from '@/lib/queue';
import path from 'path';
import fs from 'fs';

// Helper to extract file ID from various Google Drive share links
function extractFileId(url: string): string | null {
  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  if (dMatch && dMatch[1]) return dMatch[1];

  // Pattern 2: https://drive.google.com/open?id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  if (idMatch && idMatch[1]) return idMatch[1];

  return null;
}

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
    const { lessonId, driveUrl } = body;

    if (!lessonId || !driveUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: lessonId, driveUrl' },
        { status: 400 }
      );
    }

    const fileId = extractFileId(driveUrl.trim());
    if (!fileId) {
      return NextResponse.json(
        { error: 'Invalid Google Drive URL. Please make sure the link contains a valid file ID.' },
        { status: 400 }
      );
    }

    // Verify school
    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug.toLowerCase().trim() },
    });
    if (!school) {
      return NextResponse.json({ error: 'School space not found' }, { status: 404 });
    }

    // Verify lesson exists and belongs to school
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });

    if (!lesson || lesson.module.schoolId !== school.id) {
      return NextResponse.json({ error: 'Lesson not found or tenant mismatch' }, { status: 404 });
    }

    // Update database status to PROCESSING (meaning downloading & transcoding has started)
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoStatus: 'PROCESSING',
        videoError: null,
      },
    });

    // Create HLS output directory
    const hlsOutputDir = path.join(HLS_DIR, lessonId);
    if (!fs.existsSync(hlsOutputDir)) {
      fs.mkdirSync(hlsOutputDir, { recursive: true });
    }

    // Push transcoding job with driveFileId to BullMQ
    const job = await videoTranscodeQueue.add('transcode', {
      lessonId,
      schoolSlug,
      rawPath: '', // Will be downloaded in background
      driveFileId: fileId,
      hlsOutputDir,
      playlistName: 'index.m3u8',
    });

    return NextResponse.json({
      success: true,
      message: 'Google Drive import initialized. Download & transcoding started in background.',
      jobId: job.id,
    });
  } catch (error: any) {
    console.error('Error in Google Drive import API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
