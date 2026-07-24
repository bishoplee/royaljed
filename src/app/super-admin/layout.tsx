import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SuperAdminLayoutClient } from '@/components/SuperAdminLayoutClient';

export const metadata = {
  title: 'Super Admin — Royaljed',
};

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/signin');
  }

  return (
    <SuperAdminLayoutClient user={{ name: session.user.name ?? '', email: session.user.email ?? '' }}>
      {children}
    </SuperAdminLayoutClient>
  );
}
