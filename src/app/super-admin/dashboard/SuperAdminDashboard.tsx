'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface School {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  pricingPlan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  userCount: number;
  moduleCount: number;
  gclassSync: boolean;
}

interface Stats {
  totalSchools: number;
  totalUsers: number;
  totalModules: number;
  totalSubmissions: number;
}

interface Props {
  schools: School[];
  stats: Stats;
}

const PLAN_STYLES: Record<string, string> = {
  trial: 'bg-amber-50 text-amber-700 border-amber-200',
  basic: 'bg-sky-50 text-sky-700 border-sky-200',
  pro: 'bg-purple-50 text-purple-700 border-purple-200',
  enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-brandGreenSoft text-brandGreenDark',
  suspended: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate/10 text-slate',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isTrialExpired(trialEndsAt: string | null) {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) < new Date();
}

export default function SuperAdminDashboard({ schools, stats }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Add school form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [pricingPlan, setPricingPlan] = useState('trial');
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [trialDays, setTrialDays] = useState('30');
  const [brandColor, setBrandColor] = useState('#001E2B');

  const [createAdminAccount, setCreateAdminAccount] = useState(true);
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleNameChange = (val: string) => {
    setName(val);
    // Auto-generate slug if user hasn't manually edited slug too much
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    setSlug(autoSlug);
  };

  const handleSlugChange = (val: string) => {
    const formatted = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(formatted);
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setPricingPlan('trial');
    setSubscriptionStatus('active');
    setTrialDays('30');
    setBrandColor('#001E2B');
    setCreateAdminAccount(true);
    setAdminFullName('');
    setAdminEmail('');
    setAdminPassword('');
    setError('');
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/super-admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          pricingPlan,
          subscriptionStatus,
          trialDays: trialDays ? parseInt(trialDays, 10) : 0,
          brandColor,
          createAdminAccount,
          adminFullName: createAdminAccount ? adminFullName : undefined,
          adminEmail: createAdminAccount ? adminEmail : undefined,
          adminPassword: createAdminAccount ? adminPassword : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create school.');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(`School "${data.school.name}" created successfully!`);
      resetForm();
      setIsModalOpen(false);
      router.refresh();

      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = [
    { label: 'Schools', value: stats.totalSchools, icon: '🏫', color: 'bg-sky-50 border-sky-100' },
    { label: 'Users', value: stats.totalUsers, icon: '👥', color: 'bg-purple-50 border-purple-100' },
    { label: 'Modules', value: stats.totalModules, icon: '📚', color: 'bg-amber-50 border-amber-100' },
    { label: 'Submissions', value: stats.totalSubmissions, icon: '📝', color: 'bg-emerald-50 border-emerald-100' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Platform Overview</h1>
          <p className="text-slate text-sm mt-1">All schools and tenants across the Royaljed platform.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-brandTealDeep text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-brandTealDeep/90 transition-all flex items-center gap-2 shadow-sm"
        >
          <span className="text-sm font-bold">+</span> Add New School
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-brandGreenSoft text-brandGreenDark border border-brandGreen/30 px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-5 ${c.color}`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-3xl font-bold text-ink">{c.value.toLocaleString()}</div>
            <div className="text-xs font-semibold text-slate uppercase tracking-wide mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Schools Table */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h2 className="text-base font-semibold text-ink">Schools ({filtered.length})</h2>
          <input
            type="search"
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate/20 rounded-lg px-3 py-2 text-sm bg-canvas text-ink placeholder:text-slate/40 focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30 w-64"
          />
        </div>

        <div className="bg-canvas border border-slate/10 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate text-sm">
              <div className="text-3xl mb-3">🏫</div>
              No schools found{search ? ' matching your search' : ''}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-slate/10 text-slate uppercase tracking-wider text-[10px] font-bold bg-surface">
                    <th className="px-5 py-3">School</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-center">Users</th>
                    <th className="px-5 py-3 text-center">Modules</th>
                    <th className="px-5 py-3">Trial Ends</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate/5">
                  {filtered.map((school) => {
                    const planStyle = PLAN_STYLES[school.pricingPlan ?? 'trial'] ?? PLAN_STYLES.trial;
                    const statusStyle = STATUS_STYLES[school.subscriptionStatus ?? 'active'] ?? STATUS_STYLES.active;
                    const trialExpired = isTrialExpired(school.trialEndsAt);
                    return (
                      <tr key={school.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: school.brandColor ?? '#001E2B' }}
                            >
                              {school.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-ink">{school.name}</p>
                              <p className="text-slate/60 text-[10px] font-mono">{school.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${planStyle}`}>
                            {(school.pricingPlan ?? 'trial').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle}`}>
                            {(school.subscriptionStatus ?? 'active').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-semibold text-ink">
                          {school.userCount}
                        </td>
                        <td className="px-5 py-3.5 text-center font-semibold text-ink">
                          {school.moduleCount}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {school.trialEndsAt ? (
                            <span className={trialExpired ? 'text-red-600 font-semibold' : 'text-slate'}>
                              {formatDate(school.trialEndsAt)}
                              {trialExpired && <span className="ml-1 text-[9px]">EXPIRED</span>}
                            </span>
                          ) : (
                            <span className="text-slate/40">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate whitespace-nowrap">
                          {formatDate(school.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/ec/${school.slug}/admin/dashboard`}
                            className="text-[10px] font-semibold text-brandGreenDark hover:underline whitespace-nowrap"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add New School Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-canvas border border-slate/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate/10 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">Add New School Tenant</h3>
                <p className="text-xs text-slate mt-0.5">Provision a new school workspace manually.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate hover:text-ink text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 rounded-lg text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSchool} className="space-y-4 text-xs">
              {/* School Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">School Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royaljed Academy"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">School Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. royaljed-academy"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                  />
                  <p className="text-[10px] text-slate/60 mt-1 truncate">
                    URL: <span className="font-mono">{slug ? `${slug}.royaljed.com` : 'slug.royaljed.com'}</span>
                  </p>
                </div>
              </div>

              {/* Plan & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Pricing Plan</label>
                  <select
                    value={pricingPlan}
                    onChange={(e) => setPricingPlan(e.target.value)}
                    className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                  >
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Trial Period</label>
                  <select
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                  >
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days</option>
                    <option value="0">No Trial</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Status</label>
                  <select
                    value={subscriptionStatus}
                    onChange={(e) => setSubscriptionStatus(e.target.value)}
                    className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Brand Color */}
              <div>
                <label className="block font-semibold text-ink mb-1">Brand Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    placeholder="#001E2B"
                    className="w-28 border border-slate/20 rounded-lg px-3 py-1.5 bg-canvas text-ink font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                  />
                </div>
              </div>

              {/* Initial Admin Account Section */}
              <div className="border-t border-slate/10 pt-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={createAdminAccount}
                    onChange={(e) => setCreateAdminAccount(e.target.checked)}
                    className="rounded text-brandTealDeep focus:ring-brandGreenDark"
                  />
                  Create Initial School Administrator Account
                </label>

                {createAdminAccount && (
                  <div className="bg-surface/50 p-3 rounded-lg border border-slate/10 space-y-3">
                    <div>
                      <label className="block font-semibold text-ink mb-1">Admin Full Name *</label>
                      <input
                        type="text"
                        required={createAdminAccount}
                        placeholder="e.g. Dr. John Doe"
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-ink mb-1">Admin Email *</label>
                        <input
                          type="email"
                          required={createAdminAccount}
                          placeholder="admin@school.com"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-ink mb-1">Password *</label>
                        <input
                          type="password"
                          required={createAdminAccount}
                          placeholder="••••••••"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="w-full border border-slate/20 rounded-lg px-3 py-2 bg-canvas text-ink text-xs focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brandTealDeep text-white px-5 py-2 rounded-lg text-xs font-semibold hover:bg-brandTealDeep/90 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
