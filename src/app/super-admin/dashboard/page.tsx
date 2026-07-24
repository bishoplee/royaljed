import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import SuperAdminDashboard from './SuperAdminDashboard';

export const metadata = {
  title: 'Super Admin Dashboard — Royaljed',
};

export default async function SuperAdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/signin');
  }

  // Fetch all schools with counts
  const schools = await prisma.school.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          users: true,
          modules: true,
        },
      },
      schoolConfig: {
        select: { gclassSyncEnabled: true, allowStudentLeaderboard: true },
      },
    },
  });

  // Platform-wide stats
  const [totalUsers, totalSubmissions, totalModules] = await Promise.all([
    prisma.user.count(),
    prisma.submission.count(),
    prisma.module.count(),
  ]);

  const serialised = schools.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    logoUrl: s.logoUrl,
    brandColor: s.brandColor,
    pricingPlan: s.pricingPlan,
    subscriptionStatus: s.subscriptionStatus,
    trialEndsAt: s.trialEndsAt ? s.trialEndsAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    userCount: s._count.users,
    moduleCount: s._count.modules,
    gclassSync: s.schoolConfig?.gclassSyncEnabled ?? false,
  }));

  return (
    <SuperAdminDashboard
      schools={serialised}
      stats={{ totalUsers, totalSubmissions, totalModules, totalSchools: schools.length }}
    />
  );
}
