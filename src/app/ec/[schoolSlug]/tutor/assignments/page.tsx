import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AssignmentsManagerClient } from '../../admin/assignments/AssignmentsManagerClient';

interface TutorAssignmentsPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function TutorAssignmentsPage({ params }: TutorAssignmentsPageProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'TUTOR' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/signin');
  }

  const slug = schoolSlug.toLowerCase().trim();
  const school = await prisma.school.findUnique({ where: { slug } });

  if (!school) {
    notFound();
  }

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/tutor/dashboard`);
  }

  const [modules, classes, assignments] = await Promise.all([
    prisma.module.findMany({
      where: { schoolId: school.id },
      include: {
        lessons: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.class.findMany({
      where: { schoolId: school.id },
      select: {
        id: true,
        name: true,
        category: true,
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.assignment.findMany({
      where: { schoolId: school.id },
      include: {
        module: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
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
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#f3f4f6] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href={`/ec/${school.slug}/tutor/dashboard`}
                className="text-xs font-semibold text-brandTeal hover:underline flex items-center gap-1"
              >
                ← Back to Dashboard
              </Link>
              <span className="text-slate-300">|</span>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{school.name}</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assign Lessons & Tasks</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Create and publish assignment tasks, link them to learning modules and classes, and set completion due dates.
            </p>
          </div>
        </header>

        <AssignmentsManagerClient
          schoolSlug={school.slug}
          modules={modules}
          classes={classes}
          initialAssignments={assignments.map((assignment) => ({
            id: assignment.id,
            title: assignment.title,
            submissionType: assignment.submissionType,
            dueDate: assignment.dueDate.toISOString(),
            maxAttempts: assignment.maxAttempts,
            active: assignment.active,
            moduleTitle: assignment.module.title,
            lessonTitle: assignment.lesson?.title ?? null,
            classNames: assignment.classes.map((entry) => entry.class.name),
          }))}
        />
      </div>
    </div>
  );
}
