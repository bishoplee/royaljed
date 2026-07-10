'use client';

import React from 'react';
import { signOut } from 'next-auth/react';
import { useParams } from 'next/navigation';

export default function TutorDashboardPlaceholder() {
  const params = useParams();
  const schoolSlug = params?.schoolSlug || 'default';

  return (
    <div className="flex flex-col min-h-screen bg-surface font-sans">
      {/* Header */}
      <header className="bg-brandTealDeep text-white h-16 flex items-center justify-between px-6 md:px-12 w-full">
        <span className="font-bold text-sm tracking-tight uppercase">Royaljed Academy - Tutor Portal</span>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="text-xs font-semibold bg-brandGreen text-brandTealDeep px-4 py-2 rounded-full hover:bg-brandGreen/90 transition-all"
        >
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-canvas border border-slate/10 p-8 rounded-lg shadow-sm space-y-5">
          <div className="w-14 h-14 rounded-full bg-brandGreenSoft text-brandGreenDark flex items-center justify-center text-2xl mx-auto">
            🧑‍🏫
          </div>
          <h2 className="text-2xl font-medium tracking-tight text-ink">
            Tutor Dashboard
          </h2>
          <p className="text-slate text-sm leading-relaxed">
            The **Royaljed Tutor Portal** (Phase 8: Grading, Rubrics & Timeline Assessments) is currently scheduled for development in a later phase. 
          </p>
          <div className="pt-4 border-t border-slate/5 text-[11px] text-slate font-medium">
            Active Tenant Space: <span className="text-brandGreenDark font-bold">{schoolSlug}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
