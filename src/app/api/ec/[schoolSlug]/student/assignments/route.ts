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

  const assignments = await prisma.assignment.findMany({
    where: {
      active: true,
      schoolId: school.id,
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
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  });

  const now = new Date();

  return NextResponse.json({
    assignments: assignments.map((assignment) => {
      const attemptsUsed = assignment.submissions.length;
      const latestSubmission = assignment.submissions[0] ?? null;
      const { remainingAttempts, isPastDue, canSubmit } = getAssignmentSubmissionWindow({
        dueDate: assignment.dueDate,
        maxAttempts: assignment.maxAttempts,
        attemptsUsed,
        now,
      });

      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        instructions: assignment.instructions,
        submissionType: assignment.submissionType,
        maxAttempts: assignment.maxAttempts,
        dueDate: assignment.dueDate,
        active: assignment.active,
        moduleTitle: assignment.module.title,
        lessonTitle: assignment.lesson?.title ?? null,
        classNames: assignment.classes.map((entry) => entry.class.name),
        attemptsUsed,
        remainingAttempts,
        isPastDue,
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
      };
    }),
  });
}
