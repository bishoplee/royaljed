'use client';

import { useState } from 'react';

interface StudentStat {
  id: string;
  fullName: string;
  email: string;
  totalSubmissions: number;
  gradedCount: number;
  pendingCount: number;
  avgGrade: number | null;
  lastActivity: string | null;
}

interface ClassStat {
  id: string;
  name: string;
  category: string;
  studentCount: number;
  classAvg: number | null;
  students: StudentStat[];
}

interface Summary {
  totalStudents: number;
  totalAssignments: number;
  totalSubmissions: number;
  totalGraded: number;
  schoolAvgGrade: number | null;
}

interface AdminProgressClientProps {
  schoolSlug: string;
  summary: Summary;
  classes: ClassStat[];
}

function gradeBar(pct: number) {
  const color =
    pct >= 70 ? 'bg-brandGreen' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function gradeLabel(pct: number | null) {
  if (pct === null) return <span className="text-slate/40 italic text-xs">No data</span>;
  const color = pct >= 70 ? 'text-brandGreenDark' : pct >= 50 ? 'text-amber-700' : 'text-red-600';
  return <span className={`text-sm font-bold ${color}`}>{pct.toFixed(1)}%</span>;
}

export default function AdminProgressClient({
  schoolSlug,
  summary,
  classes,
}: AdminProgressClientProps) {
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredClasses = classes.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.students.some((s) => s.fullName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight text-ink">Progress & Analytics</h2>
        <p className="text-slate text-sm mt-1">
          School-wide performance overview — grades, submissions, and student engagement.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Students', value: summary.totalStudents, icon: '👤' },
          { label: 'Active Assignments', value: summary.totalAssignments, icon: '📝' },
          { label: 'Total Submissions', value: summary.totalSubmissions, icon: '📤' },
          { label: 'Graded', value: summary.totalGraded, icon: '✅' },
          {
            label: 'School Avg Score',
            value: summary.schoolAvgGrade !== null ? `${summary.schoolAvgGrade.toFixed(1)}%` : '—',
            icon: '🏆',
            highlight: true,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-canvas border rounded-lg p-5 flex flex-col gap-1 ${
              card.highlight ? 'border-brandGreen/30 bg-brandGreenSoft/30' : 'border-slate/10'
            }`}
          >
            <span className="text-xl">{card.icon}</span>
            <p className="text-2xl font-bold text-ink tracking-tight leading-none mt-1">
              {card.value}
            </p>
            <p className="text-[11px] text-slate uppercase tracking-wider font-semibold mt-0.5">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Class Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-ink">Breakdown by Class</h3>
          <input
            type="text"
            placeholder="Search class or student…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate/20 rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30 w-56"
          />
        </div>

        {filteredClasses.length === 0 ? (
          <div className="bg-canvas border border-slate/10 rounded-lg py-16 text-center text-slate text-sm">
            <div className="text-3xl mb-3">📊</div>
            No classes found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClasses.map((cls) => (
              <div key={cls.id} className="bg-canvas border border-slate/10 rounded-lg overflow-hidden">
                {/* Class Header Row */}
                <button
                  onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold text-ink text-sm">{cls.name}</p>
                      <p className="text-[11px] text-slate mt-0.5 uppercase tracking-wide">
                        {cls.category.replace('_', ' ')} · {cls.studentCount} student{cls.studentCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block w-40">{cls.classAvg !== null ? gradeBar(cls.classAvg) : <span className="text-xs text-slate/40 italic">No grades yet</span>}</div>
                    <div className="text-right min-w-[60px]">{gradeLabel(cls.classAvg)}</div>
                    <svg
                      className={`w-4 h-4 text-slate transition-transform ${expandedClass === cls.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Student Table */}
                {expandedClass === cls.id && (
                  <div className="border-t border-slate/10">
                    {cls.students.length === 0 ? (
                      <p className="px-5 py-6 text-sm text-slate italic">No students enrolled in this class.</p>
                    ) : (
                      <table className="min-w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-surface text-slate uppercase tracking-wider text-[10px] font-bold border-b border-slate/10">
                            <th className="px-5 py-2.5">Student</th>
                            <th className="px-5 py-2.5 text-center">Submitted</th>
                            <th className="px-5 py-2.5 text-center">Graded</th>
                            <th className="px-5 py-2.5 text-center">Pending</th>
                            <th className="px-5 py-2.5">Avg Grade</th>
                            <th className="px-5 py-2.5">Last Activity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate/5">
                          {cls.students
                            .filter(
                              (s) =>
                                !search ||
                                s.fullName.toLowerCase().includes(search.toLowerCase())
                            )
                            .sort((a, b) =>
                              (b.avgGrade ?? -1) - (a.avgGrade ?? -1)
                            )
                            .map((s) => (
                              <tr key={s.id} className="hover:bg-surface/60">
                                <td className="px-5 py-3">
                                  <p className="font-medium text-ink">{s.fullName}</p>
                                  <p className="text-slate/60 text-[10px]">{s.email}</p>
                                </td>
                                <td className="px-5 py-3 text-center text-slate">{s.totalSubmissions}</td>
                                <td className="px-5 py-3 text-center text-brandGreenDark font-semibold">{s.gradedCount}</td>
                                <td className="px-5 py-3 text-center text-amber-700 font-semibold">{s.pendingCount}</td>
                                <td className="px-5 py-3 min-w-[140px]">
                                  {s.avgGrade !== null ? gradeBar(s.avgGrade) : (
                                    <span className="text-slate/40 italic">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-slate">
                                  {s.lastActivity
                                    ? new Date(s.lastActivity).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                      })
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
