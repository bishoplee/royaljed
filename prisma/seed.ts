import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database for Royaljed Academy...');

  // 1. Clean existing records in reverse dependency order
  console.log('Cleaning existing data...');
  await prisma.auditLog.deleteMany({});
  await prisma.schoolConfig.deleteMany({});
  await prisma.practiceSession.deleteMany({});
  await prisma.timestampedFeedback.deleteMany({});
  await prisma.grade.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.accessLink.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.module.deleteMany({});
  await prisma.classStudent.deleteMany({});
  await prisma.classTutor.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.school.deleteMany({});

  console.log('Data cleaned.');

  // 2. Hash default password
  const defaultPassword = 'password123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 3. Create demo school
  console.log('Creating demo school...');
  const school = await prisma.school.create({
    data: {
      name: 'Royaljed Demo School',
      slug: 'royaljed-demo',
      logoUrl: null,
      brandColor: '#001E2B',
      address: '123 Diction Way, Lagos, Nigeria',
      phone: '+234 800 000 0000',
      contactEmail: 'demo@royaljed.com',
      website: 'https://royaljed.com',
      pricingPlan: 'trial',
      subscriptionStatus: 'active',
    },
  });

  // Create school config
  await prisma.schoolConfig.create({
    data: {
      schoolId: school.id,
      gclassSyncEnabled: false,
      autoSyncIntervalHours: 24,
      allowStudentLeaderboard: true,
    },
  });

  console.log(`School created with ID: ${school.id}`);

  // 4. Create Users (RBAC)
  console.log('Creating users...');

  // A. Super Admin (Global - no school)
  const superAdmin = await prisma.user.create({
    data: {
      fullName: 'Super Admin User',
      email: 'superadmin@royaljed.com',
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`Super Admin created: ${superAdmin.email}`);

  // B. School Admin
  const schoolAdmin = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: 'Demo School Admin',
      email: 'admin@royaljed.com',
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`School Admin created: ${schoolAdmin.email} for school: ${school.slug}`);

  // C. Tutor
  const tutor = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: 'Dr. Jane Smith (Tutor)',
      email: 'tutor@royaljed.com',
      passwordHash,
      role: Role.TUTOR,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`Tutor created: ${tutor.email} for school: ${school.slug}`);

  // D. Student
  const student = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: 'Alex Johnson (Student)',
      email: 'student@royaljed.com',
      passwordHash,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`Student created: ${student.email} for school: ${school.slug}`);

  console.log('\nSeeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Credentials for all accounts:');
  console.log('Password for all users: password123');
  console.log('School Slug for non-superadmins: royaljed-demo');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
