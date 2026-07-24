import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { schoolSlug } = await params;
    const slug = schoolSlug.toLowerCase().trim();

    if (
      session.user.role !== 'SUPER_ADMIN' &&
      session.user.schoolSlug !== slug
    ) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({ where: { slug } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Fetch all grades for the school with student and assignment context
    const grades = await prisma.grade.findMany({
      where: {
        submission: {
          assignment: {
            schoolId: school.id,
          },
        },
      },
      select: {
        id: true,
        percentage: true,
        gradedAt: true,
        submission: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            student: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            assignment: {
              select: {
                id: true,
                title: true,
                dueDate: true,
                classes: {
                  include: {
                    class: {
                      select: { id: true, name: true, category: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { gradedAt: 'desc' },
    });

    // Aggregate per-student stats
    const studentMap = new Map<
      string,
      {
        student: { id: string; fullName: string; email: string };
        totalAssignments: number;
        gradedCount: number;
        totalPercentage: number;
        classes: Set<string>;
      }
    >();

    for (const grade of grades) {
      const { student } = grade.submission;
      const entry = studentMap.get(student.id) ?? {
        student,
        totalAssignments: 0,
        gradedCount: 0,
        totalPercentage: 0,
        classes: new Set<string>(),
      };
      entry.gradedCount += 1;
      entry.totalPercentage += Number(grade.percentage);
      for (const c of grade.submission.assignment.classes) {
        entry.classes.add(c.class.name);
      }
      studentMap.set(student.id, entry);
    }

    // Fetch total submitted count per student in this school
    const submittedCounts = await prisma.submission.groupBy({
      by: ['studentId'],
      where: {
        assignment: { schoolId: school.id },
        status: { in: ['SUBMITTED', 'GRADED'] },
      },
      _count: { id: true },
    });

    const submittedCountMap = new Map<string, number>();
    for (const row of submittedCounts) {
      submittedCountMap.set(row.studentId, row._count.id);
    }

    // School-wide summary
    const totalStudents = await prisma.user.count({
      where: { schoolId: school.id, role: 'STUDENT' },
    });
    const totalAssignments = await prisma.assignment.count({
      where: { schoolId: school.id, active: true },
    });
    const totalSubmissions = await prisma.submission.count({
      where: { assignment: { schoolId: school.id } },
    });
    const totalGraded = await prisma.submission.count({
      where: { assignment: { schoolId: school.id }, status: 'GRADED' },
    });

    const allGradePercentages = grades.map((g) => Number(g.percentage));
    const schoolAvg =
      allGradePercentages.length > 0
        ? allGradePercentages.reduce((a, b) => a + b, 0) / allGradePercentages.length
        : null;

    // Per-class aggregation
    const classStats = await prisma.class.findMany({
      where: { schoolId: school.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                submissions: {
                  where: { assignment: { schoolId: school.id } },
                  include: { grade: true },
                },
              },
            },
          },
        },
      },
    });

    const classes = classStats.map((cls) => {
      const gradedSubs = cls.students.flatMap((s) =>
        s.student.submissions.filter((sub) => sub.grade)
      );
      const avgGrade =
        gradedSubs.length > 0
          ? gradedSubs.reduce((sum, sub) => sum + Number(sub.grade!.percentage), 0) /
            gradedSubs.length
          : null;
      return {
        id: cls.id,
        name: cls.name,
        category: cls.category,
        studentCount: cls.students.length,
        gradedSubmissions: gradedSubs.length,
        avgGrade,
      };
    });

    const studentStats = Array.from(studentMap.values()).map((entry) => ({
      student: entry.student,
      gradedCount: entry.gradedCount,
      submittedCount: submittedCountMap.get(entry.student.id) ?? entry.gradedCount,
      avgGrade: entry.gradedCount > 0 ? entry.totalPercentage / entry.gradedCount : null,
      classes: Array.from(entry.classes),
    }));

    return NextResponse.json({
      summary: {
        totalStudents,
        totalAssignments,
        totalSubmissions,
        totalGraded,
        schoolAvgGrade: schoolAvg,
      },
      classes,
      students: studentStats,
    });
  } catch (error) {
    console.error('Error fetching progress data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
