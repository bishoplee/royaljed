import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildStudentAssignmentVisibilityFilter,
  getAssignmentSubmissionWindow,
} from '@/lib/studentAssignmentRules';

export async function GET(
  req: Request,
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

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      schoolId: school.id,
      active: true,
      ...visibilityFilter,
    },
    include: {
      module: true,
      lesson: true,
      classes: {
        include: {
          class: true,
        },
      },
      submissions: {
        where: { studentId },
        orderBy: { attemptNumber: 'desc' },
        include: {
          grade: {
            include: {
              tutor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
              timestampedFeedback: {
                orderBy: {
                  timestampSeconds: 'asc',
                },
              },
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const attemptsUsed = assignment.submissions.length;
  const latestSubmission = assignment.submissions[0] ?? null;
  const { remainingAttempts, canSubmit } = getAssignmentSubmissionWindow({
    dueDate: assignment.dueDate,
    maxAttempts: assignment.maxAttempts,
    attemptsUsed,
  });

  return NextResponse.json({
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      instructions: assignment.instructions,
      submissionType: assignment.submissionType,
      maxAttempts: assignment.maxAttempts,
      maxDurationSeconds: assignment.maxDurationSeconds,
      dueDate: assignment.dueDate,
      rubricJson: assignment.rubricJson,
      active: assignment.active,
      moduleTitle: assignment.module.title,
      lessonTitle: assignment.lesson?.title ?? null,
      classNames: assignment.classes.map((entry) => entry.class.name),
      attemptsUsed,
      remainingAttempts,
      canSubmit,
      latestSubmission: latestSubmission
        ? {
            id: latestSubmission.id,
            attemptNumber: latestSubmission.attemptNumber,
            status: latestSubmission.status,
            submittedAt: latestSubmission.submittedAt,
            textContent: latestSubmission.textContent,
            originalFileName: latestSubmission.originalFileName,
            mimeType: latestSubmission.mimeType,
          }
        : null,
      submissions: assignment.submissions.map((submission) => ({
        id: submission.id,
        attemptNumber: submission.attemptNumber,
        status: submission.status,
        submittedAt: submission.submittedAt,
        textContent: submission.textContent,
        originalFileName: submission.originalFileName,
        mimeType: submission.mimeType,
        grade: submission.grade
          ? {
              id: submission.grade.id,
              scoresJson: submission.grade.scoresJson,
              percentage: Number(submission.grade.percentage),
              feedbackText: submission.grade.feedbackText,
              gradedAt: submission.grade.gradedAt,
              tutor: submission.grade.tutor,
              timestampedFeedback: submission.grade.timestampedFeedback.map((entry) => ({
                id: entry.id,
                timestampSeconds: entry.timestampSeconds,
                comment: entry.comment,
                createdAt: entry.createdAt,
              })),
            }
          : null,
      })),
    },
  });
}
