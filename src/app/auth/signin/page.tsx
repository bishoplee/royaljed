'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface SchoolBranding {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const schoolParam = searchParams.get('school') || '';
  const errorParam = searchParams.get('error') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolSlug, setSchoolSlug] = useState(schoolParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [schoolBranding, setSchoolBranding] = useState<SchoolBranding | null>(null);

  // Parse errors from Next-Auth redirects
  useEffect(() => {
    if (errorParam) {
      if (errorParam === 'CredentialsSignin') {
        setError('Invalid email, password, or school slug.');
      } else if (errorParam === 'AccessDenied') {
        setError('You do not have permission to access this page.');
      } else {
        setError(errorParam);
      }
    }
  }, [errorParam]);

  // Dynamically load school branding if slug is present
  useEffect(() => {
    const slugToFetch = schoolSlug || schoolParam;
    if (slugToFetch) {
      fetch(`/api/schools/${slugToFetch.toLowerCase().trim()}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Not found');
        })
        .then((data) => {
          setSchoolBranding({
            name: data.name,
            logoUrl: data.logoUrl,
            brandColor: data.brandColor || '#001E2B',
          });
        })
        .catch(() => {
          setSchoolBranding(null);
        });
    } else {
      setSchoolBranding(null);
    }
  }, [schoolSlug, schoolParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        schoolSlug: schoolSlug.trim(),
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        // Successful login, redirect to callbackUrl or home
        router.refresh();
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-ink font-sans">
      {/* Promo Banner */}
      <div 
        className="text-white text-center py-2.5 px-4 text-xs font-semibold uppercase tracking-wider select-none transition-colors duration-300"
        style={{ backgroundColor: schoolBranding?.brandColor || '#001E2B' }}
      >
        ✨ {schoolBranding ? `${schoolBranding.name} Portal` : 'Royaljed Academy Diction & Elocution App'}
      </div>

      {/* Main Center Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-16 bg-surface">
        <div className="w-full max-w-[460px] bg-canvas rounded-lg p-8 border border-slate/10 shadow-sm relative overflow-hidden">
          {/* Subtle Glow Overlay */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-brandGreen/5 blur-[50px] pointer-events-none rounded-full" />
          
          <div className="flex flex-col items-center mb-8 text-center">
            {schoolBranding?.logoUrl ? (
              <img 
                src={schoolBranding.logoUrl} 
                alt={schoolBranding.name} 
                className="w-14 h-14 rounded-lg object-contain mb-4 border border-slate/10" 
              />
            ) : (
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl mb-4 transition-colors duration-300 text-brandTealDeep"
                style={{ backgroundColor: schoolBranding?.brandColor === '#001E2B' ? '#00ED64' : '#00ED64' }}
              >
                {schoolBranding ? schoolBranding.name.charAt(0).toUpperCase() : 'R'}
              </div>
            )}
            
            <h2 className="text-2xl font-medium tracking-tight mb-2">
              {schoolBranding ? `Sign in to ${schoolBranding.name}` : 'Welcome Back'}
            </h2>
            <p className="text-slate text-sm">
              {schoolBranding 
                ? 'Access your lessons, practices, and grades' 
                : 'Enter your credentials to access the elocution suite'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-800 text-xs leading-normal font-medium flex gap-3.5 items-start">
              <span className="text-sm select-none">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="schoolSlug" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                School Space Slug {schoolParam && <span className="text-[10px] text-brandGreenDark font-normal">(Preset)</span>}
              </label>
              <input
                id="schoolSlug"
                type="text"
                value={schoolSlug}
                onChange={(e) => setSchoolSlug(e.target.value)}
                placeholder="e.g. royaljed-demo"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
                disabled={!!schoolParam}
              />
              {!schoolParam && (
                <p className="text-[11px] text-slate mt-1.5 leading-normal">
                  Leave blank if logging in as a global Super Administrator.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.com"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-slate uppercase tracking-wider">
                  Password
                </label>
                <Link href="/auth/forgot" className="text-xs text-brandGreenDark hover:underline font-medium">
                  Forgot?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brandGreen text-brandTealDeep font-bold py-3 rounded-full hover:bg-brandGreen/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm mt-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-brandTealDeep" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate/10 text-center text-xs text-slate">
            Don&apos;t have an account?{' '}
            <Link 
              href={`/auth/signup${schoolSlug ? `?school=${schoolSlug}` : ''}`} 
              className="text-brandGreenDark font-semibold hover:underline"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* Mini Footer */}
      <footer className="py-6 text-center text-xs text-slate bg-canvas border-t border-slate/5">
        &copy; {new Date().getFullYear()} Royaljed Academy. All rights reserved.
      </footer>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-pulse text-slate text-sm font-medium">Loading Sign In...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
