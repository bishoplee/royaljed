import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubmissionStatus } from '@prisma/client';
import {
  calculatePercentage,
  MAX_FEEDBACK_TEXT_LENGTH,
  normalizeRubric,
  normalizeScores,
  normalizeTimestampedFeedback,
} from '@/lib/grading';
import {
  buildTutorAssignmentVisibilityFilter,
  isTenantMatch,
  isTutorRoleAllowed,
} from '@/lib/tutorAccess';
import { pushGradeToGoogleClassroom } from '@/lib/googleClassroom';

const GRADE_WRITE_WINDOW_MS = 60 * 1000;
const GRADE_WRITE_LIMIT = 40;
const recentGradeWriteAttempts = new Map<string, number[]>();

function allowGradeWriteAttempt(userId: string) {
  const now = Date.now();
  const cutoff = now - GRADE_WRITE_WINDOW_MS;
  const attempts = recentGradeWriteAttempts
    .get(userId)
    ?.filter((timestamp) => timestamp >= cutoff) ?? [];

  if (attempts.length >= GRADE_WRITE_LIMIT) {
    return false;
  }

  attempts.push(now);
  recentGradeWriteAttempts.set(userId, attempts);
  return true;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ schoolSlug: string; submissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isTutorRoleAllowed(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { schoolSlug, submissionId } = await params;

    if (!schoolSlug || !submissionId) {
      return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
    }

    const slug = schoolSlug.toLowerCase().trim();

    if (
      !isTenantMatch({
        isSuperAdmin: session.user.role === 'SUPER_ADMIN',
        userSchoolSlug: session.user.schoolSlug,
        targetSchoolSlug: slug,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    if (!allowGradeWriteAttempt(session.user.id)) {
      return NextResponse.json(
        { error: 'Too many grade save attempts. Please try again shortly.' },
        { status: 429 }
      );
    }

    const school = await prisma.school.findUnique({
      where: { slug },
      include: { schoolConfig: true },
    });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const tutorVisibilityFilter = buildTutorAssignmentVisibilityFilter({
      isSuperAdmin: session.user.role === 'SUPER_ADMIN',
      tutorId: session.user.id,
    });

    const submission = await prisma.submission.findFirst({
      where: {
        id: submissionId,
        assignment: {
          schoolId: school.id,
          ...tutorVisibilityFilter,
        },
      },
      include: {
        student: {
          select: {
            email: true,
          },
        },
        assignment: {
          select: {
            id: true,
            rubricJson: true,
            googleCourseWorkId: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const scores = normalizeScores((body as { scores?: unknown }).scores);
    const timestampedFeedback = normalizeTimestampedFeedback(
      (body as { timestampedFeedback?: unknown }).timestampedFeedback
    );
    const feedbackTextRaw = (body as { feedbackText?: unknown }).feedbackText;
    const feedbackText = typeof feedbackTextRaw === 'string' ? feedbackTextRaw.trim() : null;

    if (feedbackText && feedbackText.length > MAX_FEEDBACK_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Feedback text cannot exceed ${MAX_FEEDBACK_TEXT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    if (scores.length === 0) {
      return NextResponse.json({ error: 'At least one rubric score is required.' }, { status: 400 });
    }

    const rubric = normalizeRubric(submission.assignment.rubricJson);
    if (rubric.length === 0) {
      return NextResponse.json({ error: 'Assignment rubric is invalid.' }, { status: 400 });
    }

    const percentageResult = calculatePercentage(rubric, scores);
    if (!percentageResult.ok) {
      return NextResponse.json({ error: percentageResult.error }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingGrade = await tx.grade.findUnique({
        where: { submissionId: submission.id },
        select: { id: true, tutorId: true },
      });

      if (
        existingGrade &&
        existingGrade.tutorId !== session.user.id &&
        session.user.role !== 'SUPER_ADMIN'
      ) {
        throw new Error('FORBIDDEN_GRADE_OVERRIDE');
      }

      const grade = existingGrade
        ? await tx.grade.update({
            where: { id: existingGrade.id },
            data: {
              scoresJson: scores,
              percentage: percentageResult.percentage,
              feedbackText,
              gradedAt: new Date(),
            },
          })
        : await tx.grade.create({
            data: {
              submissionId: submission.id,
              tutorId: session.user.id,
              scoresJson: scores,
              percentage: percentageResult.percentage,
              feedbackText,
            },
          });

      await tx.timestampedFeedback.deleteMany({ where: { gradeId: grade.id } });

      if (timestampedFeedback.length > 0) {
        await tx.timestampedFeedback.createMany({
          data: timestampedFeedback.map((entry) => ({
            gradeId: grade.id,
            timestampSeconds: entry.timestampSeconds,
            comment: entry.comment,
          })),
        });
      }

      await tx.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.GRADED },
      });

      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          userId: session.user.id,
          action: 'SUBMISSION_GRADE',
          details: `Graded submission ${submission.id} for assignment ${submission.assignment.id} at ${percentageResult.percentage}% with ${timestampedFeedback.length} timeline comments`,
        },
      });

      const gradeWithFeedback = await tx.grade.findUnique({
        where: { id: grade.id },
        include: {
          timestampedFeedback: {
            orderBy: { timestampSeconds: 'asc' },
          },
        },
      });

      return gradeWithFeedback;
    });

    // Trigger Google Classroom grade sync in the background if configured
    if (
      school.schoolConfig?.gclassSyncEnabled &&
      school.schoolConfig?.googleRefreshToken &&
      submission.assignment.googleCourseWorkId
    ) {
      prisma.assignmentClass.findFirst({
        where: {
          assignmentId: submission.assignmentId,
          class: {
            googleCourseId: { not: null },
            students: {
              some: { studentId: submission.studentId },
            },
          },
        },
        include: { class: true },
      }).then(async (assignmentClass) => {
        if (assignmentClass?.class.googleCourseId) {
          console.log(`Pushing grade to Google Classroom for student ${submission.student.email}...`);
          await pushGradeToGoogleClassroom(
            school.schoolConfig!.googleRefreshToken!,
            assignmentClass.class.googleCourseId,
            submission.assignment.googleCourseWorkId!,
            submission.student.email,
            percentageResult.percentage
          );
          console.log('Successfully pushed grade to Google Classroom.');
        }
      }).catch((err) => {
        console.error('Failed to sync grade to Google Classroom:', err);
      });
    }

    return NextResponse.json({
      message: 'Submission graded successfully.',
      grade: result
        ? {
            id: result.id,
            submissionId: result.submissionId,
            scoresJson: result.scoresJson,
            percentage: Number(result.percentage),
            feedbackText: result.feedbackText,
            gradedAt: result.gradedAt,
            timestampedFeedback: result.timestampedFeedback,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN_GRADE_OVERRIDE') {
      return NextResponse.json(
        { error: 'Only the original grader can update this submission grade.' },
        { status: 403 }
      );
    }

    console.error('Error grading submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
