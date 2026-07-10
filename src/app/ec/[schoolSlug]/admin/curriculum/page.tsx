import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CurriculumClient } from './CurriculumClient';

interface CurriculumPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function AdminCurriculumPage({ params }: CurriculumPageProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin');
  }

  // Auth check: Admin or Super Admin only
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    redirect('/');
  }

  const slug = schoolSlug.toLowerCase().trim();

  // Find school
  const school = await prisma.school.findUnique({
    where: { slug },
  });

  if (!school) {
    redirect('/auth/signin');
  }

  // Ensure ADMIN belongs to this school, SUPER_ADMIN has global bypass
  if (role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/admin/dashboard`);
  }

  // Fetch modules and lessons
  const modules = await prisma.module.findMany({
    where: { schoolId: school.id },
    include: {
      lessons: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-ink">
          Curriculum & Lessons Manager
        </h2>
        <p className="text-slate text-sm mt-1">
          Organize modules, manage learning content, upload instructional videos, and stream encrypted HLS.
        </p>
      </div>

      <CurriculumClient
        schoolId={school.id}
        schoolSlug={school.slug}
        initialModules={modules}
      />
    </div>
  );
}
