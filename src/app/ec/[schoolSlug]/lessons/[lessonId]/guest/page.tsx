import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import GuestLessonPlayer from './GuestLessonPlayer';

interface GuestLessonPageProps {
  params: Promise<{ schoolSlug: string; lessonId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function GuestLessonPage({ params, searchParams }: GuestLessonPageProps) {
  const { schoolSlug, lessonId } = await params;
  const { token } = await searchParams;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { school: true } } },
  });

  if (!lesson || lesson.module.school.slug.toLowerCase() !== schoolSlug.toLowerCase()) {
    notFound();
  }

  const accessLink = token
    ? await prisma.accessLink.findUnique({
        where: { token },
      })
    : null;

  const isAuthorized = Boolean(
    accessLink &&
      accessLink.lessonId === lessonId &&
      accessLink.expiresAt > new Date() &&
      accessLink.viewCount < accessLink.maxViews
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-ink">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandTeal">Secure lesson access</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{lesson.description || 'This lesson has been shared with you through a secure access link.'}</p>
          </div>
          <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back home
          </Link>
        </div>

        {!token ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This lesson link is incomplete. Please use the full secure link shared by the instructor.
          </div>
        ) : !isAuthorized ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This secure lesson link is invalid, expired, or has already reached its view limit.
          </div>
        ) : (
          <GuestLessonPlayer
            title={lesson.title}
            description={lesson.description}
            streamUrl={`/api/ec/${schoolSlug}/lessons/${lessonId}/stream/index.m3u8?token=${encodeURIComponent(token)}`}
          />
        )}
      </div>
    </div>
  );
}
