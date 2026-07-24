'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useMemo, useState } from 'react';

type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'GRADED';

interface TutorSubmissionSummary {
  id: string;
  status: SubmissionStatus;
  attemptNumber: number;
  submittedAt: string;
  student: {
    id: string;
    fullName: string;
    email: string;
  };
  assignment: {
    id: string;
    title: string;
    submissionType: 'TEXT' | 'AUDIO' | 'VIDEO';
    dueDate: string;
    classNames: string[];
    classIds: string[];
  };
  grade: {
    id: string;
    percentage: number;
    gradedAt: string;
  } | null;
}

interface TutorDashboardClientProps {
  schoolSlug: string;
  schoolName: string;
  initialSubmissions: TutorSubmissionSummary[];
}

const STATUS_OPTIONS: Array<{ label: string; value: 'ALL' | SubmissionStatus }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'SUBMITTED' },
  { label: 'Graded', value: 'GRADED' },
  { label: 'Draft', value: 'DRAFT' },
];

export default function TutorDashboardClient({
  schoolSlug,
  schoolName,
  initialSubmissions,
}: TutorDashboardClientProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubmissionStatus>('SUBMITTED');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('ALL');

  const classOptions = useMemo(() => {
    const classes = new Map<string, string>();

    for (const submission of initialSubmissions) {
      submission.assignment.classIds.forEach((classId, index) => {
        const className = submission.assignment.classNames[index];
        if (className) {
          classes.set(classId, className);
        }
      });
    }

    return Array.from(classes.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initialSubmissions]);

  const assignmentOptions = useMemo(() => {
    const assignments = new Map<string, string>();

    for (const submission of initialSubmissions) {
      assignments.set(submission.assignment.id, submission.assignment.title);
    }

    return Array.from(assignments.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [initialSubmissions]);

  const filteredSubmissions = useMemo(() => {
    return initialSubmissions.filter((submission) => {
      if (statusFilter !== 'ALL' && submission.status !== statusFilter) {
        return false;
      }

      if (assignmentFilter !== 'ALL' && submission.assignment.id !== assignmentFilter) {
        return false;
      }

      if (
        classFilter !== 'ALL' &&
        !submission.assignment.classIds.some((classId) => classId === classFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [assignmentFilter, classFilter, initialSubmissions, statusFilter]);

  const pendingCount = initialSubmissions.filter((submission) => submission.status === 'SUBMITTED').length;
  const gradedCount = initialSubmissions.filter((submission) => submission.status === 'GRADED').length;

  return (
    <div className="min-h-screen bg-[#f3f4f6] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{schoolName}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Tutor Assessment Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Review submissions, score rubric criteria, and publish timestamped pronunciation feedback.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/ec/${schoolSlug}/tutor/assignments`}
                className="rounded-full bg-brandTealDeep px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brandTealDeep/90 shadow-sm flex items-center gap-2"
              >
                <span>+</span> Assign Lessons & Tasks
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="rounded-full bg-brandGreen px-5 py-2.5 text-sm font-semibold text-brandTealDeep transition hover:bg-brandGreen/90"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending review</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingCount}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Graded</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{gradedCount}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tenant</p>
              <p className="mt-2 text-lg font-semibold text-brandTealDeep">{schoolSlug}</p>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'ALL' | SubmissionStatus)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-700"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Class</span>
              <select
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-700"
              >
                <option value="ALL">All classes</option>
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Assignment</span>
              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-700"
              >
                <option value="ALL">All assignments</option>
                {assignmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {filteredSubmissions.map((submission) => {
              const statusTone =
                submission.status === 'GRADED'
                  ? 'bg-brandGreenSoft text-brandTealDeep'
                  : submission.status === 'SUBMITTED'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600';

              return (
                <article
                  key={submission.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {submission.assignment.submissionType} submission
                      </p>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                        {submission.assignment.title}
                      </h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${statusTone}`}>
                      {submission.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    Student: <span className="font-medium text-slate-900">{submission.student.fullName}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">Attempt #{submission.attemptNumber}</p>
                  <p className="mt-1 text-sm text-slate-600">Submitted: {new Date(submission.submittedAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Classes: {submission.assignment.classNames.length > 0 ? submission.assignment.classNames.join(', ') : 'All classes'}
                  </p>

                  {submission.grade ? (
                    <p className="mt-2 text-sm text-brandTealDeep">
                      Graded: {submission.grade.percentage.toFixed(2)}% on {new Date(submission.grade.gradedAt).toLocaleString()}
                    </p>
                  ) : null}

                  <div className="mt-4">
                    <Link
                      href={`/ec/${schoolSlug}/tutor/submissions/${submission.id}`}
                      className="inline-flex rounded-full bg-brandGreen px-4 py-2.5 text-sm font-semibold text-brandTealDeep transition hover:bg-brandGreen/90"
                    >
                      {submission.status === 'GRADED' ? 'Review grade' : 'Start grading'}
                    </Link>
                  </div>
                </article>
              );
            })}

            {filteredSubmissions.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-600">
                No submissions match the selected filters.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
