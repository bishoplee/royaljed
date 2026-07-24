'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface SchoolData {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
}

interface SessionUser {
  name: string;
  email: string;
  role: string;
}

interface AdminLayoutClientProps {
  school: SchoolData;
  user: SessionUser;
  children: React.ReactNode;
}

const resolveLogoUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.startsWith('/uploads/logos/')) {
    return url.replace('/uploads/logos/', '/api/uploads/logos/');
  }
  return url;
};

function isNavItemActive(pathname: string | null, targetHref: string, schoolSlug: string): boolean {
  if (!pathname) return false;

  const normalize = (path: string) => {
    let p = path.toLowerCase().split('?')[0].split('#')[0];
    if (p.endsWith('/') && p.length > 1) {
      p = p.slice(0, -1);
    }
    if (p.startsWith('/ec')) {
      p = p.substring(3);
    }
    if (schoolSlug && p.startsWith(`/${schoolSlug.toLowerCase()}`)) {
      p = p.substring(schoolSlug.length + 1);
    }
    return p || '/';
  };

  const current = normalize(pathname);
  const target = normalize(targetHref);

  if (target === '/admin/dashboard' || target === '/admin') {
    return current === '/admin/dashboard' || current === '/admin';
  }

  return current === target || current.startsWith(`${target}/`);
}

export function AdminLayoutClient({ school, user, children }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const brandColor = school.brandColor || '#001E2B';

  const navItems = [
    {
      name: 'Dashboard',
      href: `/${school.slug}/admin/dashboard`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      name: 'Classes',
      href: `/${school.slug}/admin/classes`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      name: 'Curriculum',
      href: `/${school.slug}/admin/curriculum`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      name: 'Assignments',
      href: `/${school.slug}/admin/assignments`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5h6m-7 4h8m-8 4h5m-4 8h10a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Submissions',
      href: `/${school.slug}/admin/submissions`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      name: 'Students',
      href: `/${school.slug}/admin/students`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      name: 'Tutors',
      href: `/${school.slug}/admin/tutors`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Progress',
      href: `/${school.slug}/admin/progress`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Access Links',
      href: `/${school.slug}/admin/access-links`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      name: 'Branding & Settings',
      href: `/${school.slug}/admin/settings`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen bg-surface">
      <style dangerouslySetInnerHTML={{ __html: `:root { --brand-primary: ${brandColor}; }` }} />

      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 h-screen sticky top-0 bg-brandTealDeep text-white border-r border-white/5 flex-shrink-0 overflow-y-auto no-scrollbar">
        <div className="h-16 flex items-center px-6 border-b border-white/5 gap-3">
          {school.logoUrl ? (
            <img src={resolveLogoUrl(school.logoUrl)} alt={school.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brandGreen flex items-center justify-center font-bold text-brandTealDeep">
              {school.name.charAt(0)}
            </div>
          )}
          <span className="font-bold text-sm tracking-tight truncate max-w-[170px] uppercase">
            {school.name}
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href, school.slug);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brandGreen text-brandTealDeep font-bold shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold uppercase text-brandGreen">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-brandTealDeep/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative flex flex-col w-full max-w-xs bg-brandTealDeep text-white border-r border-white/5 shadow-2xl animate-slide-in">
            <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                {school.logoUrl ? (
                  <img src={resolveLogoUrl(school.logoUrl)} alt={school.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brandGreen flex items-center justify-center font-bold text-brandTealDeep">
                    {school.name.charAt(0)}
                  </div>
                )}
                <span className="font-bold text-sm tracking-tight truncate max-w-[170px] uppercase">
                  {school.name}
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-white/80 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href, school.slug);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-brandGreen text-brandTealDeep font-bold shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/5">
              <div className="flex items-center gap-3 px-2 py-1.5">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold uppercase text-brandGreen">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-white/40 truncate">{user.email}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-canvas border-b border-slate/10 h-16 flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-lg hover:bg-surface flex items-center justify-center border border-slate/10 text-slate"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-medium text-ink tracking-tight capitalize select-none hidden sm:block">
              School Management Panel
            </h1>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-4 relative">
            {/* Active School Badge */}
            <div className="hidden lg:flex items-center gap-2 border border-slate/10 bg-surface px-3 py-1.5 rounded-full text-xs font-semibold text-slate">
              <span className="w-2 h-2 rounded-full bg-brandGreen animate-pulse" />
              <span>Admin: {school.slug}</span>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-10 h-10 rounded-full border border-slate/10 bg-surface hover:bg-slate/5 transition-all flex items-center justify-center text-sm font-bold text-brandTealDeep uppercase select-none"
              >
                {user.name.charAt(0)}
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2.5 w-56 bg-canvas border border-slate/10 rounded-lg shadow-lg py-2.5 z-30 animate-fade-in font-sans">
                    <div className="px-4 py-2 border-b border-slate/5 mb-2">
                      <p className="text-sm font-semibold text-ink truncate">{user.name}</p>
                      <p className="text-xs text-slate truncate">{user.email}</p>
                      <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brandGreenSoft text-brandGreenDark tracking-wider uppercase">
                        {user.role}
                      </span>
                    </div>
                    <Link
                      href={`/ec/${school.slug}/admin/settings`}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate hover:text-brandTealDeep hover:bg-surface transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      Settings & Theme
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        signOut({ callbackUrl: '/auth/signin' });
                      }}
                      className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate/5 mt-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Inner Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
