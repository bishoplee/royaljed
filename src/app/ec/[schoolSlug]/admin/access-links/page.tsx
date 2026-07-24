import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AccessLinksClient from './AccessLinksClient';

interface AccessLinksPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function AdminAccessLinksPage({ params }: AccessLinksPageProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/');
  }

  const slug = schoolSlug.toLowerCase().trim();

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/admin/access-links`);
  }

  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) {
    redirect('/auth/signin');
  }

  const links = await prisma.accessLink.findMany({
    where: {
      lesson: {
        module: { schoolId: school.id },
      },
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: { id: true, title: true },
          },
        },
      },
      student: {
        select: { id: true, fullName: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <AccessLinksClient
      schoolSlug={slug}
      initialLinks={links.map((l) => ({
        id: l.id,
        token: l.token,
        maxViews: l.maxViews,
        viewCount: l.viewCount,
        expiresAt: l.expiresAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
        lesson: {
          id: l.lesson.id,
          title: l.lesson.title,
          module: l.lesson.module,
        },
        student: l.student
          ? {
              id: l.student.id,
              fullName: l.student.fullName,
              email: l.student.email,
            }
          : null,
      }))}
    />
  );
}
