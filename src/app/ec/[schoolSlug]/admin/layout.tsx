import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
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
  const user = await getSessionUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Authorize: Admin or Super Admin only
  const role = user.role;
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
  if (role !== 'SUPER_ADMIN' && user.schoolSlug !== slug) {
    redirect(`/ec/${user.schoolSlug}/admin/dashboard`);
  }

  const sessionUser = {
    name: user.name || 'Admin',
    email: user.email || '',
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
