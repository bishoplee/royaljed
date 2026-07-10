import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'TUTOR' | 'STUDENT';
    schoolId?: string | null;
    schoolSlug?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'TUTOR' | 'STUDENT';
      schoolId?: string | null;
      schoolSlug?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'TUTOR' | 'STUDENT';
    schoolId?: string | null;
    schoolSlug?: string | null;
  }
}
