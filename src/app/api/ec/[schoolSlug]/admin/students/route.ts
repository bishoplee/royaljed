import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// GET: List all students for this school
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

    const students = await prisma.user.findMany({
      where: {
        schoolId: school.id,
        role: Role.STUDENT,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        classStudents: {
          select: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    // Format structure to simplify client binding
    const formatted = students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      phone: s.phone,
      status: s.status,
      createdAt: s.createdAt,
      classes: s.classStudents.map((cs) => cs.class),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add new student manually OR bulk import
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
    const { students, fullName, email, phone, password } = body;

    const defaultPassword = 'password123';
    const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

    // Case 1: Bulk CSV Import
    if (students && Array.isArray(students)) {
      const imported: any[] = [];
      const failed: any[] = [];

      for (const item of students) {
        const { fullName: fName, email: mEmail, phone: pPhone } = item;

        if (!fName || !mEmail) {
          failed.push({ email: mEmail || 'N/A', error: 'Missing name or email' });
          continue;
        }

        const emailNormalized = mEmail.toLowerCase().trim();

        // Check if student exists in this school
        const existing = await prisma.user.findFirst({
          where: {
            email: emailNormalized,
            schoolId: school.id,
          },
        });

        if (existing) {
          failed.push({ email: emailNormalized, error: 'Email already registered in school' });
          continue;
        }

        try {
          const user = await prisma.user.create({
            data: {
              schoolId: school.id,
              fullName: fName.trim(),
              email: emailNormalized,
              phone: pPhone ? String(pPhone).trim() : null,
              passwordHash: defaultPasswordHash,
              role: Role.STUDENT,
              status: UserStatus.ACTIVE,
            },
          });
          imported.push(user);
        } catch (err: any) {
          failed.push({ email: emailNormalized, error: err.message || 'Database insert failed' });
        }
      }

      // Log audit
      await prisma.auditLog.create({
        data: {
          schoolId: school.id,
          userId: session.user.id,
          action: 'BULK_STUDENT_IMPORT',
          details: `Imported ${imported.length} students, failed ${failed.length}`,
        },
      });

      return NextResponse.json({
        message: `Import complete. ${imported.length} successfully registered, ${failed.length} failed.`,
        importedCount: imported.length,
        failedCount: failed.length,
        errors: failed,
      });
    }

    // Case 2: Manual Student Creation
    if (!fullName || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const emailNormalized = email.toLowerCase().trim();

    // Check duplicate
    const existing = await prisma.user.findUnique({
      where: {
        email_school_idx: {
          email: emailNormalized,
          schoolId: school.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email already registered in this school' }, { status: 400 });
    }

    const customPassHash = password ? await bcrypt.hash(password, 10) : defaultPasswordHash;

    const newStudent = await prisma.user.create({
      data: {
        schoolId: school.id,
        fullName: fullName.trim(),
        email: emailNormalized,
        phone: phone ? phone.trim() : null,
        passwordHash: customPassHash,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: session.user.id,
        action: 'STUDENT_CREATE',
        details: `Registered student ${newStudent.fullName} (${newStudent.email})`,
      },
    });

    return NextResponse.json({
      message: 'Student added successfully',
      student: {
        id: newStudent.id,
        fullName: newStudent.fullName,
        email: newStudent.email,
        phone: newStudent.phone,
        status: newStudent.status,
      },
    });
  } catch (error) {
    console.error('Error adding students:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update student status or details
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
    const { studentId, status, fullName, phone, email } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Verify student belongs to this school
    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        schoolId: school.id,
        role: Role.STUDENT,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    // Prepare update payload
    const updateData: any = {};
    if (status) {
      if (status !== UserStatus.ACTIVE && status !== UserStatus.SUSPENDED) {
        return NextResponse.json({ error: 'Invalid user status' }, { status: 400 });
      }
      updateData.status = status;
    }

    if (fullName) updateData.fullName = fullName.trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (email) {
      const emailNormalized = email.toLowerCase().trim();
      if (emailNormalized !== student.email) {
        // Check duplicate
        const duplicate = await prisma.user.findFirst({
          where: {
            email: emailNormalized,
            schoolId: school.id,
          },
        });
        if (duplicate) {
          return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }
        updateData.email = emailNormalized;
      }
    }

    const updated = await prisma.user.update({
      where: { id: studentId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: session.user.id,
        action: 'STUDENT_UPDATE',
        details: `Updated student ${student.email}: ${JSON.stringify(updateData)}`,
      },
    });

    return NextResponse.json({
      message: 'Student updated successfully',
      student: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
