import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TMP_DIR, RAW_DIR, HLS_DIR, ensureStorageDirs } from '@/lib/storage';
import { videoTranscodeQueue } from '@/lib/queue';
import path from 'path';
import fs from 'fs';

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
    const { uploadId, lessonId, totalChunks } = body;

    if (!uploadId || !lessonId || typeof totalChunks !== 'number') {
      return NextResponse.json(
        { error: 'Missing required parameters: uploadId, lessonId, totalChunks' },
        { status: 400 }
      );
    }

    const uploadPath = path.join(TMP_DIR, uploadId);
    if (!fs.existsSync(uploadPath)) {
      return NextResponse.json({ error: 'Upload session not found' }, { status: 404 });
    }

    // Verify all chunks are present
    for (let i = 0; i < totalChunks; i++) {
      const chunkFilePath = path.join(uploadPath, `chunk_${i}`);
      if (!fs.existsSync(chunkFilePath)) {
        return NextResponse.json(
          { error: `Missing chunk ${i}. Cannot merge.` },
          { status: 400 }
        );
      }
    }

    // Ensure output directories exist
    ensureStorageDirs();

    // Define output raw file path
    // We append the extension based on original file if available in metadata.json
    let fileExt = '.mp4';
    const metadataPath = path.join(uploadPath, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        if (metadata.fileName) {
          const parsedExt = path.extname(metadata.fileName);
          if (parsedExt) fileExt = parsedExt;
        }
      } catch (err) {
        console.warn('Error reading metadata.json:', err);
      }
    }

    const rawFilePath = path.join(RAW_DIR, `${lessonId}${fileExt}`);
    const writeStream = fs.createWriteStream(rawFilePath);

    // Merge chunks sequentially
    for (let i = 0; i < totalChunks; i++) {
      const chunkFilePath = path.join(uploadPath, `chunk_${i}`);
      const chunkBuffer = fs.readFileSync(chunkFilePath);
      writeStream.write(chunkBuffer);
    }
    writeStream.end();

    // Wait for file writing to complete
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
    });

    // Clean up temporary chunks directory
    try {
      fs.rmSync(uploadPath, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to delete temp upload path:', err);
    }

    // Update database status to PROCESSING
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

    // Push transcoding job to BullMQ
    const job = await videoTranscodeQueue.add('transcode', {
      lessonId,
      schoolSlug,
      rawPath: rawFilePath,
      hlsOutputDir,
      playlistName: 'index.m3u8',
    });

    return NextResponse.json({
      success: true,
      message: 'Video successfully merged. Transcoding started.',
      jobId: job.id,
    });
  } catch (error: any) {
    console.error('Error in upload-complete API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
