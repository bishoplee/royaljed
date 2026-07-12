import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubmissionStatus } from '@prisma/client';
import {
  buildTutorAssignmentVisibilityFilter,
  isTenantMatch,
  isTutorRoleAllowed,
} from '@/lib/tutorAccess';

function parseStatusFilter(raw: string | null): SubmissionStatus | null {
  if (!raw) return null;

  const normalized = raw.trim().toUpperCase();
  if (normalized === SubmissionStatus.SUBMITTED) return SubmissionStatus.SUBMITTED;
  if (normalized === SubmissionStatus.GRADED) return SubmissionStatus.GRADED;
  if (normalized === SubmissionStatus.DRAFT) return SubmissionStatus.DRAFT;

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isTutorRoleAllowed(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { schoolSlug } = await params;
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

    const assignmentId = req.nextUrl.searchParams.get('assignmentId')?.trim() || null;
    const classId = req.nextUrl.searchParams.get('classId')?.trim() || null;
    const statusFilter = parseStatusFilter(req.nextUrl.searchParams.get('status'));

    if (req.nextUrl.searchParams.get('status') && !statusFilter) {
      return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 });
    }

    const tutorVisibilityFilter = buildTutorAssignmentVisibilityFilter({
      isSuperAdmin: session.user.role === 'SUPER_ADMIN',
      tutorId: session.user.id,
    });

    const submissions = await prisma.submission.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(assignmentId ? { assignmentId } : {}),
        assignment: {
          schoolId: school.id,
          ...(classId
            ? {
                classes: {
                  some: {
                    classId,
                  },
                },
              }
            : {}),
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
            submissionType: true,
            dueDate: true,
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
          select: {
            id: true,
            percentage: true,
            gradedAt: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({
      submissions: submissions.map((submission) => ({
        id: submission.id,
        status: submission.status,
        attemptNumber: submission.attemptNumber,
        submittedAt: submission.submittedAt,
        student: submission.student,
        assignment: {
          id: submission.assignment.id,
          title: submission.assignment.title,
          submissionType: submission.assignment.submissionType,
          dueDate: submission.assignment.dueDate,
          classNames: submission.assignment.classes.map((entry) => entry.class.name),
          classIds: submission.assignment.classes.map((entry) => entry.class.id),
        },
        grade: submission.grade
          ? {
              id: submission.grade.id,
              percentage: Number(submission.grade.percentage),
              gradedAt: submission.grade.gradedAt,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('Error listing tutor submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
