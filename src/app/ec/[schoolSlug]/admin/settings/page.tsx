import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SettingsForm } from './SettingsForm';

interface SettingsPageProps {
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin');
  }

  const slug = schoolSlug.toLowerCase().trim();

  // Find school including config
  const school = await prisma.school.findUnique({
    where: { slug },
    include: {
      schoolConfig: {
        select: {
          gclassSyncEnabled: true,
          allowStudentLeaderboard: true,
          googleRefreshToken: true,
        },
      },
    },
  });

  if (!school) {
    redirect('/auth/signin');
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-ink">School Branding & Settings</h2>
        <p className="text-slate text-sm mt-1">
          Customize colors, upload a logo, and toggle school-wide preferences.
        </p>
      </div>

      <SettingsForm school={school} />
    </div>
  );
}
