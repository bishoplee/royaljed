type BuildTutorVisibilityFilterInput = {
  isSuperAdmin: boolean;
  tutorId: string;
};

type TenantMatchInput = {
  isSuperAdmin: boolean;
  userSchoolSlug: string | null | undefined;
  targetSchoolSlug: string;
};

export function isTutorRoleAllowed(role: string) {
  return role === 'TUTOR' || role === 'SUPER_ADMIN';
}

export function isTenantMatch({ isSuperAdmin, userSchoolSlug, targetSchoolSlug }: TenantMatchInput) {
  if (isSuperAdmin) {
    return true;
  }

  if (!userSchoolSlug) {
    return false;
  }

  return userSchoolSlug.toLowerCase().trim() === targetSchoolSlug.toLowerCase().trim();
}

export function buildTutorAssignmentVisibilityFilter({
  isSuperAdmin,
  tutorId,
}: BuildTutorVisibilityFilterInput) {
  if (isSuperAdmin) {
    return {};
  }

  return {
    OR: [
      { classes: { none: {} } },
      {
        classes: {
          some: {
            class: {
              tutors: {
                some: {
                  tutorId,
                },
              },
            },
          },
        },
      },
    ],
  };
}
