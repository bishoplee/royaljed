import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminLayoutClient } from '@/components/AdminLayoutClient';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    schoolSlug: string;
  }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/signin');
  }

  // Authorize: Admin or Super Admin only
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

  const sessionUser = {
    name: session.user.name || 'Admin',
    email: session.user.email || '',
    role: role,
  };

  const schoolData = {
    name: school.name,
    slug: school.slug,
    logoUrl: school.logoUrl,
    brandColor: school.brandColor,
  };

  return (
    <AdminLayoutClient school={schoolData} user={sessionUser}>
      {children}
    </AdminLayoutClient>
  );
}
