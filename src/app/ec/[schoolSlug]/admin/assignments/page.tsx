import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AssignmentsManagerClient } from './AssignmentsManagerClient';

interface AssignmentsPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function AdminAssignmentsPage({ params }: AssignmentsPageProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/');
  }

  const slug = schoolSlug.toLowerCase().trim();
  const school = await prisma.school.findUnique({ where: { slug } });

  if (!school) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/admin/dashboard`);
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-ink">
          Assignment Manager
        </h2>
        <p className="text-slate text-sm mt-1">
          Create and publish assignments, link them to modules and classes, and monitor submission scope.
        </p>
      </div>

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
  );
}
