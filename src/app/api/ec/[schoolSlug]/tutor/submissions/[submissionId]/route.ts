import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildTutorAssignmentVisibilityFilter,
  isTenantMatch,
  isTutorRoleAllowed,
} from '@/lib/tutorAccess';

export async function GET(
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

    const school = await prisma.school.findUnique({ where: { slug } });
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
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            description: true,
            instructions: true,
            submissionType: true,
            dueDate: true,
            rubricJson: true,
            classes: {
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        grade: {
          include: {
            timestampedFeedback: {
              orderBy: {
                timestampSeconds: 'asc',
              },
            },
            tutor: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({
      submission: {
        id: submission.id,
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        attemptNumber: submission.attemptNumber,
        status: submission.status,
        submittedAt: submission.submittedAt,
        filePath: submission.filePath,
        textContent: submission.textContent,
        originalFileName: submission.originalFileName,
        mimeType: submission.mimeType,
        student: submission.student,
        assignment: {
          id: submission.assignment.id,
          title: submission.assignment.title,
          description: submission.assignment.description,
          instructions: submission.assignment.instructions,
          submissionType: submission.assignment.submissionType,
          dueDate: submission.assignment.dueDate,
          rubricJson: submission.assignment.rubricJson,
          classes: submission.assignment.classes.map((entry) => ({
            id: entry.class.id,
            name: entry.class.name,
          })),
        },
        grade: submission.grade
          ? {
              id: submission.grade.id,
              scoresJson: submission.grade.scoresJson,
              percentage: Number(submission.grade.percentage),
              feedbackText: submission.grade.feedbackText,
              feedbackVoicePath: submission.grade.feedbackVoicePath,
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
      },
    });
  } catch (error) {
    console.error('Error fetching tutor submission detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
