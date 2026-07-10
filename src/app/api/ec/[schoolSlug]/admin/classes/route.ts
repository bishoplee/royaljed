import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ClassCategory } from '@prisma/client';

// GET: Retrieve all classes with their students and tutors
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

    const school = await prisma.school.findUnique({
      where: { slug },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const classes = await prisma.class.findMany({
      where: { schoolId: school.id },
      include: {
        students: {
          select: {
            student: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        tutors: {
          select: {
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
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Format structure
    const formatted = classes.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      sortOrder: c.sortOrder,
      students: c.students.map((cs) => cs.student),
      tutors: c.tutors.map((ct) => ct.tutor),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a single class or bulk create classes
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

    const school = await prisma.school.findUnique({
      where: { slug },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, category, bulkClasses } = body;

    // Case 1: Bulk Create
    if (bulkClasses && Array.isArray(bulkClasses)) {
      const created: any[] = [];
      const skipped: string[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of bulkClasses) {
          const { name: cName, category: cCategory } = item;

          if (!cName || !cCategory) continue;

          // Check duplicate name
          const existing = await tx.class.findFirst({
            where: {
              name: cName.trim(),
              schoolId: school.id,
            },
          });

          if (existing) {
            skipped.push(cName);
            continue;
          }

          const newClass = await tx.class.create({
            data: {
              schoolId: school.id,
              name: cName.trim(),
              category: cCategory as ClassCategory,
            },
          });
          created.push(newClass);
        }

        // Log audit
        await tx.auditLog.create({
          data: {
            schoolId: school.id,
            userId: session.user.id,
            action: 'BULK_CLASS_CREATE',
            details: `Created ${created.length} classes, skipped duplicates: ${skipped.join(', ')}`,
          },
        });
      });

      return NextResponse.json({
        message: `Successfully created ${created.length} classes. Skipped ${skipped.length} duplicates.`,
        createdCount: created.length,
        skippedCount: skipped.length,
        skippedNames: skipped,
      });
    }

    // Case 2: Single Create
    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    // Check duplicate
    const existing = await prisma.class.findFirst({
      where: {
        name: name.trim(),
        schoolId: school.id,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Class name already exists under this school' }, { status: 400 });
    }

    const newClass = await prisma.class.create({
      data: {
        schoolId: school.id,
        name: name.trim(),
        category: category as ClassCategory,
      },
    });

    await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: session.user.id,
        action: 'CLASS_CREATE',
        details: `Created class ${newClass.name} under category ${newClass.category}`,
      },
    });

    return NextResponse.json({
      message: 'Class created successfully',
      class: newClass,
    });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update class detail (rename) and assign students/tutors
export async function PUT(
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

    const school = await prisma.school.findUnique({
      where: { slug },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const body = await request.json();
    const { classId, name, category, tutorIds, studentIds } = body;

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    // Verify class belongs to this school
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: school.id,
      },
    });

    if (!classRecord) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Process updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Rename or update category
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (category) updateData.category = category;

      const updatedClass = await tx.class.update({
        where: { id: classId },
        data: updateData,
      });

      // 2. Update Tutors (if array is provided)
      if (tutorIds && Array.isArray(tutorIds)) {
        // Delete existing relations
        await tx.classTutor.deleteMany({
          where: { classId },
        });

        // Insert new relations
        if (tutorIds.length > 0) {
          await tx.classTutor.createMany({
            data: tutorIds.map((tId: string) => ({
              classId,
              tutorId: tId,
            })),
          });
        }
      }

      // 3. Update Students (if array is provided)
      if (studentIds && Array.isArray(studentIds)) {
        // Delete existing relations
        await tx.classStudent.deleteMany({
          where: { classId },
        });

        // Insert new relations
        if (studentIds.length > 0) {
          await tx.classStudent.createMany({
            data: studentIds.map((sId: string) => ({
              classId,
              studentId: sId,
            })),
          });
        }
      }

      // 4. Log audit details
      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          userId: session.user.id,
          action: 'CLASS_ASSIGNMENTS_UPDATE',
          details: `Updated class ${classRecord.name} details and roster assignments`,
        },
      });

      return updatedClass;
    });

    return NextResponse.json({
      message: 'Class assignments updated successfully',
      class: result,
    });
  } catch (error) {
    console.error('Error updating class assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
