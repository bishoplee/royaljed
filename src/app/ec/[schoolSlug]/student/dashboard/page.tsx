import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
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

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    redirect('/auth/signin');
  }

  // Ensure the session user belongs to this tenant unless SUPER_ADMIN
  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/student/dashboard`);
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
    where: { studentId: session.user.id as string },
  });

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
      <StudentPracticeDashboardClient schoolSlug={slug} lessons={mappedLessons} practiceSessionCount={practiceSessionCount} />
    </div>
  );
}

