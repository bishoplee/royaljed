import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Verify role
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify school slug match unless SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    // Find school
    const school = await prisma.school.findUnique({
      where: { slug },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      brandColor,
      logoUrl,
      address,
      phone,
      contactEmail,
      website,
      allowStudentLeaderboard,
      gclassSyncEnabled,
    } = body;

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'School name is required' }, { status: 400 });
    }

    if (brandColor && !/^#[0-9A-F]{6}$/i.test(brandColor)) {
      return NextResponse.json({ error: 'Invalid hex color format' }, { status: 400 });
    }

    // Perform database updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update school details
      const updatedSchool = await tx.school.update({
        where: { id: school.id },
        data: {
          name: name.trim(),
          brandColor: brandColor || '#001E2B',
          logoUrl: logoUrl ? logoUrl.trim() : null,
          address: address ? address.trim() : null,
          phone: phone ? phone.trim() : null,
          contactEmail: contactEmail ? contactEmail.trim() : null,
          website: website ? website.trim() : null,
        },
      });

      // 2. Update config or create if not exists
      const updatedConfig = await tx.schoolConfig.upsert({
        where: { schoolId: school.id },
        update: {
          allowStudentLeaderboard: allowStudentLeaderboard !== undefined ? allowStudentLeaderboard : true,
          gclassSyncEnabled: gclassSyncEnabled !== undefined ? gclassSyncEnabled : false,
        },
        create: {
          schoolId: school.id,
          allowStudentLeaderboard: allowStudentLeaderboard !== undefined ? allowStudentLeaderboard : true,
          gclassSyncEnabled: gclassSyncEnabled !== undefined ? gclassSyncEnabled : false,
        },
      });

      // 3. Log the audit event
      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          userId: session.user.id,
          action: 'SCHOOL_SETTINGS_UPDATE',
          details: `Updated school settings: name=${name}, color=${brandColor}`,
        },
      });

      return { school: updatedSchool, config: updatedConfig };
    });

    return NextResponse.json({
      message: 'Settings updated successfully',
      school: result.school,
      config: result.config,
    });
  } catch (error) {
    console.error('Error updating school settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
