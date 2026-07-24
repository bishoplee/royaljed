'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'GRADED';
type SubmissionType = 'TEXT' | 'AUDIO' | 'VIDEO';

interface Submission {
  id: string;
  status: SubmissionStatus;
  attemptNumber: number;
  submittedAt: string;
  student: { id: string; fullName: string; email: string };
  assignment: {
    id: string;
    title: string;
    submissionType: SubmissionType;
    dueDate: string;
    classNames: string[];
    classIds: string[];
  };
  grade: {
    id: string;
    percentage: number;
    gradedAt: string;
    tutorName: string | null;
  } | null;
}

interface AdminSubmissionsClientProps {
  schoolSlug: string;
  initialSubmissions: Submission[];
}

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Pending Review',
  GRADED: 'Graded',
};

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  DRAFT: 'bg-slate/10 text-slate',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  GRADED: 'bg-brandGreenSoft text-brandGreenDark',
};

const TYPE_STYLES: Record<SubmissionType, string> = {
  TEXT: 'bg-blue-50 text-blue-700',
  AUDIO: 'bg-purple-50 text-purple-700',
  VIDEO: 'bg-orange-50 text-orange-700',
};

function gradeColor(pct: number) {
  if (pct >= 70) return 'text-brandGreenDark font-semibold';
  if (pct >= 50) return 'text-amber-700 font-semibold';
  return 'text-red-600 font-semibold';
}

export default function AdminSubmissionsClient({
  schoolSlug,
  initialSubmissions,
}: AdminSubmissionsClientProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubmissionStatus>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of initialSubmissions) {
      s.assignment.classIds.forEach((id, i) => {
        if (s.assignment.classNames[i]) map.set(id, s.assignment.classNames[i]);
      });
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initialSubmissions]);

  const assignmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of initialSubmissions) map.set(s.assignment.id, s.assignment.title);
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [initialSubmissions]);

  const filtered = useMemo(() => {
    return initialSubmissions.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (classFilter !== 'ALL' && !s.assignment.classIds.includes(classFilter)) return false;
      if (assignmentFilter !== 'ALL' && s.assignment.id !== assignmentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.student.fullName.toLowerCase().includes(q) &&
          !s.student.email.toLowerCase().includes(q) &&
          !s.assignment.title.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [initialSubmissions, statusFilter, classFilter, assignmentFilter, search]);

  const counts = useMemo(
    () => ({
      ALL: initialSubmissions.length,
      SUBMITTED: initialSubmissions.filter((s) => s.status === 'SUBMITTED').length,
      GRADED: initialSubmissions.filter((s) => s.status === 'GRADED').length,
      DRAFT: initialSubmissions.filter((s) => s.status === 'DRAFT').length,
    }),
    [initialSubmissions]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight text-ink">Submissions</h2>
        <p className="text-slate text-sm mt-1">
          School-wide view of all student assignment submissions.
        </p>
      </div>

      {/* Status Tab Filters */}
      <div className="flex flex-wrap gap-2">
        {(['ALL', 'SUBMITTED', 'GRADED', 'DRAFT'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === s
                ? 'bg-brandTealDeep text-white border-brandTealDeep shadow-sm'
                : 'bg-canvas text-slate border-slate/20 hover:border-brandTealDeep/40 hover:text-ink'
            }`}
          >
            {s === 'ALL' ? 'All' : STATUS_LABELS[s]}{' '}
            <span className="ml-1 opacity-70">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Secondary Filters + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search student, email, or assignment…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate/20 rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30 w-64"
        />
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="border border-slate/20 rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
        >
          <option value="ALL">All Classes</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value)}
          className="border border-slate/20 rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30 max-w-[220px]"
        >
          <option value="ALL">All Assignments</option>
          {assignmentOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-canvas border border-slate/10 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate text-sm">
            <div className="text-3xl mb-3">📭</div>
            No submissions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate/10 text-slate uppercase tracking-wider text-[10px] font-bold bg-surface">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Assignment</th>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Attempt</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Grade</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-surface/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink leading-tight">{s.student.fullName}</p>
                      <p className="text-slate/70 text-[10px] mt-0.5">{s.student.email}</p>
                    </td>
                    <td className="px-5 py-3.5 max-w-[180px]">
                      <p className="font-medium text-ink truncate">{s.assignment.title}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {s.assignment.classNames.length > 0 ? (
                        <span className="text-slate">{s.assignment.classNames.join(', ')}</span>
                      ) : (
                        <span className="text-slate/40 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${TYPE_STYLES[s.assignment.submissionType]}`}
                      >
                        {s.assignment.submissionType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate text-center">#{s.attemptNumber}</td>
                    <td className="px-5 py-3.5 text-slate whitespace-nowrap">
                      {new Date(s.submittedAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[s.status]}`}
                      >
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {s.grade ? (
                        <span className={gradeColor(s.grade.percentage)}>
                          {s.grade.percentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate/40 italic text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {s.status === 'SUBMITTED' ? (
                        <Link
                          href={`/ec/${schoolSlug}/tutor/submissions/${s.id}`}
                          className="text-[10px] font-semibold text-brandGreenDark hover:underline whitespace-nowrap"
                        >
                          Review →
                        </Link>
                      ) : s.status === 'GRADED' ? (
                        <Link
                          href={`/ec/${schoolSlug}/tutor/submissions/${s.id}`}
                          className="text-[10px] font-medium text-slate hover:text-ink whitespace-nowrap"
                        >
                          View →
                        </Link>
                      ) : (
                        <span className="text-[10px] text-slate/30">Draft</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate/60 text-right">
        Showing {filtered.length} of {initialSubmissions.length} total submissions.
      </p>
    </div>
  );
}
