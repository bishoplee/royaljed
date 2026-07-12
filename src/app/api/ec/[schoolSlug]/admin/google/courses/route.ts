import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchGoogleClassroomCourses } from '@/lib/googleClassroom';
import { isTenantMatch } from '@/lib/tutorAccess';

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
      return NextResponse.json({ connected: false, courses: [] });
    }

    try {
      const courses = await fetchGoogleClassroomCourses(config.googleRefreshToken);
      return NextResponse.json({
        connected: true,
        courses: courses.map((c) => ({
          id: c.id,
          name: c.name,
          section: c.section,
        })),
      });
    } catch (apiError) {
      console.error('Failed to retrieve Google Classroom courses:', apiError);
      return NextResponse.json(
        { error: 'Failed to retrieve courses from Google Classroom. Please reconnect.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Error fetching admin Google Classroom courses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
