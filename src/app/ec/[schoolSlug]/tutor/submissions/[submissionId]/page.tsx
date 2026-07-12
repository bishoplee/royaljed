import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TutorSubmissionReviewClient from './TutorSubmissionReviewClient';

interface TutorSubmissionPageProps {
  params: Promise<{
    schoolSlug: string;
    submissionId: string;
  }>;
}

export default async function TutorSubmissionPage({ params }: TutorSubmissionPageProps) {
  const { schoolSlug, submissionId } = await params;
  const slug = schoolSlug.toLowerCase().trim();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'TUTOR' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/ec/${session.user.schoolSlug}/student/dashboard`);
  }

  if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolSlug !== slug) {
    redirect(`/ec/${session.user.schoolSlug}/tutor/dashboard`);
  }

  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school) {
    notFound();
  }

  const tutorVisibilityFilter =
    session.user.role === 'SUPER_ADMIN'
      ? {}
      : {
          OR: [
            { classes: { none: {} } },
            {
              classes: {
                some: {
                  class: {
                    tutors: {
                      some: {
                        tutorId: session.user.id,
                      },
                    },
                  },
                },
              },
            },
          ],
        };

  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      assignment: {
        schoolId: school.id,
        ...tutorVisibilityFilter,
      },
    },
    include: {
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
          description: true,
          instructions: true,
          submissionType: true,
          dueDate: true,
          rubricJson: true,
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      grade: {
        include: {
          timestampedFeedback: {
            orderBy: {
              timestampSeconds: 'asc',
            },
          },
        },
      },
    },
  });

  if (!submission) {
    notFound();
  }

  return (
    <TutorSubmissionReviewClient
      schoolSlug={slug}
      submissionId={submission.id}
      initialDetail={{
        submission: {
          id: submission.id,
          assignmentId: submission.assignmentId,
          studentId: submission.studentId,
          attemptNumber: submission.attemptNumber,
          status: submission.status,
          submittedAt: submission.submittedAt.toISOString(),
          filePath: submission.filePath,
          textContent: submission.textContent,
          originalFileName: submission.originalFileName,
          mimeType: submission.mimeType,
          student: {
            id: submission.student.id,
            fullName: submission.student.fullName,
            email: submission.student.email,
          },
          assignment: {
            id: submission.assignment.id,
            title: submission.assignment.title,
            description: submission.assignment.description,
            instructions: submission.assignment.instructions,
            submissionType: submission.assignment.submissionType,
            dueDate: submission.assignment.dueDate.toISOString(),
            rubricJson: submission.assignment.rubricJson,
            classes: submission.assignment.classes.map((entry) => ({
              id: entry.class.id,
              name: entry.class.name,
            })),
          },
          grade: submission.grade
            ? {
                id: submission.grade.id,
                scoresJson: submission.grade.scoresJson,
                percentage: Number(submission.grade.percentage),
                feedbackText: submission.grade.feedbackText,
                gradedAt: submission.grade.gradedAt.toISOString(),
                timestampedFeedback: submission.grade.timestampedFeedback.map((entry) => ({
                  id: entry.id,
                  timestampSeconds: entry.timestampSeconds,
                  comment: entry.comment,
                })),
              }
            : null,
        },
      }}
    />
  );
}
