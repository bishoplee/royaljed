import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import StudentPracticeDashboardClient from './StudentPracticeDashboardClient';

interface StudentDashboardPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function StudentDashboardPage({ params }: StudentDashboardPageProps) {
  const { schoolSlug } = await params;
  const slug = schoolSlug.toLowerCase().trim();

  const user = await getSessionUser();
  if (!user) {
    redirect('/auth/signin');
  }

  // Ensure the session user belongs to this tenant unless SUPER_ADMIN
  if (user.role !== 'SUPER_ADMIN' && user.schoolSlug !== slug) {
    redirect(`/ec/${user.schoolSlug}/student/dashboard`);
  }

  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) {
    redirect('/auth/signin');
  }

  // Fetch lessons for this school (active) with their module title
  const lessons = await prisma.lesson.findMany({
    where: {
      active: true,
      module: { schoolId: school.id },
    },
    include: { module: true },
    orderBy: { sortOrder: 'asc' },
  });

  // Count practice sessions for the signed-in student
  const practiceSessionCount = await prisma.practiceSession.count({
    where: { studentId: user.id as string },
  });

  // Fetch practice sessions to compute distinct lessons practiced
  const studentPracticeSessions = await prisma.practiceSession.findMany({
    where: { studentId: user.id as string },
    select: { lessonId: true },
  });

  const lessonsPracticedCount = new Set(studentPracticeSessions.map((s) => s.lessonId)).size;

  // Count submissions (assignments done) for the student
  const assignmentsDoneCount = await prisma.submission.count({ where: { studentId: user.id as string } });

  const studentClassMemberships = await prisma.classStudent.findMany({
    where: { studentId: user.id as string },
    select: { classId: true },
  });

  const studentClassIds = studentClassMemberships.map((m) => m.classId);

  const availableAssignments = await prisma.assignment.findMany({
    where: {
      schoolId: school.id,
      active: true,
      OR: [
        { classes: { none: {} } },
        {
          classes: {
            some: {
              classId: { in: studentClassIds },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      maxAttempts: true,
      submissions: {
        where: { studentId: user.id as string },
        select: { id: true },
      },
    },
  });

  const assignmentsAssignedCount = availableAssignments.length;
  const assignmentsPendingCount = availableAssignments.filter(
    (assignment) => assignment.submissions.length < assignment.maxAttempts
  ).length;

  const mappedLessons = lessons.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    lessonType: l.lessonType,
    level: l.level,
    moduleTitle: l.module?.title || '',
    videoPath: l.videoPath,
    streamUrl: l.lessonType === 'VIDEO' && l.videoPath ? `/api/ec/${slug}/lessons/${l.id}/stream/index.m3u8` : null,
  }));

  return (
    <div>
      <StudentPracticeDashboardClient
        schoolSlug={slug}
        lessons={mappedLessons}
        practiceSessionCount={practiceSessionCount}
        studentName={user.name ?? undefined}
        studentEmail={user.email ?? undefined}
        lessonsPracticedCount={lessonsPracticedCount}
        assignmentsDoneCount={assignmentsDoneCount}
        assignmentsAssignedCount={assignmentsAssignedCount}
        assignmentsPendingCount={assignmentsPendingCount}
      />
    </div>
  );
}

