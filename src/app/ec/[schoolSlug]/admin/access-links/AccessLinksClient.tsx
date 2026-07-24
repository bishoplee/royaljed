'use client';

import { useState, useMemo } from 'react';

interface AccessLink {
  id: string;
  token: string;
  maxViews: number;
  viewCount: number;
  expiresAt: string;
  createdAt: string;
  lesson: {
    id: string;
    title: string;
    module: { id: string; title: string };
  };
  student: { id: string; fullName: string; email: string } | null;
}

interface AccessLinksClientProps {
  schoolSlug: string;
  initialLinks: AccessLink[];
}

function getLinkStatus(link: AccessLink): 'active' | 'expired' | 'exhausted' {
  if (link.viewCount >= link.maxViews) return 'exhausted';
  if (new Date(link.expiresAt) <= new Date()) return 'expired';
  return 'active';
}

const STATUS_STYLES = {
  active: 'bg-brandGreenSoft text-brandGreenDark',
  expired: 'bg-slate/10 text-slate',
  exhausted: 'bg-red-50 text-red-700',
};

const STATUS_LABELS = {
  active: 'Active',
  expired: 'Expired',
  exhausted: 'Exhausted',
};

function buildGuestUrl(schoolSlug: string, lessonId: string, token: string) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/ec/${schoolSlug}/lessons/${lessonId}/guest?token=${token}`;
}

export default function AccessLinksClient({
  schoolSlug,
  initialLinks,
}: AccessLinksClientProps) {
  const [links, setLinks] = useState<AccessLink[]>(initialLinks);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'expired' | 'exhausted'>('ALL');
  const [lessonFilter, setLessonFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const lessonOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of links) map.set(l.lesson.id, l.lesson.title);
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [links]);

  const filtered = useMemo(() => {
    return links.filter((l) => {
      if (statusFilter !== 'ALL' && getLinkStatus(l) !== statusFilter) return false;
      if (lessonFilter !== 'ALL' && l.lesson.id !== lessonFilter) return false;
      return true;
    });
  }, [links, statusFilter, lessonFilter]);

  const counts = useMemo(
    () => ({
      ALL: links.length,
      active: links.filter((l) => getLinkStatus(l) === 'active').length,
      expired: links.filter((l) => getLinkStatus(l) === 'expired').length,
      exhausted: links.filter((l) => getLinkStatus(l) === 'exhausted').length,
    }),
    [links]
  );

  async function handleCopy(link: AccessLink) {
    const url = buildGuestUrl(schoolSlug, link.lesson.id, link.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }

  async function handleRevoke(link: AccessLink) {
    if (!confirm(`Revoke this link for "${link.lesson.title}"? This cannot be undone.`)) return;
    setRevokingId(link.id);
    try {
      const res = await fetch(
        `/api/ec/${schoolSlug}/admin/access-links?linkId=${link.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== link.id));
      } else {
        alert('Failed to revoke link. Please try again.');
      }
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight text-ink">Access Links</h2>
        <p className="text-slate text-sm mt-1">
          All secure lesson access links generated for this school. Copy or revoke from here.
        </p>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {(['ALL', 'active', 'expired', 'exhausted'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === s
                ? 'bg-brandTealDeep text-white border-brandTealDeep shadow-sm'
                : 'bg-canvas text-slate border-slate/20 hover:border-brandTealDeep/40 hover:text-ink'
            }`}
          >
            {s === 'ALL' ? 'All' : STATUS_LABELS[s]}{' '}
            <span className="ml-1 opacity-70">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Lesson Filter */}
      <div>
        <select
          value={lessonFilter}
          onChange={(e) => setLessonFilter(e.target.value)}
          className="border border-slate/20 rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:ring-2 focus:ring-brandGreenDark/30 max-w-xs"
        >
          <option value="ALL">All Lessons</option>
          {lessonOptions.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-canvas border border-slate/10 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate text-sm">
            <div className="text-3xl mb-3">🔗</div>
            No access links found for the selected filter.
            {counts.ALL === 0 && (
              <p className="mt-2 text-xs text-slate/60">
                Create links from the lesson editor inside the Curriculum section.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate/10 text-slate uppercase tracking-wider text-[10px] font-bold bg-surface">
                  <th className="px-5 py-3">Lesson / Module</th>
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-5 py-3">Token</th>
                  <th className="px-5 py-3 text-center">Views</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5">
                {filtered.map((link) => {
                  const status = getLinkStatus(link);
                  return (
                    <tr key={link.id} className="hover:bg-surface/60 transition-colors">
                      <td className="px-5 py-3.5 max-w-[200px]">
                        <p className="font-semibold text-ink truncate">{link.lesson.title}</p>
                        <p className="text-slate/60 text-[10px] mt-0.5 truncate">
                          {link.lesson.module.title}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        {link.student ? (
                          <div>
                            <p className="font-medium text-ink">{link.student.fullName}</p>
                            <p className="text-slate/60 text-[10px]">{link.student.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate/50 italic text-[11px]">Open / Guest</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate text-[10px]">
                        {link.token.slice(0, 12)}…
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`font-semibold ${
                            link.viewCount >= link.maxViews ? 'text-red-600' : 'text-ink'
                          }`}
                        >
                          {link.viewCount}
                        </span>
                        <span className="text-slate/50"> / {link.maxViews}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate whitespace-nowrap">
                        {new Date(link.expiresAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-slate whitespace-nowrap">
                        {new Date(link.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[status]}`}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {status === 'active' && (
                            <button
                              onClick={() => handleCopy(link)}
                              className="text-[10px] font-semibold text-brandGreenDark hover:underline whitespace-nowrap transition-colors"
                            >
                              {copiedId === link.id ? '✓ Copied!' : 'Copy URL'}
                            </button>
                          )}
                          <button
                            onClick={() => handleRevoke(link)}
                            disabled={revokingId === link.id}
                            className="text-[10px] font-semibold text-red-500 hover:text-red-700 hover:underline whitespace-nowrap transition-colors disabled:opacity-40"
                          >
                            {revokingId === link.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate/60 text-right">
        Showing {filtered.length} of {links.length} total links.
      </p>
    </div>
  );
}
