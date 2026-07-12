import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTutorRoleAllowed,
  isTenantMatch,
  buildTutorAssignmentVisibilityFilter,
} from '../tutorAccess';

test('isTutorRoleAllowed permits only TUTOR and SUPER_ADMIN roles', () => {
  assert.equal(isTutorRoleAllowed('SUPER_ADMIN'), true);
  assert.equal(isTutorRoleAllowed('TUTOR'), true);
  assert.equal(isTutorRoleAllowed('STUDENT'), false);
  assert.equal(isTutorRoleAllowed('ADMIN'), false);
  assert.equal(isTutorRoleAllowed(''), false);
});

test('isTenantMatch validates access correctly', () => {
  // Super admin always matches
  assert.equal(
    isTenantMatch({
      isSuperAdmin: true,
      userSchoolSlug: 'other-school',
      targetSchoolSlug: 'royaljed-demo',
    }),
    true
  );

  // Tenant matches case-insensitively and with whitespace trimming
  assert.equal(
    isTenantMatch({
      isSuperAdmin: false,
      userSchoolSlug: '  RoyalJed-Demo  ',
      targetSchoolSlug: 'royaljed-demo',
    }),
    true
  );

  // Tenant mismatch
  assert.equal(
    isTenantMatch({
      isSuperAdmin: false,
      userSchoolSlug: 'some-other-school',
      targetSchoolSlug: 'royaljed-demo',
    }),
    false
  );

  // Missing user school slug
  assert.equal(
    isTenantMatch({
      isSuperAdmin: false,
      userSchoolSlug: null,
      targetSchoolSlug: 'royaljed-demo',
    }),
    false
  );
  assert.equal(
    isTenantMatch({
      isSuperAdmin: false,
      userSchoolSlug: undefined,
      targetSchoolSlug: 'royaljed-demo',
    }),
    false
  );
});

test('buildTutorAssignmentVisibilityFilter generates correct filter scoping', () => {
  // Super admin filter is empty
  const superAdminFilter = buildTutorAssignmentVisibilityFilter({
    isSuperAdmin: true,
    tutorId: 'tutor_123',
  });
  assert.deepEqual(superAdminFilter, {});

  // Tutor visibility filter is scoped to assigned classes or classes with no tutors
  const tutorFilter = buildTutorAssignmentVisibilityFilter({
    isSuperAdmin: false,
    tutorId: 'tutor_123',
  });
  assert.deepEqual(tutorFilter, {
    OR: [
      { classes: { none: {} } },
      {
        classes: {
          some: {
            class: {
              tutors: {
                some: {
                  tutorId: 'tutor_123',
                },
              },
            },
          },
        },
      },
    ],
  });
});
