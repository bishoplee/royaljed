import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminProgressClient from './AdminProgressClient';

interface ProgressPageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function AdminProgressPage({ params }: ProgressPageProps) {
  const { schoolSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/');
  }

  const slug = schoolSlug.toLowerCase().trim();

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/admin/progress`);
  }

  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) {
    redirect('/auth/signin');
  }

  // School-wide summary counts
  const [totalStudents, totalAssignments, totalSubmissions, totalGraded] = await Promise.all([
    prisma.user.count({ where: { schoolId: school.id, role: 'STUDENT' } }),
    prisma.assignment.count({ where: { schoolId: school.id, active: true } }),
    prisma.submission.count({ where: { assignment: { schoolId: school.id } } }),
    prisma.submission.count({ where: { assignment: { schoolId: school.id }, status: 'GRADED' } }),
  ]);

  // All grades for school avg
  const allGrades = await prisma.grade.findMany({
    where: { submission: { assignment: { schoolId: school.id } } },
    select: { percentage: true },
  });
  const schoolAvgGrade =
    allGrades.length > 0
      ? allGrades.reduce((sum, g) => sum + Number(g.percentage), 0) / allGrades.length
      : null;

  // Per-class aggregation
  const classes = await prisma.class.findMany({
    where: { schoolId: school.id },
    include: {
      students: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              email: true,
              submissions: {
                where: { assignment: { schoolId: school.id } },
                select: {
                  id: true,
                  status: true,
                  submittedAt: true,
                  grade: {
                    select: { percentage: true, gradedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const classStats = classes.map((cls) => {
    const studentStats = cls.students.map(({ student }) => {
      const subs = student.submissions;
      const graded = subs.filter((s) => s.grade);
      const avg =
        graded.length > 0
          ? graded.reduce((sum, s) => sum + Number(s.grade!.percentage), 0) / graded.length
          : null;
      return {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        totalSubmissions: subs.length,
        gradedCount: graded.length,
        pendingCount: subs.filter((s) => s.status === 'SUBMITTED').length,
        avgGrade: avg,
        lastActivity:
          subs.length > 0
            ? subs
                .map((s) => s.submittedAt.toISOString())
                .sort()
                .reverse()[0]
            : null,
      };
    });

    const classGrades = studentStats.flatMap((s) =>
      s.avgGrade !== null ? [s.avgGrade] : []
    );
    const classAvg =
      classGrades.length > 0
        ? classGrades.reduce((a, b) => a + b, 0) / classGrades.length
        : null;

    return {
      id: cls.id,
      name: cls.name,
      category: cls.category,
      studentCount: cls.students.length,
      classAvg,
      students: studentStats,
    };
  });

  return (
    <AdminProgressClient
      schoolSlug={slug}
      summary={{
        totalStudents,
        totalAssignments,
        totalSubmissions,
        totalGraded,
        schoolAvgGrade,
      }}
      classes={classStats}
    />
  );
}
