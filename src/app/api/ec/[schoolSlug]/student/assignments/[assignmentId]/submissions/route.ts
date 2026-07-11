import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildSubmissionDirectory, getSubmissionFileExtension } from '@/lib/studentAssignments';
import { ensureStorageDirs } from '@/lib/storage';
import {
  buildStudentAssignmentVisibilityFilter,
  canTransitionSubmissionStatus,
  getAssignmentSubmissionWindow,
  getNewSubmissionStatus,
} from '@/lib/studentAssignmentRules';

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;
const MAX_TEXT_SIZE_BYTES = 200 * 1024;
const SUBMISSION_WINDOW_MS = 60 * 1000;
const SUBMISSION_LIMIT = 5;
const recentSubmissionAttempts = new Map<string, number[]>();

function getMaxAllowedSize(submissionType: 'AUDIO' | 'VIDEO' | 'TEXT') {
  if (submissionType === 'VIDEO') return MAX_VIDEO_SIZE_BYTES;
  if (submissionType === 'AUDIO') return MAX_AUDIO_SIZE_BYTES;
  return MAX_TEXT_SIZE_BYTES;
}

function allowSubmissionAttempt(studentId: string) {
  const now = Date.now();
  const cutoff = now - SUBMISSION_WINDOW_MS;
  const attempts = recentSubmissionAttempts.get(studentId)?.filter((timestamp) => timestamp >= cutoff) ?? [];

  if (attempts.length >= SUBMISSION_LIMIT) {
    return false;
  }

  attempts.push(now);
  recentSubmissionAttempts.set(studentId, attempts);
  return true;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string; assignmentId: string }> }
) {
  const { schoolSlug, assignmentId } = await params;

  if (!schoolSlug || !assignmentId) {
    return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'STUDENT' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const normalizedSlug = schoolSlug.toLowerCase().trim();
  const school = await prisma.school.findUnique({ where: { slug: normalizedSlug } });

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 });
  }

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== normalizedSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const student = await prisma.user.findUnique({
    where: { id: session.user.id as string },
  });

  if (!student) {
    return NextResponse.json({ error: 'Student account not found' }, { status: 404 });
  }

  if (student.status !== 'ACTIVE' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only active students can submit assignments.' }, { status: 403 });
  }

  if (student.schoolId !== school.id && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visibilityFilter = buildStudentAssignmentVisibilityFilter({
    isSuperAdmin: session.user.role === 'SUPER_ADMIN',
    studentId: student.id,
  });

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      schoolId: school.id,
      active: true,
      ...visibilityFilter,
    },
    include: {
      classes: {
        include: {
          class: true,
        },
      },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const attemptsUsed = await prisma.submission.count({
    where: {
      assignmentId: assignment.id,
      studentId: student.id,
    },
  });

  const latestSubmission = await prisma.submission.findFirst({
    where: {
      assignmentId: assignment.id,
      studentId: student.id,
    },
    orderBy: { attemptNumber: 'desc' },
    select: { status: true },
  });

  const { canSubmit, isPastDue, remainingAttempts } = getAssignmentSubmissionWindow({
    dueDate: assignment.dueDate,
    maxAttempts: assignment.maxAttempts,
    attemptsUsed,
  });

  if (!canSubmit) {
    if (isPastDue) {
      return NextResponse.json({ error: 'This assignment is past due.' }, { status: 409 });
    }

    if (remainingAttempts === 0) {
      return NextResponse.json(
        { error: 'You have used all available attempts for this assignment.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'You cannot submit this assignment right now.' },
      { status: 409 }
    );
  }

  if (latestSubmission && !canTransitionSubmissionStatus(latestSubmission.status, getNewSubmissionStatus())) {
    return NextResponse.json(
      { error: 'You cannot submit again while the previous attempt is in its current state.' },
      { status: 409 }
    );
  }

  if (!allowSubmissionAttempt(student.id)) {
    return NextResponse.json({ error: 'Too many submission attempts. Please try again shortly.' }, { status: 429 });
  }

  const contentType = req.headers.get('content-type') || '';

  let textContent: string | null = null;
  let uploadedFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const textValue = formData.get('textContent');
    const fileValue = formData.get('submissionFile');

    if (typeof textValue === 'string' && textValue.trim() !== '') {
      textContent = textValue.trim();
    }

    if (fileValue instanceof File) {
      uploadedFile = fileValue;
    }
  } else {
    const body = await req.json().catch(() => null);

    if (body && typeof body.textContent === 'string') {
      textContent = body.textContent.trim();
    }
  }

  ensureStorageDirs();

  let storedFilePath: string | null = null;
  let originalFileName: string | null = null;
  let mimeType: string | null = null;

  if (assignment.submissionType === 'TEXT') {
    if (!textContent) {
      return NextResponse.json({ error: 'Text content is required for this assignment.' }, { status: 400 });
    }

    if (Buffer.byteLength(textContent, 'utf8') > getMaxAllowedSize('TEXT')) {
      return NextResponse.json({ error: 'Text response is too large.' }, { status: 413 });
    }
  } else {
    if (!uploadedFile) {
      return NextResponse.json({ error: 'A media file is required for this assignment.' }, { status: 400 });
    }

    if (uploadedFile.size > getMaxAllowedSize(assignment.submissionType)) {
      return NextResponse.json({ error: 'File too large.' }, { status: 413 });
    }

    const expectedPrefix = assignment.submissionType === 'AUDIO' ? 'audio/' : 'video/';
    if (!uploadedFile.type.toLowerCase().startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: `Please upload a valid ${assignment.submissionType.toLowerCase()} file.` },
        { status: 400 }
      );
    }

    const extension = getSubmissionFileExtension(uploadedFile, assignment.submissionType);
    if (!extension) {
      return NextResponse.json({ error: 'Unsupported media type.' }, { status: 400 });
    }

    const submissionDir = buildSubmissionDirectory(school.id, assignment.id, student.id);
    await fs.promises.mkdir(submissionDir, { recursive: true });

    originalFileName = uploadedFile.name;
    mimeType = uploadedFile.type || null;
    const fileName = `attempt-pending.${extension}`;
    storedFilePath = path.join(submissionDir, fileName);

    const readable = Readable.fromWeb(uploadedFile.stream() as any);
    const writeStream = fs.createWriteStream(storedFilePath);

    await new Promise<void>((resolve, reject) => {
      readable.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
      readable.pipe(writeStream);
    });
  }

  let submission;
  let currentFilePath = storedFilePath;

  try {
    for (let retry = 0; retry < 2; retry += 1) {
      try {
        submission = await prisma.$transaction(async (tx) => {
          const latestCount = await tx.submission.count({
            where: {
              assignmentId: assignment.id,
              studentId: student.id,
            },
          });

          if (latestCount >= assignment.maxAttempts) {
            throw new Error('Max attempts exceeded');
          }

          const nextAttemptNumber = latestCount + 1;

          if (currentFilePath) {
            const extension = path.extname(currentFilePath);
            const finalFileName = `attempt-${nextAttemptNumber}${extension}`;
            const finalFilePath = path.join(path.dirname(currentFilePath), finalFileName);

            if (finalFilePath !== currentFilePath) {
              await fs.promises.rename(currentFilePath, finalFilePath);
              currentFilePath = finalFilePath;
            }
          }

          return tx.submission.create({
            data: {
              assignmentId: assignment.id,
              studentId: student.id,
              attemptNumber: nextAttemptNumber,
              filePath: currentFilePath ?? undefined,
              textContent,
              originalFileName,
              mimeType,
              status: getNewSubmissionStatus(),
            },
          });
        });

        storedFilePath = currentFilePath;
        break;
      } catch (error) {
        const isUniqueConflict =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'P2002';

        if (isUniqueConflict && retry === 0) {
          continue;
        }

        throw error;
      }
    }
  } catch (error) {
    if (currentFilePath) {
      await fs.promises.unlink(currentFilePath).catch(() => undefined);
    }

    if (error instanceof Error && error.message === 'Max attempts exceeded') {
      return NextResponse.json(
        { error: 'You have used all available attempts for this assignment.' },
        { status: 409 }
      );
    }

    throw error;
  }

  if (!submission) {
    throw new Error('Submission could not be created');
  }

  return NextResponse.json({
    success: true,
    submission: {
      id: submission.id,
      attemptNumber: submission.attemptNumber,
      status: submission.status,
      submittedAt: submission.submittedAt,
    },
  });
}
