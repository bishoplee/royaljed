import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StudentsRosterClient } from './StudentsRosterClient';
import { Role } from '@prisma/client';

interface StudentsPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function StudentsPage({ params }: StudentsPageProps) {
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

  // Fetch initial student roster
  const students = await prisma.user.findMany({
    where: {
      schoolId: school.id,
      role: Role.STUDENT,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      classStudents: {
        select: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      fullName: 'asc',
    },
  });

  // Map to match client-side props formatting
  const formattedStudents = students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    email: s.email,
    phone: s.phone,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    classes: s.classStudents.map((cs) => ({
      id: cs.class.id,
      name: cs.class.name,
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-ink font-sans">Students Directory</h2>
        <p className="text-slate text-sm mt-1">
          Review, edit, activate, or bulk-import student accounts registered under {school.name}.
        </p>
      </div>

      <StudentsRosterClient initialStudents={formattedStudents} schoolSlug={school.slug} />
    </div>
  );
}
