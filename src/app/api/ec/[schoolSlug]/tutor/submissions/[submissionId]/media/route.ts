import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBMISSIONS_DIR } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolSlug: string; submissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'TUTOR' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { schoolSlug, submissionId } = await params;
    if (!schoolSlug || !submissionId) {
      return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
    }

    const slug = schoolSlug.toLowerCase().trim();
    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({ where: { slug } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const tutorVisibilityFilter =
      session.user.role === 'SUPER_ADMIN'
        ? {}
        : {
            OR: [
              { classes: { none: {} } },
              {
                classes: {
                  some: {
                    class: {
                      tutors: {
                        some: {
                          tutorId: session.user.id,
                        },
                      },
                    },
                  },
                },
              },
            ],
          };

    const submission = await prisma.submission.findFirst({
      where: {
        id: submissionId,
        assignment: {
          schoolId: school.id,
          ...tutorVisibilityFilter,
        },
      },
      select: {
        filePath: true,
        mimeType: true,
        assignment: {
          select: {
            submissionType: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!submission.filePath) {
      return NextResponse.json({ error: 'No media file for this submission.' }, { status: 404 });
    }

    const resolvedRoot = path.resolve(SUBMISSIONS_DIR) + path.sep;
    const resolvedPath = path.resolve(submission.filePath);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      return NextResponse.json({ error: 'Invalid media path' }, { status: 400 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'Submission file not found' }, { status: 404 });
    }

    const fileStream = fs.createReadStream(resolvedPath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (error) => controller.error(error));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    const fallbackType = submission.assignment.submissionType === 'AUDIO' ? 'audio/webm' : 'video/mp4';

    return new Response(stream, {
      headers: {
        'Content-Type': submission.mimeType || fallbackType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Error serving tutor submission media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
