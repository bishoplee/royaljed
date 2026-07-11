import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface StudentAssignmentsPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function StudentAssignmentsPage({ params }: StudentAssignmentsPageProps) {
  const { schoolSlug } = await params;
  const slug = schoolSlug.toLowerCase().trim();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/student/dashboard`);
  }

  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) {
    redirect('/auth/signin');
  }

  const studentId = session.user.id as string;
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

  const assignments = await prisma.assignment.findMany({
    where: {
      schoolId: school.id,
      active: true,
      ...(isSuperAdmin
        ? {}
        : {
            classes: {
              some: {
                class: {
                  students: {
                    some: {
                      studentId,
                    },
                  },
                },
              },
            },
          }),
    },
    include: {
      module: true,
      lesson: true,
      classes: {
        include: {
          class: true,
        },
      },
      submissions: {
        where: { studentId },
        orderBy: { attemptNumber: 'desc' },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  const now = new Date();

  return (
    <div className="min-h-screen bg-[#f3f4f6] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{school.name}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Assignments</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            View assignments assigned to your classes, track attempts, and open each task to submit audio, video, or text work.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assignments.map((assignment) => {
            const attemptsUsed = assignment.submissions.length;
            const remainingAttempts = Math.max(assignment.maxAttempts - attemptsUsed, 0);
            const isPastDue = assignment.dueDate < now;
            const latestSubmission = assignment.submissions[0] ?? null;

            return (
              <article key={assignment.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{assignment.submissionType}</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{assignment.title}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPastDue ? 'bg-red-100 text-red-700' : remainingAttempts > 0 ? 'bg-brandGreenSoft text-brandTealDeep' : 'bg-slate-100 text-slate-600'}`}>
                    {isPastDue ? 'Past due' : remainingAttempts > 0 ? `${remainingAttempts} left` : 'Locked'}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm text-slate-600">{assignment.description || assignment.instructions || 'No instructions provided.'}</p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Module</dt>
                    <dd className="mt-1 font-medium text-slate-900">{assignment.module.title}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Due</dt>
                    <dd className="mt-1 font-medium text-slate-900">{assignment.dueDate.toLocaleDateString()}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Attempts</dt>
                    <dd className="mt-1 font-medium text-slate-900">{attemptsUsed}/{assignment.maxAttempts}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Classes</dt>
                    <dd className="mt-1 font-medium text-slate-900">{assignment.classes.length}</dd>
                  </div>
                </dl>

                {latestSubmission ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Latest attempt #{latestSubmission.attemptNumber} · {latestSubmission.status}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-between gap-3">
                  <Link
                    href={`/ec/${slug}/student/assignments/${assignment.id}`}
                    className="rounded-full bg-brandGreen px-4 py-2.5 text-sm font-semibold text-brandTealDeep transition hover:bg-brandGreen/90"
                  >
                    Open assignment
                  </Link>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{assignment.lesson?.title || 'No lesson link'}</span>
                </div>
              </article>
            );
          })}

          {assignments.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-600">
              No active assignments have been assigned to your classes yet.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
