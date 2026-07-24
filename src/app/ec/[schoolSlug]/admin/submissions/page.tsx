import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminSubmissionsClient from './AdminSubmissionsClient';

interface SubmissionsPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function AdminSubmissionsPage({ params }: SubmissionsPageProps) {
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
    redirect(`/ec/${session.user.schoolSlug}/admin/submissions`);
  }

  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) {
    redirect('/auth/signin');
  }

  const submissions = await prisma.submission.findMany({
    where: {
      assignment: { schoolId: school.id },
    },
    include: {
      student: {
        select: { id: true, fullName: true, email: true },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          submissionType: true,
          dueDate: true,
          classes: {
            include: {
              class: { select: { id: true, name: true } },
            },
          },
        },
      },
      grade: {
        select: {
          id: true,
          percentage: true,
          gradedAt: true,
          tutor: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
    take: 300,
  });

  return (
    <AdminSubmissionsClient
      schoolSlug={slug}
      initialSubmissions={submissions.map((s) => ({
        id: s.id,
        status: s.status,
        attemptNumber: s.attemptNumber,
        submittedAt: s.submittedAt.toISOString(),
        student: s.student,
        assignment: {
          id: s.assignment.id,
          title: s.assignment.title,
          submissionType: s.assignment.submissionType,
          dueDate: s.assignment.dueDate.toISOString(),
          classNames: s.assignment.classes.map((e) => e.class.name),
          classIds: s.assignment.classes.map((e) => e.class.id),
        },
        grade: s.grade
          ? {
              id: s.grade.id,
              percentage: Number(s.grade.percentage),
              gradedAt: s.grade.gradedAt.toISOString(),
              tutorName: s.grade.tutor?.fullName ?? null,
            }
          : null,
      }))}
    />
  );
}
