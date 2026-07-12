import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TutorDashboardClient from './TutorDashboardClient';

interface TutorDashboardPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function TutorDashboardPage({ params }: TutorDashboardPageProps) {
  const { schoolSlug } = await params;
  const slug = schoolSlug.toLowerCase().trim();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'TUTOR' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/ec/${session.user.schoolSlug}/student/dashboard`);
  }

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/tutor/dashboard`);
  }

  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) {
    notFound();
  }

  const tutorVisibilityFilter =
    session.user.role === 'SUPER_ADMIN'
      ? {}
      : {
          OR: [
            { classes: { none: {} } },
            {
              classes: {
                some: {
                  class: {
                    tutors: {
                      some: {
                        tutorId: session.user.id,
                      },
                    },
                  },
                },
              },
            },
          ],
        };

  const submissions = await prisma.submission.findMany({
    where: {
      assignment: {
        schoolId: school.id,
        ...tutorVisibilityFilter,
      },
      status: {
        in: ['SUBMITTED', 'GRADED'],
      },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          submissionType: true,
          dueDate: true,
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      grade: {
        select: {
          id: true,
          percentage: true,
          gradedAt: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
    take: 200,
  });

  return (
    <TutorDashboardClient
      schoolSlug={slug}
      schoolName={school.name}
      initialSubmissions={submissions.map((submission) => ({
        id: submission.id,
        status: submission.status,
        attemptNumber: submission.attemptNumber,
        submittedAt: submission.submittedAt.toISOString(),
        student: {
          id: submission.student.id,
          fullName: submission.student.fullName,
          email: submission.student.email,
        },
        assignment: {
          id: submission.assignment.id,
          title: submission.assignment.title,
          submissionType: submission.assignment.submissionType,
          dueDate: submission.assignment.dueDate.toISOString(),
          classNames: submission.assignment.classes.map((entry) => entry.class.name),
          classIds: submission.assignment.classes.map((entry) => entry.class.id),
        },
        grade: submission.grade
          ? {
              id: submission.grade.id,
              percentage: Number(submission.grade.percentage),
              gradedAt: submission.grade.gradedAt.toISOString(),
            }
          : null,
      }))}
    />
  );
}
