import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { HLS_DIR } from '@/lib/storage';
import path from 'path';
import fs from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; lessonId: string; file: string[] }> }
) {
  try {
    const { schoolSlug, lessonId, file } = await params;
    const filename = file.join('/');

    if (!filename) {
      return new NextResponse('File parameter missing', { status: 400 });
    }

    // 1. Fetch lesson & school info for multi-tenancy verification
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

    const school = lesson.module.school;
    if (school.slug.toLowerCase().trim() !== schoolSlug.toLowerCase().trim()) {
      return new NextResponse('School space mismatch', { status: 403 });
    }

    // 2. Perform Authentication checks
    let isAuthorized = false;

    // Check A: Access Link Token (Guest Link - preparing for Phase 5 secure links)
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (token) {
      const accessLink = await prisma.accessLink.findUnique({
        where: { token },
      });

      if (
        accessLink &&
        accessLink.lessonId === lessonId &&
        accessLink.expiresAt > new Date() &&
        accessLink.viewCount < accessLink.maxViews
      ) {
        isAuthorized = true;

        // If this is the main playlist index request, record view count increment
        if (filename === 'index.m3u8') {
          await prisma.accessLink.update({
            where: { id: accessLink.id },
            data: {
              viewCount: {
                increment: 1,
              },
            },
          });
        }
      }
    }

    // Check B: Normal session user
    if (!isAuthorized) {
      const session = await getServerSession(authOptions);
      if (session && session.user) {
        if (
          session.user.role === 'SUPER_ADMIN' ||
          session.user.schoolId === school.id
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new NextResponse('Unauthorized access to stream feed', { status: 401 });
    }

    // 3. Resolve file and prevent path traversal
    const hlsOutputDir = path.join(HLS_DIR, lessonId);
    const filePath = path.join(hlsOutputDir, filename);
    const resolvedPath = path.resolve(filePath);
    const resolvedHlsDir = path.resolve(hlsOutputDir);

    if (!resolvedPath.startsWith(resolvedHlsDir)) {
      return new NextResponse('Access Denied', { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Stream file not found', { status: 404 });
    }

    // 4. Read file stream
    const fileStream = fs.createReadStream(filePath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        fileStream.on('end', () => {
          controller.close();
        });
        fileStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
      },
    });

    // 5. Determine Content-Type
    const contentType = filename.endsWith('.m3u8')
      ? 'application/x-mpegURL'
      : 'video/MP2T';

    // 6. Return response with dynamic streaming headers preventing download/caching
    return new Response(stream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error in streaming API:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
