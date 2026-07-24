import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      pricingPlan = 'trial',
      subscriptionStatus = 'active',
      trialDays,
      brandColor = '#001E2B',
      createAdminAccount = false,
      adminFullName,
      adminEmail,
      adminPassword,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'School name is required.' }, { status: 400 });
    }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json({ error: 'School slug is required.' }, { status: 400 });
    }

    const slugNormalized = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

    if (!slugNormalized) {
      return NextResponse.json({ error: 'Invalid school slug format.' }, { status: 400 });
    }

    // Check if slug is already taken
    const existingSchool = await prisma.school.findUnique({
      where: { slug: slugNormalized },
    });

    if (existingSchool) {
      return NextResponse.json({ error: 'A school with this slug already exists.' }, { status: 400 });
    }

    // Calculate trial ends at date
    let trialEndsAt: Date | null = null;
    if (trialDays && !isNaN(Number(trialDays)) && Number(trialDays) > 0) {
      trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + Number(trialDays));
    }

    // Validate admin account if requested
    let passwordHash: string | null = null;
    let normalizedAdminEmail: string | null = null;

    if (createAdminAccount) {
      if (!adminFullName || !adminFullName.trim()) {
        return NextResponse.json({ error: 'Admin full name is required.' }, { status: 400 });
      }
      if (!adminEmail || !adminEmail.trim()) {
        return NextResponse.json({ error: 'Admin email is required.' }, { status: 400 });
      }
      if (!adminPassword || adminPassword.length < 6) {
        return NextResponse.json({ error: 'Admin password must be at least 6 characters.' }, { status: 400 });
      }

      normalizedAdminEmail = adminEmail.toLowerCase().trim();
      passwordHash = await bcrypt.hash(adminPassword, 10);
    }

    // Database transaction to create school, config, and optional admin user
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: name.trim(),
          slug: slugNormalized,
          brandColor: brandColor || '#001E2B',
          pricingPlan: pricingPlan || 'trial',
          subscriptionStatus: subscriptionStatus || 'active',
          trialEndsAt: trialEndsAt,
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

      let adminUser = null;
      if (createAdminAccount && normalizedAdminEmail && passwordHash && adminFullName) {
        adminUser = await tx.user.create({
          data: {
            fullName: adminFullName.trim(),
            email: normalizedAdminEmail,
            passwordHash: passwordHash,
            role: Role.ADMIN,
            schoolId: school.id,
          },
        });
      }

      // Try creating audit log if table exists
      try {
        await tx.auditLog.create({
          data: {
            schoolId: school.id,
            userId: session.user.id,
            action: 'CREATE_SCHOOL',
            details: `Super Admin created school ${school.name} (${school.slug})`,
          },
        });
      } catch {
        // Table might not exist yet if migration pending
      }

      return { school, adminUser };
    });

    return NextResponse.json(
      {
        message: 'School created successfully.',
        school: result.school,
        adminUser: result.adminUser
          ? {
              id: result.adminUser.id,
              fullName: result.adminUser.fullName,
              email: result.adminUser.email,
              role: result.adminUser.role,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating school:', error);
    return NextResponse.json({ error: 'Failed to create school.' }, { status: 500 });
  }
}
