import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// GET: List all tutors for this school
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

    const tutors = await prisma.user.findMany({
      where: {
        schoolId: school.id,
        role: Role.TUTOR,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        classTutors: {
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

    // Format structure
    const formatted = tutors.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      email: t.email,
      phone: t.phone,
      status: t.status,
      createdAt: t.createdAt,
      classes: t.classTutors.map((ct) => ct.class),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching tutors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add new tutor manually
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
    const { fullName, email, phone, password, classIds } = body;

    const normalizedClassIds = Array.isArray(classIds)
      ? Array.from(new Set(classIds.map((id: string) => String(id).trim()).filter(Boolean)))
      : [];

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

    const defaultPassword = 'password123';
    const passwordHash = await bcrypt.hash(password || defaultPassword, 10);

    const validClasses = normalizedClassIds.length
      ? await prisma.class.findMany({
          where: {
            id: { in: normalizedClassIds },
            schoolId: school.id,
          },
          select: { id: true },
        })
      : [];

    const validClassIds = validClasses.map((c) => c.id);

    if (normalizedClassIds.length > 0 && validClassIds.length !== normalizedClassIds.length) {
      return NextResponse.json(
        { error: 'One or more selected classes are invalid for this school' },
        { status: 400 }
      );
    }

    const newTutor = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          schoolId: school.id,
          fullName: fullName.trim(),
          email: emailNormalized,
          phone: phone ? phone.trim() : null,
          passwordHash,
          role: Role.TUTOR,
          status: UserStatus.ACTIVE,
        },
      });

      if (validClassIds.length > 0) {
        await tx.classTutor.createMany({
          data: validClassIds.map((classId) => ({
            classId,
            tutorId: createdUser.id,
          })),
        });
      }

      return createdUser;
    });

    await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: session.user.id,
        action: 'TUTOR_CREATE',
        details: `Registered tutor ${newTutor.fullName} (${newTutor.email})`,
      },
    });

    return NextResponse.json({
      message: 'Tutor added successfully',
      tutor: {
        id: newTutor.id,
        fullName: newTutor.fullName,
        email: newTutor.email,
        phone: newTutor.phone,
        status: newTutor.status,
      },
    });
  } catch (error) {
    console.error('Error adding tutor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update tutor status or details
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
    const { tutorId, status, fullName, phone, email, classIds } = body;

    const normalizedClassIds = Array.isArray(classIds)
      ? Array.from(new Set(classIds.map((id: string) => String(id).trim()).filter(Boolean)))
      : null;

    if (!tutorId) {
      return NextResponse.json({ error: 'Tutor ID is required' }, { status: 400 });
    }

    // Verify tutor belongs to this school
    const tutor = await prisma.user.findFirst({
      where: {
        id: tutorId,
        schoolId: school.id,
        role: Role.TUTOR,
      },
    });

    if (!tutor) {
      return NextResponse.json({ error: 'Tutor profile not found' }, { status: 404 });
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
      if (emailNormalized !== tutor.email) {
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

    const validUpdateClassIds = normalizedClassIds
      ? normalizedClassIds.length
        ? (
            await prisma.class.findMany({
              where: {
                id: { in: normalizedClassIds },
                schoolId: school.id,
              },
              select: { id: true },
            })
          ).map((c) => c.id)
        : []
      : null;

    if (
      normalizedClassIds &&
      normalizedClassIds.length > 0 &&
      validUpdateClassIds &&
      validUpdateClassIds.length !== normalizedClassIds.length
    ) {
      return NextResponse.json(
        { error: 'One or more selected classes are invalid for this school' },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTutor = await tx.user.update({
        where: { id: tutorId },
        data: updateData,
      });

      if (validUpdateClassIds) {
        await tx.classTutor.deleteMany({
          where: { tutorId },
        });

        if (validUpdateClassIds.length > 0) {
          await tx.classTutor.createMany({
            data: validUpdateClassIds.map((classId) => ({
              classId,
              tutorId,
            })),
          });
        }
      }

      return updatedTutor;
    });

    await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        userId: session.user.id,
        action: 'TUTOR_UPDATE',
        details: `Updated tutor ${tutor.email}: ${JSON.stringify(updateData)}`,
      },
    });

    return NextResponse.json({
      message: 'Tutor updated successfully',
      tutor: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error('Error updating tutor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
