import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session && session.user) {
    const role = session.user.role;
    if (role === 'SUPER_ADMIN') {
      redirect('/super-admin/dashboard');
    } else {
      const schoolSlug = session.user.schoolSlug || 'default';
      const dashboardRole = role.toLowerCase();
      
      const host = (await headers()).get('host') || '';
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

      if (isLocal) {
        redirect(`/${schoolSlug}/${dashboardRole}/dashboard`);
      } else {
        redirect(`https://${schoolSlug}.royaljed.com/${dashboardRole}/dashboard`);
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-ink font-sans">
      {/* Promo Banner */}
      <div className="bg-brandTealDeep text-white text-center py-2.5 px-4 text-xs font-semibold uppercase tracking-wider select-none">
        ✨ Welcome to Royaljed Academy Elocution Platform - Multi-Tenant Routing Active
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-canvas/90 backdrop-blur-md border-b border-surface/50 h-16 flex items-center justify-between px-6 md:px-12 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brandGreen flex items-center justify-center font-bold text-brandTealDeep">
            R
          </div>
          <span className="font-bold text-lg tracking-tight uppercase select-none">Royaljed Academy</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/signin"
            className="text-sm font-semibold text-slate hover:text-brandTealDeep transition-colors px-3 py-1.5 rounded-md"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="bg-brandGreen text-brandTealDeep text-sm font-bold px-5 py-2 rounded-full hover:bg-brandGreen/90 transition-all shadow-sm"
          >
            Try Free
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-brandTealDeep text-white py-20 md:py-32 px-6 md:px-12 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[80%] rounded-full bg-brandGreen/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-brandTeal/20 blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto flex flex-col items-center text-center relative z-10">
          <span className="text-brandGreen text-xs font-bold uppercase tracking-widest bg-brandGreen/10 px-3.5 py-1.5 rounded-full mb-6 border border-brandGreen/20">
            Diction & Elocution App
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-medium leading-[1.10] tracking-tight mb-8 max-w-4xl">
            One platform. <br />
            <span className="text-brandGreen font-semibold">Perfect elocution potential.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mb-10 leading-relaxed font-light">
            Replacing physical facilitators with a local, private digital suite. Teach with HLS streaming, drill with Waveform comparisons, and grade with expert-tutor rubrics.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link
              href="/auth/signup"
              className="bg-brandGreen text-brandTealDeep text-base font-bold px-8 py-3.5 rounded-full hover:scale-105 transition-transform duration-150 shadow-md text-center"
            >
              Get Started
            </Link>
            <Link
              href="/auth/signin"
              className="border border-white/20 text-white text-base font-bold px-8 py-3.5 rounded-full hover:bg-white/5 transition-colors text-center"
            >
              Access Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">
            The Core Practice Engine
          </h2>
          <p className="text-slate text-lg max-w-2xl mx-auto">
            Everything structured in a clean, self-hosted deployment tailored for schools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="bg-surface rounded-lg p-8 border border-slate/10 flex flex-col justify-between hover:border-brandGreenDark/30 transition-all duration-200 group">
            <div>
              <div className="w-12 h-12 rounded-lg bg-brandGreenSoft text-brandGreenDark flex items-center justify-center font-bold text-xl mb-6">
                1
              </div>
              <h3 className="text-xl font-medium mb-3 group-hover:text-brandGreenDark transition-colors">
                Teach & Stream
              </h3>
              <p className="text-slate text-sm leading-relaxed mb-6">
                Upload lessons and stream them securely. Encrypted dynamic HLS segment serving prevents direct downloads.
              </p>
            </div>
            <span className="text-xs font-semibold text-brandGreenDark group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              Learn More &rarr;
            </span>
          </div>

          {/* Card 2 */}
          <div className="bg-surface rounded-lg p-8 border border-slate/10 flex flex-col justify-between hover:border-brandGreenDark/30 transition-all duration-200 group">
            <div>
              <div className="w-12 h-12 rounded-lg bg-brandGreenSoft text-brandGreenDark flex items-center justify-center font-bold text-xl mb-6">
                2
              </div>
              <h3 className="text-xl font-medium mb-3 group-hover:text-brandGreenDark transition-colors">
                Record & Compare
              </h3>
              <p className="text-slate text-sm leading-relaxed mb-6">
                Tutor model recording triggers stacked canvas waveform overlays. Compare voice pitch, pace, and resonance in real-time.
              </p>
            </div>
            <span className="text-xs font-semibold text-brandGreenDark group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              Learn More &rarr;
            </span>
          </div>

          {/* Card 3 */}
          <div className="bg-surface rounded-lg p-8 border border-slate/10 flex flex-col justify-between hover:border-brandGreenDark/30 transition-all duration-200 group">
            <div>
              <div className="w-12 h-12 rounded-lg bg-brandGreenSoft text-brandGreenDark flex items-center justify-center font-bold text-xl mb-6">
                3
              </div>
              <h3 className="text-xl font-medium mb-3 group-hover:text-brandGreenDark transition-colors">
                Tutor Assessments
              </h3>
              <p className="text-slate text-sm leading-relaxed mb-6">
                No black-box AI grading. Tutors grade submissions using multi-metric rubrics with direct timestamped timeline feedback.
              </p>
            </div>
            <span className="text-xs font-semibold text-brandGreenDark group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              Learn More &rarr;
            </span>
          </div>

          {/* Card 4 */}
          <div className="bg-surface rounded-lg p-8 border border-slate/10 flex flex-col justify-between hover:border-brandGreenDark/30 transition-all duration-200 group">
            <div>
              <div className="w-12 h-12 rounded-lg bg-brandGreenSoft text-brandGreenDark flex items-center justify-center font-bold text-xl mb-6">
                4
              </div>
              <h3 className="text-xl font-medium mb-3 group-hover:text-brandGreenDark transition-colors">
                Multi-Tenant CRM
              </h3>
              <p className="text-slate text-sm leading-relaxed mb-6">
                Isolate schools with sub-slug domains. Sync rosters directly using built-in Google Classroom integrations.
              </p>
            </div>
            <span className="text-xs font-semibold text-brandGreenDark group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              Learn More &rarr;
            </span>
          </div>
        </div>
      </section>

      {/* Database/Infrastructure Section */}
      <section className="bg-brandGreenSoft/30 border-y border-brandGreenSoft/80 py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex-1">
            <span className="text-brandGreenDark text-xs font-semibold uppercase tracking-wider mb-2 block">
              System Architecture
            </span>
            <h2 className="text-3xl font-medium tracking-tight mb-6 text-brandTealDeep">
              Database initialized. Ready for PostgreSQL.
            </h2>
            <p className="text-slate mb-6 leading-relaxed">
              We have initialized standard model schema architectures to enforce database integrity across Schools, Users, Lessons, and Grades.
            </p>
            <ul className="space-y-3.5">
              <li className="flex items-center gap-2.5 text-sm font-medium text-brandTealDeep">
                <span className="w-5 h-5 rounded-full bg-brandGreenDark/10 text-brandGreenDark flex items-center justify-center text-xs">✓</span>
                Prisma ORM setup
              </li>
              <li className="flex items-center gap-2.5 text-sm font-medium text-brandTealDeep">
                <span className="w-5 h-5 rounded-full bg-brandGreenDark/10 text-brandGreenDark flex items-center justify-center text-xs">✓</span>
                PostgreSQL schema mappings configured
              </li>
              <li className="flex items-center gap-2.5 text-sm font-medium text-brandTealDeep">
                <span className="w-5 h-5 rounded-full bg-brandGreenDark/10 text-brandGreenDark flex items-center justify-center text-xs">✓</span>
                BullMQ + Redis background queues structured
              </li>
            </ul>
          </div>
          <div className="flex-1 w-full max-w-lg bg-canvasDark rounded-lg p-6 text-white border border-white/5 shadow-lg font-mono text-xs leading-normal">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-4">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-white/40 ml-2 select-none text-[10px]">database_init.sql</span>
            </div>
            <p className="text-brandGreen">{"// Prisma Schema Preview"}</p>
            <p className="text-white/60">datasource db &#123;</p>
            <p className="text-white/80">&nbsp;&nbsp;provider = <span className="text-yellow-400">&quot;postgresql&quot;</span></p>
            <p className="text-white/80">&nbsp;&nbsp;url&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= env(<span className="text-yellow-400">&quot;DATABASE_URL&quot;</span>)</p>
            <p className="text-white/60">&#125;</p>
            <p className="text-white/60">model School &#123;</p>
            <p className="text-white/80">&nbsp;&nbsp;id&nbsp;&nbsp;&nbsp;&nbsp;String @id @default(cuid())</p>
            <p className="text-white/80">&nbsp;&nbsp;name&nbsp;&nbsp;String</p>
            <p className="text-white/80">&nbsp;&nbsp;slug&nbsp;&nbsp;String @unique</p>
            <p className="text-white/60">&#125;</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brandTealDeep text-white/70 py-16 px-6 md:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-brandGreen flex items-center justify-center font-bold text-brandTealDeep text-xs">
              R
            </div>
            <span className="font-bold text-sm tracking-tight text-white select-none">ROYALJED ACADEMY</span>
          </div>
          <p className="text-xs text-white/40">
            &copy; 2026 Royaljed Academy. Built with Next.js and Prisma.
          </p>
        </div>
      </footer>
    </div>
  );
}
