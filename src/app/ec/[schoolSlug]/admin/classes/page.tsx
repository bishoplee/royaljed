import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ClassesManagerClient } from './ClassesManagerClient';
import { Role, UserStatus } from '@prisma/client';

interface ClassesPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function ClassesPage({ params }: ClassesPageProps) {
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

  // Fetch initial classes data with enrolled students and tutors
  const classes = await prisma.class.findMany({
    where: { schoolId: school.id },
    include: {
      students: {
        select: {
          student: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      tutors: {
        select: {
          tutor: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  // Fetch all active students under the school (for assignment checkboxes)
  const allStudents = await prisma.user.findMany({
    where: {
      schoolId: school.id,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
    orderBy: {
      fullName: 'asc',
    },
  });

  // Fetch all active tutors under the school (for assignment checkboxes)
  const allTutors = await prisma.user.findMany({
    where: {
      schoolId: school.id,
      role: Role.TUTOR,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
    orderBy: {
      fullName: 'asc',
    },
  });

  // Format classes to simplify binding
  const formattedClasses = classes.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    sortOrder: c.sortOrder,
    students: c.students.map((cs) => ({
      id: cs.student.id,
      fullName: cs.student.fullName,
      email: cs.student.email,
    })),
    tutors: c.tutors.map((ct) => ({
      id: ct.tutor.id,
      fullName: ct.tutor.fullName,
      email: ct.tutor.email,
    })),
  }));

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-ink">Class Management</h2>
        <p className="text-slate text-sm mt-1">
          Add new classes, use the bulk setups bootstrapper, or manage class rosters of {school.name}.
        </p>
      </div>

      <ClassesManagerClient
        initialClasses={formattedClasses}
        allStudents={allStudents}
        allTutors={allTutors}
        schoolSlug={school.slug}
      />
    </div>
  );
}
