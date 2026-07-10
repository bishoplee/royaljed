import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, role, schoolSlug, registerNewSchool, schoolName } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required.' },
        { status: 400 }
      );
    }

    const emailNormalized = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 10);

    if (registerNewSchool) {
      if (!schoolName || !schoolSlug) {
        return NextResponse.json(
          { error: 'School name and school slug are required for new registrations.' },
          { status: 400 }
        );
      }

      const slugNormalized = schoolSlug.toLowerCase().trim();

      // Check if school slug exists
      const existingSchool = await prisma.school.findUnique({
        where: { slug: slugNormalized },
      });

      if (existingSchool) {
        return NextResponse.json(
          { error: 'School slug is already taken. Please choose another.' },
          { status: 400 }
        );
      }

      // Create school, config, and admin user
      const result = await prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: {
            name: schoolName.trim(),
            slug: slugNormalized,
            brandColor: '#001E2B',
          },
        });

        await tx.schoolConfig.create({
          data: {
            schoolId: school.id,
            gclassSyncEnabled: false,
            autoSyncIntervalHours: 24,
            allowStudentLeaderboard: true,
          },
        });

        const user = await tx.user.create({
          data: {
            fullName: fullName.trim(),
            email: emailNormalized,
            passwordHash,
            role: Role.ADMIN,
            schoolId: school.id,
          },
        });

        return { user, school };
      });

      return NextResponse.json(
        {
          message: 'School and Admin user registered successfully.',
          user: {
            id: result.user.id,
            email: result.user.email,
            fullName: result.user.fullName,
            role: result.user.role,
            schoolId: result.school.id,
            schoolSlug: result.school.slug,
          },
        },
        { status: 201 }
      );
    } else {
      // Registering as a Student
      if (!schoolSlug) {
        return NextResponse.json(
          { error: 'School Slug is required to join as a student.' },
          { status: 400 }
        );
      }

      const slugNormalized = schoolSlug.toLowerCase().trim();

      const school = await prisma.school.findUnique({
        where: { slug: slugNormalized },
      });

      if (!school) {
        return NextResponse.json(
          { error: 'School tenant space not found. Check the slug.' },
          { status: 404 }
        );
      }

      // Check if user already exists in that school
      const existingUser = await prisma.user.findUnique({
        where: {
          email_school_idx: {
            email: emailNormalized,
            schoolId: school.id,
          },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email is already registered under this school.' },
          { status: 400 }
        );
      }

      const user = await prisma.user.create({
        data: {
          fullName: fullName.trim(),
          email: emailNormalized,
          passwordHash,
          role: role === 'TUTOR' ? Role.TUTOR : Role.STUDENT,
          schoolId: school.id,
        },
      });

      return NextResponse.json(
        {
          message: 'Account registered successfully.',
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            schoolId: school.id,
            schoolSlug: school.slug,
          },
        },
        { status: 201 }
      );
    }
  } catch (error: any) {
    console.error('Error during signup:', error);
    return NextResponse.json(
      { error: 'Something went wrong during registration.' },
      { status: 500 }
    );
  }
}
