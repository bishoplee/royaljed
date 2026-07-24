import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      session.user.role !== 'SUPER_ADMIN' &&
      session.user.schoolSlug !== slug
    ) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({ where: { slug } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Fetch all access links for this school (via lesson → module → school)
    const links = await prisma.accessLink.findMany({
      where: {
        lesson: {
          module: {
            schoolId: school.id,
          },
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      links: links.map((link) => ({
        id: link.id,
        token: link.token,
        maxViews: link.maxViews,
        viewCount: link.viewCount,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
        lesson: {
          id: link.lesson.id,
          title: link.lesson.title,
          module: link.lesson.module,
        },
        student: link.student
          ? {
              id: link.student.id,
              fullName: link.student.fullName,
              email: link.student.email,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching access links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
      session.user.role !== 'SUPER_ADMIN' &&
      session.user.schoolSlug !== slug
    ) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({ where: { slug } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    // Verify the link belongs to this school before deleting
    const existing = await prisma.accessLink.findFirst({
      where: {
        id: linkId,
        lesson: {
          module: { schoolId: school.id },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Access link not found' }, { status: 404 });
    }

    await prisma.accessLink.delete({ where: { id: linkId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting access link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
