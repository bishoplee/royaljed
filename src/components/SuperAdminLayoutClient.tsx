'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface SuperAdminLayoutClientProps {
  user: { name: string; email: string };
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: '🏠' },
];

export function SuperAdminLayoutClient({ user, children }: SuperAdminLayoutClientProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className="flex min-h-screen bg-canvas font-sans">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-brandTealDeep text-white border-r border-white/10">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/10 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-brandGreen flex items-center justify-center font-bold text-brandTealDeep text-sm">
            R
          </div>
          <div className="leading-none">
            <p className="font-bold text-sm tracking-tight">Royaljed</p>
            <p className="text-[10px] text-white/50 font-medium uppercase tracking-wider mt-0.5">
              Super Admin
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(item.href)
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/10 space-y-1">
          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
          <p className="text-[10px] text-white/40 truncate">{user.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="mt-3 w-full text-left text-[11px] font-semibold text-white/50 hover:text-white transition-colors py-1"
          >
            Sign out →
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 h-14 bg-brandTealDeep text-white flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brandGreen flex items-center justify-center font-bold text-brandTealDeep text-xs">
            R
          </div>
          <span className="font-bold text-sm tracking-tight">Super Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Toggle menu"
        >
          <span className="text-xl leading-none">{mobileMenuOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-brandTealDeep text-white flex flex-col pt-14">
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-white/10">
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="text-[11px] font-semibold text-white/50 hover:text-white transition-colors"
              >
                Sign out →
              </button>
            </div>
          </div>
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-14 shrink-0" />
        <div className="flex-1 px-5 md:px-8 py-8 max-w-6xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
