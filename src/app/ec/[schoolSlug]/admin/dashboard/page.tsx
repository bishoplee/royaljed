import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface DashboardPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function AdminDashboardPage({ params }: DashboardPageProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin');
  }

  const slug = schoolSlug.toLowerCase().trim();

  // Find school
  const school = await prisma.school.findUnique({
    where: { slug },
  });

  if (!school) {
    redirect('/auth/signin');
  }

  // Fetch counts in parallel
  const [studentCount, tutorCount, classCount, practiceCount, assignmentCount, recentLogs] = await Promise.all([
    prisma.user.count({
      where: {
        schoolId: school.id,
        role: 'STUDENT',
      },
    }),
    prisma.user.count({
      where: {
        schoolId: school.id,
        role: 'TUTOR',
      },
    }),
    prisma.class.count({
      where: {
        schoolId: school.id,
      },
    }),
    prisma.practiceSession.count({
      where: {
        student: {
          schoolId: school.id,
        },
      },
    }),
    prisma.assignment.count({
      where: {
        schoolId: school.id,
        active: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        schoolId: school.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      include: {
        user: true,
      },
    }),
  ]);

  const cards = [
    {
      title: 'Total Students',
      value: studentCount,
      description: 'Active pupil profiles',
      href: `/ec/${school.slug}/admin/students`,
      icon: (
        <svg className="w-6 h-6 text-brandGreenDark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      bg: 'bg-brandGreenSoft',
    },
    {
      title: 'Active Tutors',
      value: tutorCount,
      description: 'Instructors & assessors',
      href: `/ec/${school.slug}/admin/tutors`,
      icon: (
        <svg className="w-6 h-6 text-brandTeal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
      bg: 'bg-blue-50',
    },
    {
      title: 'Registered Classes',
      value: classCount,
      description: 'Nursery to Secondary sections',
      href: `/ec/${school.slug}/admin/classes`,
      icon: (
        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      bg: 'bg-indigo-50',
    },
    {
      title: 'Practice Sessions',
      value: practiceCount,
      description: 'Audio review files',
      href: '#',
      icon: (
        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      ),
      bg: 'bg-emerald-50',
    },
    {
      title: 'Assignments',
      value: assignmentCount,
      description: 'Published assessments',
      href: `/ec/${school.slug}/admin/assignments`,
      icon: (
        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5h6m-7 4h8m-8 4h5m-4 8h10a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-ink">
          Welcome back, {session.user.name}
        </h2>
        <p className="text-slate text-sm mt-1">
          Here is a high-level overview of the {school.name} platform statistics and audit actions.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
        {cards.map((card, i) => (
          <div
            key={i}
            className="bg-canvas border border-slate/10 p-6 rounded-lg hover:border-brandGreenDark/20 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  {card.title}
                </p>
                <p className="text-4xl font-semibold text-ink leading-none tracking-tight">
                  {card.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.bg}`}>
                {card.icon}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate/5 flex items-center justify-between">
              <span className="text-xs text-slate">{card.description}</span>
              {card.href !== '#' && (
                <Link
                  href={card.href}
                  className="text-xs font-semibold text-brandGreenDark hover:underline flex items-center gap-1"
                >
                  Manage &rarr;
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Setup Utilities */}
        <div className="bg-canvas border border-slate/10 p-6 rounded-lg lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-medium text-ink tracking-tight mb-2 border-b border-slate/5 pb-3">
              Quick Setup Shortcuts
            </h3>
            <p className="text-xs text-slate mb-6">
              Bootstrapping utilities to manage school operations efficiently.
            </p>
            <div className="space-y-3">
              <Link
                href={`/ec/${school.slug}/admin/classes`}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate/10 hover:bg-surface text-sm text-ink transition-colors font-medium"
              >
                <span>🚀 Quick Setup Classes</span>
                <span className="text-xs text-slate">&rarr;</span>
              </Link>
              <Link
                href={`/ec/${school.slug}/admin/students`}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate/10 hover:bg-surface text-sm text-ink transition-colors font-medium"
              >
                <span>📥 CSV Import Students</span>
                <span className="text-xs text-slate">&rarr;</span>
              </Link>
              <Link
                href={`/ec/${school.slug}/admin/tutors`}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate/10 hover:bg-surface text-sm text-ink transition-colors font-medium"
              >
                <span>🧑‍🏫 Register Tutor Account</span>
                <span className="text-xs text-slate">&rarr;</span>
              </Link>
              <Link
                href={`/ec/${school.slug}/admin/assignments`}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate/10 hover:bg-surface text-sm text-ink transition-colors font-medium"
              >
                <span>📝 Manage Assignments</span>
                <span className="text-xs text-slate">&rarr;</span>
              </Link>
              <Link
                href={`/ec/${school.slug}/admin/settings`}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate/10 hover:bg-surface text-sm text-ink transition-colors font-medium"
              >
                <span>🎨 Customize Logo & Colors</span>
                <span className="text-xs text-slate">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-canvas border border-slate/10 p-6 rounded-lg lg:col-span-2">
          <h3 className="text-lg font-medium text-ink tracking-tight mb-2 border-b border-slate/5 pb-3">
            Recent Audit Logs
          </h3>
          <p className="text-xs text-slate mb-6">
            Tracks recent login activities, updates, and registrations in the system.
          </p>

          <div className="overflow-x-auto">
            {recentLogs.length > 0 ? (
              <table className="min-w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate/10 text-slate uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-2 pb-3">Admin / User</th>
                    <th className="py-2 pb-3">Action</th>
                    <th className="py-2 pb-3">Details</th>
                    <th className="py-2 pb-3">IP Address</th>
                    <th className="py-2 pb-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate/5 text-slate-700">
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface/50">
                      <td className="py-3 font-medium text-ink">
                        {log.user ? log.user.fullName : 'System'}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-slate/10 text-ink text-[10px] font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 max-w-[200px] truncate" title={log.details || ''}>
                        {log.details || '-'}
                      </td>
                      <td className="py-3 text-slate-500">{log.ipAddress || '-'}</td>
                      <td className="py-3 text-right text-slate-500">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        {new Date(log.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate text-sm">
                No recent administrative actions logged yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
