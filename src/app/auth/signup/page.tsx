'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

interface SchoolBranding {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get('school') || '';

  // Form states
  const [registerNewSchool, setRegisterNewSchool] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolSlug, setSchoolSlug] = useState(schoolParam);
  const [schoolName, setSchoolName] = useState('');
  
  // UX states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [schoolBranding, setSchoolBranding] = useState<SchoolBranding | null>(null);

  // Automatically extract school slug from subdomain if present in production
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
      if (!isLocal) {
        const parts = host.split('.');
        if (parts.length >= 3 && parts[0] !== 'www') {
          setSchoolSlug(parts[0].toLowerCase());
          return;
        }
      }
    }
    if (schoolParam && !registerNewSchool) {
      setSchoolSlug(schoolParam);
    }
  }, [schoolParam, registerNewSchool]);

  // Dynamically load school branding if joining an existing school
  useEffect(() => {
    if (schoolSlug && !registerNewSchool) {
      fetch(`/api/schools/${schoolSlug.toLowerCase().trim()}`)
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
  }, [schoolSlug, registerNewSchool]);

  // Validate slug characters
  const handleSlugChange = (val: string) => {
    // Only letters, numbers, and hyphens allowed
    const formatted = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSchoolSlug(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Input Validation
    if (registerNewSchool && (!schoolName.trim() || !schoolSlug.trim())) {
      setError('School Name and School Slug are required to register.');
      setLoading(false);
      return;
    }
    if (!registerNewSchool && !schoolSlug.trim()) {
      setError('School Slug is required to join a school.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          schoolSlug: schoolSlug.trim(),
          registerNewSchool,
          schoolName: registerNewSchool ? schoolName.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess('Account created successfully! Logging you in...');

      // Auto login
      const loginRes = await signIn('credentials', {
        redirect: false,
        email,
        password,
        schoolSlug: schoolSlug.trim(),
      });

      if (loginRes?.error) {
        // Fallback if auto-login fails, redirect to signin
        setTimeout(() => {
          router.push(`/auth/signin?school=${schoolSlug}`);
        }, 1500);
      } else {
        // Successful login redirect
        setTimeout(() => {
          router.refresh();
          const host = window.location.host;
          const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
          const targetRole = registerNewSchool ? 'admin' : 'student';
          if (isLocal) {
            router.push(`/${schoolSlug}/${targetRole}/dashboard`);
          } else {
            const parts = host.split('.');
            const baseDomain = parts.length >= 3 ? parts.slice(1).join('.') : host;
            window.location.href = `https://${schoolSlug}.${baseDomain}/${targetRole}/dashboard`;
          }
        }, 1000);
      }

    } catch (err) {
      setError('Something went wrong. Please try again.');
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

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center px-4 py-16 bg-surface">
        <div className="w-full max-w-[500px] bg-canvas rounded-lg p-8 border border-slate/10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brandGreen/5 blur-[50px] pointer-events-none rounded-full" />
          
          <div className="flex flex-col items-center mb-8 text-center">
            <h2 className="text-2xl font-medium tracking-tight mb-2">
              Create your Account
            </h2>
            <p className="text-slate text-sm">
              Start perfecting your speech and elocution metrics.
            </p>

            {/* Pill Tab Switcher */}
            {!schoolParam && (
              <div className="flex bg-surface p-1 rounded-full border border-slate/10 mt-6 max-w-full">
                <button
                  type="button"
                  onClick={() => {
                    setRegisterNewSchool(false);
                    setError('');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                    !registerNewSchool 
                      ? 'bg-brandTealDeep text-white shadow-sm' 
                      : 'text-slate hover:text-brandTealDeep'
                  }`}
                >
                  Join a School
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterNewSchool(true);
                    setError('');
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                    registerNewSchool 
                      ? 'bg-brandTealDeep text-white shadow-sm' 
                      : 'text-slate hover:text-brandTealDeep'
                  }`}
                >
                  Register new School
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-800 text-xs leading-normal font-medium flex gap-3.5 items-start">
              <span className="text-sm select-none">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-md bg-brandGreenSoft border border-brandGreen/20 text-brandGreenDark text-xs leading-normal font-medium flex gap-3.5 items-start">
              <span className="text-sm select-none">✓</span>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New School Fields */}
            {registerNewSchool && (
              <>
                <div>
                  <label htmlFor="schoolName" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    School Name
                  </label>
                  <input
                    id="schoolName"
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Royaljed Academy Lekki"
                    className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="schoolSlug" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                    Custom School Slug URL
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate text-sm select-none">/ec/</span>
                    <input
                      id="schoolSlug"
                      type="text"
                      required
                      value={schoolSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="royaljed-lekki"
                      className="w-full text-input rounded-md pl-12 pr-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate mt-1.5 leading-normal">
                    This unique slug isolates your school&apos;s workspace (lowercase letters, numbers, hyphens).
                  </p>
                </div>
              </>
            )}

            {/* Join Existing School Field */}
            {!registerNewSchool && (
              <div>
                <label htmlFor="schoolSlug" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  School Slug {schoolParam && <span className="text-[10px] text-brandGreenDark font-normal">(Preset)</span>}
                </label>
                <input
                  id="schoolSlug"
                  type="text"
                  required
                  value={schoolSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="e.g. royaljed-demo"
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={!!schoolParam || (schoolSlug !== '' && typeof window !== 'undefined' && window.location.host.split('.').length >= 3 && !window.location.host.includes('localhost') && window.location.host.split('.')[0] !== 'www')}
                />
                {!schoolParam && (
                  <p className="text-[11px] text-slate mt-1.5 leading-normal">
                    Enter the school identifier slug provided by your coordinator.
                  </p>
                )}
              </div>
            )}

            {/* Personal Details */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Johnson"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
              />
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
              <label htmlFor="password" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brandGreen text-brandTealDeep font-bold py-3 rounded-full hover:bg-brandGreen/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm mt-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-brandTealDeep" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Registering...</span>
                </>
              ) : (
                registerNewSchool ? 'Register School & Admin' : 'Join as Student'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate/10 text-center text-xs text-slate">
            Already have an account?{' '}
            <Link 
              href={`/auth/signin${schoolSlug ? `?school=${schoolSlug}` : ''}`} 
              className="text-brandGreenDark font-semibold hover:underline"
            >
              Sign In
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

export default function SignUp() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-pulse text-slate text-sm font-medium">Loading Sign Up...</div>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
