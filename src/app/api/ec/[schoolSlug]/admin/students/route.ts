import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role, UserStatus, ClassCategory, Sex } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit';

function parseSex(val: any): Sex | null {
  if (!val || typeof val !== 'string') return null;
  const upper = val.toUpperCase().trim();
  if (upper === 'MALE' || upper === 'M') return Sex.MALE;
  if (upper === 'FEMALE' || upper === 'F') return Sex.FEMALE;
  if (upper === 'OTHER' || upper === 'O') return Sex.OTHER;
  return null;
}

function parseDob(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

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
        dateOfBirth: true,
        sex: true,
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
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.toISOString().split('T')[0] : null,
      sex: s.sex || null,
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
    const { students, fullName, email, phone, password, classId, classIds, createMissingClasses } = body;

    const normalizedClassIds = Array.isArray(classIds)
      ? Array.from(new Set(classIds.map((id: string) => String(id).trim()).filter(Boolean)))
      : typeof classId === 'string' && classId.trim()
        ? [classId.trim()]
        : [];

    if (normalizedClassIds.length > 1) {
      return NextResponse.json(
        { error: 'A student can only be assigned to one class at a time' },
        { status: 400 }
      );
    }

    const defaultPassword = 'password123';
    const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

    // Case 1: Bulk CSV Import
    if (students && Array.isArray(students)) {
      const imported: any[] = [];
      const failed: any[] = [];
      let newClassesCreatedCount = 0;

      // Class map for looking up or creating classes by name
      const schoolClasses = await prisma.class.findMany({
        where: { schoolId: school.id },
        select: { id: true, name: true },
      });

      const classNameToIdMap = new Map<string, string>(
        schoolClasses.map((c) => [c.name.toLowerCase().trim(), c.id])
      );

      // Auto-create missing classes if requested
      if (createMissingClasses) {
        for (const item of students) {
          if (item.className && typeof item.className === 'string' && item.className.trim()) {
            const rawName = item.className.trim();
            const lowerName = rawName.toLowerCase();

            if (!classNameToIdMap.has(lowerName)) {
              const createdClass = await prisma.class.create({
                data: {
                  schoolId: school.id,
                  name: rawName,
                  category: ClassCategory.OTHER,
                },
              });
              classNameToIdMap.set(lowerName, createdClass.id);
              newClassesCreatedCount++;
            }
            item.classId = classNameToIdMap.get(lowerName);
          }
        }
      } else {
        // If not creating missing classes, map className to classId if it exists in DB
        for (const item of students) {
          if (!item.classId && item.className && typeof item.className === 'string') {
            const lowerName = item.className.trim().toLowerCase();
            if (classNameToIdMap.has(lowerName)) {
              item.classId = classNameToIdMap.get(lowerName);
            }
          }
        }
      }

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

      const seenBatchEmails = new Set<string>();

      for (const item of students) {
        const {
          fullName: fName,
          email: mEmail,
          phone: pPhone,
          classId: itemClassId,
          dateOfBirth: itemDob,
          dob: itemDob2,
          sex: itemSex,
          gender: itemGender,
        } = item;

        if (!fName || !mEmail) {
          failed.push({ email: mEmail || 'N/A', error: 'Missing name or email' });
          continue;
        }

        const emailNormalized = mEmail.toLowerCase().trim();

        if (seenBatchEmails.has(emailNormalized)) {
          failed.push({ email: emailNormalized, error: 'Duplicate entry within submission payload' });
          continue;
        }
        seenBatchEmails.add(emailNormalized);

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
          const user = await prisma.$transaction(async (tx) => {
            const normalizedItemClassId =
              typeof itemClassId === 'string' && itemClassId.trim() ? itemClassId.trim() : null;

            const assignmentClassIds = normalizedItemClassId
              ? [normalizedItemClassId]
              : validClassIds;

            if (assignmentClassIds.length > 1) {
              throw new Error('A student can only be assigned to one class at a time');
            }

            if (assignmentClassIds.length === 1) {
              const classExists = await tx.class.findFirst({
                where: {
                  id: assignmentClassIds[0],
                  schoolId: school.id,
                },
                select: { id: true },
              });

              if (!classExists) {
                throw new Error('One or more selected classes are invalid for this school');
              }
            }

            const createdUser = await tx.user.create({
              data: {
                schoolId: school.id,
                fullName: fName.trim(),
                email: emailNormalized,
                phone: pPhone ? String(pPhone).trim() : null,
                dateOfBirth: parseDob(itemDob || itemDob2),
                sex: parseSex(itemSex || itemGender),
                passwordHash: defaultPasswordHash,
                role: Role.STUDENT,
                status: UserStatus.ACTIVE,
              },
            });

            if (assignmentClassIds.length > 0) {
              await tx.classStudent.createMany({
                data: assignmentClassIds.map((classId) => ({
                  classId,
                  studentId: createdUser.id,
                })),
              });
            }

            return createdUser;
          });
          imported.push(user);
        } catch (err: any) {
          failed.push({ email: emailNormalized, error: err.message || 'Database insert failed' });
        }
      }

      // Log audit
      await logAudit({
        schoolId: school.id,
        userId: session.user.id,
        action: 'BULK_STUDENT_IMPORT',
        details: `Imported ${imported.length} students (${newClassesCreatedCount} new classes created), failed ${failed.length}`,
      });

      const classMsg = newClassesCreatedCount > 0 ? ` (${newClassesCreatedCount} new ${newClassesCreatedCount === 1 ? 'class' : 'classes'} created)` : '';
      return NextResponse.json({
        message: `Import complete. ${imported.length} students registered successfully${classMsg}. ${failed.length} failed.`,
        importedCount: imported.length,
        failedCount: failed.length,
        createdClassesCount: newClassesCreatedCount,
        failed,
      });
    }

    // Case 2: Manual Student Creation
    const { dateOfBirth, sex } = body;
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

    const newStudent = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          schoolId: school.id,
          fullName: fullName.trim(),
          email: emailNormalized,
          phone: phone ? phone.trim() : null,
          dateOfBirth: parseDob(dateOfBirth),
          sex: parseSex(sex),
          passwordHash: customPassHash,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
      });

      if (validClassIds.length > 0) {
        await tx.classStudent.createMany({
          data: validClassIds.map((classId) => ({
            classId,
            studentId: createdUser.id,
          })),
        });
      }

      return createdUser;
    });

    await logAudit({
      schoolId: school.id,
      userId: session.user.id,
      action: 'STUDENT_CREATE',
      details: `Registered student ${newStudent.fullName} (${newStudent.email})`,
    });

    return NextResponse.json({
      message: 'Student added successfully',
      student: {
        id: newStudent.id,
        fullName: newStudent.fullName,
        email: newStudent.email,
        phone: newStudent.phone,
        dateOfBirth: newStudent.dateOfBirth ? newStudent.dateOfBirth.toISOString().split('T')[0] : null,
        sex: newStudent.sex,
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
    const { studentId, status, fullName, phone, email, password, classId, classIds, dateOfBirth, sex } = body;

    const classIdsProvided =
      Object.prototype.hasOwnProperty.call(body, 'classId') ||
      Object.prototype.hasOwnProperty.call(body, 'classIds');

    const normalizedClassIds = classIdsProvided
      ? Array.isArray(classIds)
        ? Array.from(new Set(classIds.map((id: string) => String(id).trim()).filter(Boolean)))
        : typeof classId === 'string' && classId.trim()
          ? [classId.trim()]
          : []
      : null;

    if (normalizedClassIds && normalizedClassIds.length > 1) {
      return NextResponse.json(
        { error: 'A student can only be assigned to one class at a time' },
        { status: 400 }
      );
    }

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

    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (fullName) updateData.fullName = fullName.trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = parseDob(dateOfBirth);
    if (sex !== undefined) updateData.sex = parseSex(sex);
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
      const updatedStudent = await tx.user.update({
        where: { id: studentId },
        data: updateData,
      });

      if (validUpdateClassIds) {
        await tx.classStudent.deleteMany({
          where: { studentId },
        });

        if (validUpdateClassIds.length > 0) {
          await tx.classStudent.createMany({
            data: validUpdateClassIds.map((classId) => ({
              classId,
              studentId,
            })),
          });
        }
      }

      return updatedStudent;
    });

    await logAudit({
      schoolId: school.id,
      userId: session.user.id,
      action: 'STUDENT_UPDATE',
      details: `Updated student ${student.email}: ${JSON.stringify(updateData)}`,
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

// DELETE: Permanently remove a student account from school
export async function DELETE(
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

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID parameter is required' }, { status: 400 });
    }

    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        schoolId: school.id,
        role: Role.STUDENT,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    await prisma.user.delete({
      where: { id: studentId },
    });

    await logAudit({
      schoolId: school.id,
      userId: session.user.id,
      action: 'STUDENT_DELETE',
      details: `Deleted student ${student.fullName} (${student.email})`,
    });

    return NextResponse.json({ message: 'Student removed successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: 'Failed to remove student' }, { status: 500 });
  }
}
