import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ASSIGNMENT_CREATE_WINDOW_MS = 60 * 1000;
const ASSIGNMENT_CREATE_LIMIT = 10;
const MIN_MAX_DURATION_SECONDS = 30;
const MAX_MAX_DURATION_SECONDS = 3600;
const DEFAULT_MAX_DURATION_SECONDS = 180;
const MIN_MAX_ATTEMPTS = 1;
const MAX_MAX_ATTEMPTS = 10;
const DEFAULT_MAX_ATTEMPTS = 2;
const recentAssignmentCreateAttempts = new Map<string, number[]>();

function allowAssignmentCreateAttempt(userId: string) {
  const now = Date.now();
  const cutoff = now - ASSIGNMENT_CREATE_WINDOW_MS;
  const attempts = recentAssignmentCreateAttempts
    .get(userId)
    ?.filter((timestamp) => timestamp >= cutoff) ?? [];

  if (attempts.length >= ASSIGNMENT_CREATE_LIMIT) {
    return false;
  }

  attempts.push(now);
  recentAssignmentCreateAttempts.set(userId, attempts);
  return true;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schoolSlug } = await params;
    const slug = schoolSlug.toLowerCase().trim();

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({ where: { slug } });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const assignments = await prisma.assignment.findMany({
      where: { schoolId: school.id },
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
        lesson: {
          select: {
            id: true,
            title: true,
          },
        },
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
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        submissionType: assignment.submissionType,
        maxAttempts: assignment.maxAttempts,
        dueDate: assignment.dueDate,
        active: assignment.active,
        module: assignment.module,
        lesson: assignment.lesson,
        classNames: assignment.classes.map((entry) => entry.class.name),
      })),
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schoolSlug } = await params;
    const slug = schoolSlug.toLowerCase().trim();

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    if (!allowAssignmentCreateAttempt(session.user.id)) {
      return NextResponse.json(
        { error: 'Too many assignment creation attempts. Please try again shortly.' },
        { status: 429 }
      );
    }

    const school = await prisma.school.findUnique({ where: { slug } });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      description,
      instructions,
      moduleId,
      lessonId,
      submissionType,
      maxDurationSeconds,
      maxAttempts,
      dueDate,
      classIds,
      rubricJson,
    } = body;

    if (!title || !moduleId || !submissionType || !dueDate) {
      return NextResponse.json(
        { error: 'Title, module, submission type, and due date are required.' },
        { status: 400 }
      );
    }

    const moduleRecord = await prisma.module.findFirst({
      where: {
        id: moduleId,
        schoolId: school.id,
      },
      select: { id: true },
    });

    if (!moduleRecord) {
      return NextResponse.json({ error: 'Module not found for this school.' }, { status: 400 });
    }

    if (lessonId) {
      const lessonRecord = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          moduleId,
        },
        select: { id: true },
      });

      if (!lessonRecord) {
        return NextResponse.json({ error: 'Lesson does not belong to selected module.' }, { status: 400 });
      }
    }

    const normalizedClassIds = Array.isArray(classIds)
      ? Array.from(new Set(classIds.map((id: string) => String(id).trim()).filter(Boolean)))
      : [];

    if (classIds !== undefined && !Array.isArray(classIds)) {
      return NextResponse.json({ error: 'classIds must be an array when provided.' }, { status: 400 });
    }

    if (Array.isArray(classIds) && classIds.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Each classId must be a string.' }, { status: 400 });
    }

    if (normalizedClassIds.length > 0) {
      const validClasses = await prisma.class.findMany({
        where: {
          id: { in: normalizedClassIds },
          schoolId: school.id,
        },
        select: { id: true },
      });

      if (validClasses.length !== normalizedClassIds.length) {
        return NextResponse.json(
          { error: 'One or more selected classes are invalid for this school.' },
          { status: 400 }
        );
      }
    }

    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });
    }

    const boundedMaxDurationSeconds =
      typeof maxDurationSeconds === 'number' &&
      Number.isFinite(maxDurationSeconds) &&
      maxDurationSeconds >= MIN_MAX_DURATION_SECONDS &&
      maxDurationSeconds <= MAX_MAX_DURATION_SECONDS
        ? maxDurationSeconds
        : DEFAULT_MAX_DURATION_SECONDS;

    const boundedMaxAttempts =
      typeof maxAttempts === 'number' &&
      Number.isFinite(maxAttempts) &&
      maxAttempts >= MIN_MAX_ATTEMPTS &&
      maxAttempts <= MAX_MAX_ATTEMPTS
        ? maxAttempts
        : DEFAULT_MAX_ATTEMPTS;

    const createdAssignment = await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          schoolId: school.id,
          moduleId,
          lessonId: lessonId || null,
          title: String(title).trim(),
          description: description ? String(description).trim() : null,
          instructions: instructions ? String(instructions).trim() : null,
          submissionType,
          maxDurationSeconds: boundedMaxDurationSeconds,
          maxAttempts: boundedMaxAttempts,
          dueDate: parsedDueDate,
          rubricJson:
            Array.isArray(rubricJson) && rubricJson.length > 0
              ? rubricJson
              : [{ name: 'Completion', percentage: 100 }],
          active: true,
        },
      });

      if (normalizedClassIds.length > 0) {
        await tx.assignmentClass.createMany({
          data: normalizedClassIds.map((classId) => ({
            assignmentId: assignment.id,
            classId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          userId: session.user.id,
          action: 'ASSIGNMENT_CREATE',
          details: `Created assignment ${assignment.title}`,
        },
      });

      return assignment;
    });

    return NextResponse.json({
      message: 'Assignment created successfully',
      assignment: createdAssignment,
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
