import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncGoogleClassroomRoster } from '@/lib/googleClassroom';
import { isTenantMatch } from '@/lib/tutorAccess';
import { logAudit } from '@/lib/audit';

export async function POST(
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

    const config = await prisma.schoolConfig.findUnique({
      where: { schoolId: school.id },
      select: { googleRefreshToken: true },
    });

    if (!config || !config.googleRefreshToken) {
      return NextResponse.json(
        { error: 'Google Classroom is not connected for this school.' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const classId = body.classId || req.nextUrl.searchParams.get('classId') || undefined;

    const result = await syncGoogleClassroomRoster(school.id, config.googleRefreshToken, classId);

    // Write audit log
    await logAudit({
      schoolId: school.id,
      userId: session.user.id,
      action: 'GOOGLE_CLASSROOM_SYNC',
      details: `Roster sync executed: syncedClasses=${result.syncedClassesCount}, addedStudents=${result.totalStudentsAdded}, totalSynced=${result.totalStudentsSynced}`,
    });

    return NextResponse.json({
      message: 'Roster synchronized successfully.',
      ...result,
    });
  } catch (error) {
    console.error('Error syncing Google Classroom roster:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
