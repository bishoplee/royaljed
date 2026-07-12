import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface GoogleClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  courseState: string;
}

export interface GoogleClassroomStudent {
  courseId: string;
  userId: string;
  profile: {
    id: string;
    name: {
      givenName: string;
      familyName: string;
      fullName: string;
    };
    emailAddress: string;
  };
}

export interface GoogleClassroomCourseWork {
  id: string;
  title: string;
  maxPoints?: number;
  state: string;
}

export interface GoogleClassroomSubmission {
  id: string;
  courseId: string;
  courseWorkId: string;
  userId: string;
  state: string;
  assignedGrade?: number;
  draftGrade?: number;
}

function getCallbackUri(): string {
  const nextAuthUrl = process.env.NEXTAUTH_URL || 'http://localhost:3300';
  return `${nextAuthUrl.replace(/\/$/, '')}/api/auth/google-classroom/callback`;
}

export function getGoogleAuthUrl(schoolSlug: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = encodeURIComponent(getCallbackUri());
  const scopes = encodeURIComponent(
    [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students',
    ].join(' ')
  );

  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=${scopes}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(schoolSlug)}`
  );
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = getCallbackUri();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token exchange failed: ${res.statusText} - ${errText}`);
  }

  return res.json();
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token refresh failed: ${res.statusText} - ${errText}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;
  return data.access_token;
}

export async function fetchGoogleClassroomCourses(refreshToken: string): Promise<GoogleClassroomCourse[]> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);

  const res = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch Classroom courses: ${res.statusText} - ${errText}`);
  }

  const data = await res.json();
  return (data.courses || []) as GoogleClassroomCourse[];
}

export async function fetchGoogleClassroomStudents(
  refreshToken: string,
  courseId: string
): Promise<GoogleClassroomStudent[]> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  let students: GoogleClassroomStudent[] = [];
  let nextPageToken = '';

  do {
    const url =
      `https://classroom.googleapis.com/v1/courses/${courseId}/students?pageSize=100` +
      (nextPageToken ? `&pageToken=${nextPageToken}` : '');

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch students for course ${courseId}: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    if (data.students) {
      students = students.concat(data.students);
    }
    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken);

  return students;
}

export async function fetchGoogleClassroomCourseWork(
  refreshToken: string,
  courseId: string
): Promise<GoogleClassroomCourseWork[]> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);

  const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch coursework for course ${courseId}: ${res.statusText} - ${errText}`);
  }

  const data = await res.json();
  return (data.courseWork || []) as GoogleClassroomCourseWork[];
}

export async function pushGradeToGoogleClassroom(
  refreshToken: string,
  courseId: string,
  courseWorkId: string,
  studentGoogleEmail: string,
  scorePercentage: number
): Promise<void> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);

  // 1. Fetch coursework details to get maxPoints (if available, scale grade; otherwise default to 100)
  const courseWorkRes = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let maxPoints = 100;
  if (courseWorkRes.ok) {
    const courseWorkData = (await courseWorkRes.json()) as GoogleClassroomCourseWork;
    if (courseWorkData.maxPoints && courseWorkData.maxPoints > 0) {
      maxPoints = courseWorkData.maxPoints;
    }
  }

  const finalGrade = (scorePercentage / 100) * maxPoints;

  // 2. Fetch the student's submissions for this coursework
  // We filter by student email (Google Classroom userId can be the email address)
  const submissionsRes = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?userId=${encodeURIComponent(
      studentGoogleEmail
    )}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!submissionsRes.ok) {
    const errText = await submissionsRes.text();
    throw new Error(`Failed to fetch student submissions from Google Classroom: ${submissionsRes.statusText} - ${errText}`);
  }

  const submissionsData = await submissionsRes.json().catch(() => ({}));
  const submissions = (submissionsData.studentSubmissions || []) as GoogleClassroomSubmission[];

  if (submissions.length === 0) {
    throw new Error(`No student submission found in Google Classroom for email ${studentGoogleEmail}`);
  }

  const submissionId = submissions[0].id;

  // 3. Patch the grades (both assignedGrade and draftGrade must be set)
  const patchRes = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}?updateMask=assignedGrade,draftGrade`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assignedGrade: finalGrade,
        draftGrade: finalGrade,
      }),
    }
  );

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Failed to push grade to Google Classroom: ${patchRes.statusText} - ${errText}`);
  }
}

export async function syncGoogleClassroomRoster(
  schoolId: string,
  googleRefreshToken: string,
  classId?: string
) {
  // Find classes to sync
  const classesToSync = await prisma.class.findMany({
    where: {
      schoolId,
      ...(classId ? { id: classId } : {}),
      googleCourseId: { not: null },
    },
  });

  let syncedClassesCount = 0;
  let totalStudentsAdded = 0;
  let totalStudentsSynced = 0;

  for (const c of classesToSync) {
    if (!c.googleCourseId) continue;

    try {
      const googleStudents = await fetchGoogleClassroomStudents(googleRefreshToken, c.googleCourseId);

      for (const gStudent of googleStudents) {
        const email = gStudent.profile.emailAddress.toLowerCase().trim();
        const fullName = gStudent.profile.name.fullName ||
          `${gStudent.profile.name.givenName} ${gStudent.profile.name.familyName}`.trim();
        const googleId = gStudent.userId;

        // Check if student exists in this school
        let user = await prisma.user.findUnique({
          where: {
            email_school_idx: {
              email,
              schoolId,
            },
          },
        });

        if (!user) {
          // Create new student
          const tempPassword = crypto.randomBytes(8).toString('hex');
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          user = await prisma.user.create({
            data: {
              schoolId,
              email,
              fullName,
              passwordHash,
              role: 'STUDENT',
              googleClassroomId: googleId,
            },
          });
          totalStudentsAdded++;
        } else if (!user.googleClassroomId) {
          // Link existing student
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleClassroomId: googleId },
          });
        }

        // Add to class roster if not enrolled
        const enrollment = await prisma.classStudent.findUnique({
          where: {
            classId_studentId: {
              classId: c.id,
              studentId: user.id,
            },
          },
        });

        if (!enrollment) {
          await prisma.classStudent.create({
            data: {
              classId: c.id,
              studentId: user.id,
            },
          });
        }

        totalStudentsSynced++;
      }
      syncedClassesCount++;
    } catch (err) {
      console.error(`Error syncing class ${c.name} (${c.id}) with Google Course ${c.googleCourseId}:`, err);
    }
  }

  // Update lastSyncTimestamp in SchoolConfig
  await prisma.schoolConfig.update({
    where: { schoolId },
    data: { lastSyncTimestamp: new Date() },
  });

  return {
    syncedClassesCount,
    totalStudentsAdded,
    totalStudentsSynced,
  };
}
