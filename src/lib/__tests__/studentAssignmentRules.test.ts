import test from 'node:test';
import assert from 'node:assert/strict';
import { SubmissionStatus } from '@prisma/client';
import {
  buildStudentAssignmentVisibilityFilter,
  canTransitionSubmissionStatus,
  getAssignmentSubmissionWindow,
  getNewSubmissionStatus,
} from '../studentAssignmentRules';

test('buildStudentAssignmentVisibilityFilter returns empty filter for super admin', () => {
  const filter = buildStudentAssignmentVisibilityFilter({
    isSuperAdmin: true,
    studentId: 'student_123',
  });

  assert.deepEqual(filter, {});
});

test('buildStudentAssignmentVisibilityFilter scopes non-super-admin to enrolled class memberships', () => {
  const filter = buildStudentAssignmentVisibilityFilter({
    isSuperAdmin: false,
    studentId: 'student_123',
  });

  assert.deepEqual(filter, {
    classes: {
      some: {
        class: {
          students: {
            some: {
              studentId: 'student_123',
            },
          },
        },
      },
    },
  });
});

test('getAssignmentSubmissionWindow allows submission when due date is valid and attempts remain', () => {
  const dueDate = new Date(Date.now() + 60_000);
  const result = getAssignmentSubmissionWindow({
    dueDate,
    maxAttempts: 3,
    attemptsUsed: 1,
  });

  assert.equal(result.remainingAttempts, 2);
  assert.equal(result.isPastDue, false);
  assert.equal(result.canSubmit, true);
});

test('getAssignmentSubmissionWindow blocks submission when due date has passed', () => {
  const dueDate = new Date(Date.now() - 60_000);
  const result = getAssignmentSubmissionWindow({
    dueDate,
    maxAttempts: 3,
    attemptsUsed: 1,
  });

  assert.equal(result.remainingAttempts, 2);
  assert.equal(result.isPastDue, true);
  assert.equal(result.canSubmit, false);
});

test('getAssignmentSubmissionWindow blocks submission when attempts are exhausted', () => {
  const dueDate = new Date(Date.now() + 60_000);
  const result = getAssignmentSubmissionWindow({
    dueDate,
    maxAttempts: 2,
    attemptsUsed: 2,
  });

  assert.equal(result.remainingAttempts, 0);
  assert.equal(result.isPastDue, false);
  assert.equal(result.canSubmit, false);
});

test('submission status transitions enforce DRAFT -> SUBMITTED -> GRADED progression', () => {
  assert.equal(canTransitionSubmissionStatus(SubmissionStatus.DRAFT, SubmissionStatus.SUBMITTED), true);
  assert.equal(canTransitionSubmissionStatus(SubmissionStatus.SUBMITTED, SubmissionStatus.GRADED), true);

  assert.equal(canTransitionSubmissionStatus(SubmissionStatus.SUBMITTED, SubmissionStatus.SUBMITTED), false);
  assert.equal(canTransitionSubmissionStatus(SubmissionStatus.GRADED, SubmissionStatus.SUBMITTED), false);
  assert.equal(canTransitionSubmissionStatus(SubmissionStatus.GRADED, SubmissionStatus.GRADED), false);
});

test('new submissions are created as SUBMITTED status', () => {
  assert.equal(getNewSubmissionStatus(), SubmissionStatus.SUBMITTED);
});
