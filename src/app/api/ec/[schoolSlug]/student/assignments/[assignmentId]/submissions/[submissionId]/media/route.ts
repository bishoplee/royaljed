import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBMISSIONS_DIR } from '@/lib/storage';
import { buildStudentAssignmentVisibilityFilter } from '@/lib/studentAssignmentRules';

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ schoolSlug: string; assignmentId: string; submissionId: string }>;
  }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schoolSlug, assignmentId, submissionId } = await params;

    if (!schoolSlug || !assignmentId || !submissionId) {
      return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
    }

    const normalizedSlug = schoolSlug.toLowerCase().trim();
    const school = await prisma.school.findUnique({ where: { slug: normalizedSlug } });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== normalizedSlug) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = session.user.id as string;
    const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
    const visibilityFilter = buildStudentAssignmentVisibilityFilter({
      isSuperAdmin,
      studentId,
    });

    const submission = await prisma.submission.findFirst({
      where: {
        id: submissionId,
        assignmentId,
        assignment: {
          schoolId: school.id,
          ...visibilityFilter,
        },
        ...(isSuperAdmin ? {} : { studentId }),
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
    console.error('Error serving student submission media:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
