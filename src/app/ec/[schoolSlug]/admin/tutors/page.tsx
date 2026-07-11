import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TutorsRosterClient } from './TutorsRosterClient';
import { Role } from '@prisma/client';

interface TutorsPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function TutorsPage({ params }: TutorsPageProps) {
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

  // Fetch initial tutor roster
  const tutors = await prisma.user.findMany({
    where: {
      schoolId: school.id,
      role: Role.TUTOR,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      classTutors: {
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

  const classes = await prisma.class.findMany({
    where: {
      schoolId: school.id,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Map to match client-side props formatting
  const formattedTutors = tutors.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    email: t.email,
    phone: t.phone,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    classes: t.classTutors.map((ct) => ({
      id: ct.class.id,
      name: ct.class.name,
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-ink font-sans">Tutors Directory</h2>
        <p className="text-slate text-sm mt-1">
          Manage, suspend, edit, or register tutor accounts for {school.name}.
        </p>
      </div>

      <TutorsRosterClient
        initialTutors={formattedTutors}
        availableClasses={classes}
        schoolSlug={school.slug}
      />
    </div>
  );
}
