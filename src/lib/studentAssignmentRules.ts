import { SubmissionStatus } from '@prisma/client';

interface VisibilityFilterOptions {
  isSuperAdmin: boolean;
  studentId: string;
}

interface AssignmentWindowOptions {
  dueDate: Date;
  maxAttempts: number;
  attemptsUsed: number;
  now?: Date;
}

export function buildStudentAssignmentVisibilityFilter({
  isSuperAdmin,
  studentId,
}: VisibilityFilterOptions) {
  if (isSuperAdmin) {
    return {};
  }

  return {
    classes: {
      some: {
        class: {
          students: {
            some: {
              studentId,
            },
          },
        },
      },
    },
  };
}

export function getAssignmentSubmissionWindow({
  dueDate,
  maxAttempts,
  attemptsUsed,
  now = new Date(),
}: AssignmentWindowOptions) {
  const remainingAttempts = Math.max(maxAttempts - attemptsUsed, 0);
  const isPastDue = dueDate < now;

  return {
    remainingAttempts,
    isPastDue,
    canSubmit: !isPastDue && remainingAttempts > 0,
  };
}

const SUBMISSION_STATUS_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['GRADED'],
  GRADED: [],
};

export function canTransitionSubmissionStatus(
  currentStatus: SubmissionStatus,
  nextStatus: SubmissionStatus
) {
  return SUBMISSION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function getNewSubmissionStatus() {
  return SubmissionStatus.SUBMITTED;
}
