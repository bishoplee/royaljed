import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AssignmentSubmissionClient from '@/components/student/AssignmentSubmissionClient';

interface AssignmentDetailPageProps {
  params: Promise<{
    schoolSlug: string;
    assignmentId: string;
  }>;
}

export default async function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
  const { schoolSlug, assignmentId } = await params;
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
    notFound();
  }

  const studentId = session.user.id as string;
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
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
  });

  if (!assignment) {
    notFound();
  }

  const attemptsUsed = assignment.submissions.length;
  const remainingAttempts = Math.max(assignment.maxAttempts - attemptsUsed, 0);
  const canSubmit = remainingAttempts > 0 && assignment.dueDate >= new Date();
  const rubricItems = Array.isArray(assignment.rubricJson) ? assignment.rubricJson as Array<{ name?: string; percentage?: number; description?: string }> : [];

  return (
    <div className="min-h-screen bg-[#f3f4f6] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{assignment.module.title}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{assignment.title}</h1>
            <p className="mt-3 text-sm text-slate-600">{assignment.description || assignment.instructions || 'No instructions provided.'}</p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Type: {assignment.submissionType}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Due: {assignment.dueDate.toLocaleString()}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Attempts: {attemptsUsed}/{assignment.maxAttempts}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5">Classes: {assignment.classes.map((entry) => entry.class.name).join(', ')}</span>
            </div>
          </header>

          <AssignmentSubmissionClient
            schoolSlug={slug}
            assignmentId={assignment.id}
            assignmentTitle={assignment.title}
            submissionType={assignment.submissionType}
            attemptsUsed={attemptsUsed}
            maxAttempts={assignment.maxAttempts}
            remainingAttempts={remainingAttempts}
            canSubmit={canSubmit}
          />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Previous submissions</h2>
            <div className="mt-4 space-y-3">
              {assignment.submissions.map((submission) => (
                <article key={submission.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-slate-900">Attempt #{submission.attemptNumber}</strong>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {submission.status}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-600">Submitted at {submission.submittedAt.toLocaleString()}</p>
                  {submission.textContent ? <p className="mt-3 whitespace-pre-wrap text-slate-700">{submission.textContent}</p> : null}
                  {submission.originalFileName ? <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">File: {submission.originalFileName}</p> : null}
                </article>
              ))}
              {assignment.submissions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No submissions yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Rubric</h2>
            <div className="mt-4 space-y-3">
              {rubricItems.map((item, index) => (
                <div key={`${item.name || 'criteria'}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-slate-900">{item.name || `Criteria ${index + 1}`}</strong>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {item.percentage ?? 0}%
                    </span>
                  </div>
                  {item.description ? <p className="mt-2 text-slate-600">{item.description}</p> : null}
                </div>
              ))}
              {rubricItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Rubric will appear here once configured.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Assignment details</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <dt>Lesson</dt>
                <dd className="font-medium text-slate-900">{assignment.lesson?.title || 'No lesson link'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <dt>Visible to</dt>
                <dd className="font-medium text-slate-900">{assignment.classes.map((entry) => entry.class.name).join(', ')}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <dt>Max duration</dt>
                <dd className="font-medium text-slate-900">{assignment.maxDurationSeconds} sec</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <dt>Remaining attempts</dt>
                <dd className="font-medium text-slate-900">{remainingAttempts}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
