import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubmissionStatus } from '@prisma/client';

function parseStatusFilter(raw: string | null): SubmissionStatus | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'SUBMITTED') return SubmissionStatus.SUBMITTED;
  if (normalized === 'GRADED') return SubmissionStatus.GRADED;
  if (normalized === 'DRAFT') return SubmissionStatus.DRAFT;
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

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { schoolSlug } = await params;
    const slug = schoolSlug.toLowerCase().trim();

    // Tenant check: ADMIN must belong to this school
    if (
      session.user.role !== 'SUPER_ADMIN' &&
      session.user.schoolSlug !== slug
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

    const submissions = await prisma.submission.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(assignmentId ? { assignmentId } : {}),
        assignment: {
          schoolId: school.id,
          ...(classId
            ? {
                classes: {
                  some: { classId },
                },
              }
            : {}),
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
                  select: { id: true, name: true },
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
            tutor: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        status: s.status,
        attemptNumber: s.attemptNumber,
        submittedAt: s.submittedAt,
        student: s.student,
        assignment: {
          id: s.assignment.id,
          title: s.assignment.title,
          submissionType: s.assignment.submissionType,
          dueDate: s.assignment.dueDate,
          classNames: s.assignment.classes.map((e) => e.class.name),
          classIds: s.assignment.classes.map((e) => e.class.id),
        },
        grade: s.grade
          ? {
              id: s.grade.id,
              percentage: Number(s.grade.percentage),
              gradedAt: s.grade.gradedAt,
              tutorName: s.grade.tutor?.fullName ?? null,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('Error listing admin submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
