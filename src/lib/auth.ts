import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        schoolSlug: { label: 'School Slug', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password');
        }

        const { email, password, schoolSlug } = credentials;

        let user = null;

        if (schoolSlug && schoolSlug.trim() !== '') {
          // Find school
          const school = await prisma.school.findUnique({
            where: { slug: schoolSlug.trim().toLowerCase() },
          });

          if (!school) {
            throw new Error('School tenant space not found');
          }

          // Find user within that school
          user = await prisma.user.findUnique({
            where: {
              email_school_idx: {
                email: email.toLowerCase().trim(),
                schoolId: school.id,
              },
            },
            include: {
              school: true,
            },
          });
        } else {
          // If no school slug, attempt to find a Super Admin
          user = await prisma.user.findFirst({
            where: {
              email: email.toLowerCase().trim(),
              schoolId: null,
            },
            include: {
              school: true,
            },
          });

          if (!user) {
            // User-friendly fallback: find if user exists in exactly one school
            const users = await prisma.user.findMany({
              where: { email: email.toLowerCase().trim() },
              include: { school: true },
            });

            if (users.length === 1) {
              user = users[0];
            } else if (users.length > 1) {
              throw new Error('Multiple school spaces found. Please specify your School Slug.');
            }
          }
        }

        if (!user) {
          throw new Error('Invalid email or password');
        }

        if (user.status === 'SUSPENDED') {
          throw new Error('Your account has been suspended');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          schoolId: user.schoolId,
          schoolSlug: user.school?.slug || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.schoolId = user.schoolId;
        token.schoolSlug = user.schoolSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.schoolId = token.schoolId;
        session.user.schoolSlug = token.schoolSlug;
      }
      return session;
    },
  },
};
