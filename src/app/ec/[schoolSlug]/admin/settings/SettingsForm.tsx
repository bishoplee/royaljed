'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SchoolConfigData {
  gclassSyncEnabled: boolean;
  allowStudentLeaderboard: boolean;
  googleRefreshToken?: string | null;
}

interface SchoolData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  address: string | null;
  phone: string | null;
  contactEmail: string | null;
  website: string | null;
  schoolConfig: SchoolConfigData | null;
}

const resolveLogoUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.startsWith('/uploads/logos/')) {
    return url.replace('/uploads/logos/', '/api/uploads/logos/');
  }
  return url;
};

interface SettingsFormProps {
  school: SchoolData;
}

export function SettingsForm({ school }: SettingsFormProps) {
  const router = useRouter();

  // Inputs
  const [name, setName] = useState(school.name);
  const [logoUrl, setLogoUrl] = useState(school.logoUrl || '');
  const [brandColor, setBrandColor] = useState(school.brandColor || '#001E2B');
  const [address, setAddress] = useState(school.address || '');
  const [phone, setPhone] = useState(school.phone || '');
  const [contactEmail, setContactEmail] = useState(school.contactEmail || '');
  const [website, setWebsite] = useState(school.website || '');
  const [allowStudentLeaderboard, setAllowStudentLeaderboard] = useState(
    school.schoolConfig?.allowStudentLeaderboard ?? true
  );
  const [gclassSyncEnabled, setGclassSyncEnabled] = useState(
    school.schoolConfig?.gclassSyncEnabled ?? false
  );

  // States
  const [loading, setLoading] = useState(false);
  const [syncingRosters, setSyncingRosters] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(!!school.schoolConfig?.googleRefreshToken);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto Sync display toggle (visually hidden by default)
  const [showAutoSync, setShowAutoSync] = useState(false);

  // Logo upload state
  const [logoMode, setLogoMode] = useState<'url' | 'upload'>(
    school.logoUrl && (school.logoUrl.startsWith('http://') || school.logoUrl.startsWith('https://')) ? 'url' : 'upload'
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Toasts state
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }[]>([]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/ec/${school.slug}/admin/settings/upload-logo`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload logo.');

      setLogoUrl(data.url);
      showToast('success', 'Logo image uploaded successfully!');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };


  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 15000);
  };


  const handleConnectGoogle = () => {
    window.location.href = `/api/ec/${school.slug}/admin/google/auth`;
  };

  const handleSyncRosters = async () => {
    setSyncingRosters(true);
    try {
      const res = await fetch(`/api/ec/${school.slug}/admin/google/sync-roster`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync rosters.');
      
      if (data.syncedClassesCount === 0) {
        showToast(
          'warning',
          `Google Classroom synced, but no active courses were found. Check your Classroom courses.`
        );
      } else {
        showToast(
          'success',
          `Google Classroom roster synced! Synced ${data.syncedClassesCount} classes, added ${data.totalStudentsAdded} students, total ${data.totalStudentsSynced} active enrollments.`
        );
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to sync rosters.');
    } finally {
      setSyncingRosters(false);
    }
  };


  const colorPresets = [
    { name: 'Deep Teal', value: '#001E2B' },
    { name: 'Royal Emerald', value: '#00684A' },
    { name: 'Indigo Premium', value: '#312E81' },
    { name: 'Slate Dark', value: '#0F172A' },
    { name: 'Midnight Purple', value: '#4C1D95' },
    { name: 'Crimson Red', value: '#991B1B' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/ec/${school.slug}/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          brandColor,
          logoUrl: logoUrl.trim() === '' ? null : logoUrl,
          address: address.trim() === '' ? null : address,
          phone: phone.trim() === '' ? null : phone,
          contactEmail: contactEmail.trim() === '' ? null : contactEmail,
          website: website.trim() === '' ? null : website,
          allowStudentLeaderboard,
          gclassSyncEnabled,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update settings');
        setLoading(false);
        return;
      }

      setSuccess('Settings updated successfully!');
      setLoading(false);
      
      // Refresh school layout branding details
      router.refresh();

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Forms Section */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Status Alerts */}
        {error && (
          <div className="p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-800 text-xs font-medium flex gap-3 items-center">
            <span className="text-sm select-none">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-md bg-brandGreenSoft border border-brandGreen/20 text-brandGreenDark text-xs font-medium flex gap-3 items-center">
            <span className="text-sm select-none">✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* Branding Configurations */}
        <div className="bg-canvas border border-slate/10 p-6 rounded-lg space-y-5">
          <h3 className="text-lg font-medium text-ink border-b border-slate/5 pb-3">
            Branding & Visual Identity
          </h3>

          <div>
            <label htmlFor="schoolName" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
              School Name
            </label>
            <input
              id="schoolName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
              School URL Slug (Tenant Key)
            </label>
            <input
              type="text"
              disabled
              value={school.slug}
              className="w-full bg-surface text-slate/60 cursor-not-allowed rounded-md px-3.5 py-2.5 text-sm border border-slate/10"
            />
            <p className="text-[10px] text-slate mt-1.5 leading-normal">
              To guarantee data isolation and access rules, the URL Slug identifier is locked.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate uppercase tracking-wider">
                School Logo
              </label>
              
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setLogoMode('upload')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    logoMode === 'upload'
                      ? 'bg-white dark:bg-slate-700 text-ink shadow-sm'
                      : 'text-slate hover:text-ink'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setLogoMode('url')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    logoMode === 'url'
                      ? 'bg-white dark:bg-slate-700 text-ink shadow-sm'
                      : 'text-slate hover:text-ink'
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {logoMode === 'upload' ? (
              <div className="border-2 border-dashed border-slate/20 rounded-md p-4 flex flex-col items-center justify-center bg-surface transition-all hover:border-slate/45 min-h-[96px]">
                {logoUrl && !logoUrl.startsWith('http') ? (
                  <div className="flex items-center gap-3 w-full">
                    <img
                      src={resolveLogoUrl(logoUrl)}
                      alt="Current logo"
                      className="w-12 h-12 rounded-md object-cover border border-slate/10 bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{logoUrl.split('/').pop()}</p>
                      <p className="text-[10px] text-slate">Local uploaded logo</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="text-xs text-red-500 hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="text-slate text-xl">📁</div>
                    <label className="block">
                      <span className="text-xs font-semibold text-brandTealDeep hover:underline cursor-pointer">
                        {uploadingLogo ? 'Uploading...' : 'Choose image file'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingLogo}
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[9px] text-slate">PNG, JPG, WEBP, or SVG up to 2MB</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <input
                  id="logoUrl"
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="e.g. https://example.com/logo.png"
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
                />
                <p className="text-[10px] text-slate mt-1.5 leading-normal">
                  Provide an absolute web link to your school logo image. Aspect ratio 1:1 recommended.
                </p>
              </div>
            )}
          </div>

          {/* Color Selectors */}
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-3">
              Brand Primary Color
            </label>
            
            <div className="flex flex-wrap gap-2.5 mb-4">
              {colorPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setBrandColor(preset.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                    brandColor === preset.value
                      ? 'border-ink bg-slate-100 text-ink shadow-sm'
                      : 'border-slate/10 text-slate hover:border-slate/30'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block"
                    style={{ backgroundColor: preset.value }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 border border-slate/10 p-4 rounded-md bg-surface">
              <input
                id="colorInput"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-10 border-0 cursor-pointer rounded-md outline-none bg-transparent"
              />
              <div className="flex-1">
                <label htmlFor="colorInput" className="block text-xs font-bold text-ink mb-0.5">Custom Hex Code</label>
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#000000"
                  maxLength={7}
                  className="text-xs bg-transparent border-b border-slate/20 focus:border-ink focus:outline-none text-mono p-1 uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="bg-canvas border border-slate/10 p-6 rounded-lg space-y-5">
          <h3 className="text-lg font-medium text-ink border-b border-slate/5 pb-3">
            Contact Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="contactEmail" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Contact Email
              </label>
              <input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="admin@school.com"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234..."
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label htmlFor="website" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Website URL
              </label>
              <input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
              Street Address
            </label>
            <textarea
              id="address"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full location address..."
              className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark transition-all"
            />
          </div>
        </div>

        {/* Configuration Switches */}
        <div className="bg-canvas border border-slate/10 p-6 rounded-lg space-y-6">
          <h3 className="text-lg font-medium text-ink border-b border-slate/5 pb-3">
            System Preferences
          </h3>

          <div className="flex items-start justify-between">
            <div className="max-w-[80%]">
              <h4 className="text-sm font-semibold text-ink">Enable Student Leaderboard</h4>
              <p className="text-xs text-slate mt-1 leading-normal">
                Permits students to view overall speech practice performance grades and rankings in their student dashboards.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowStudentLeaderboard(!allowStudentLeaderboard)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                allowStudentLeaderboard ? 'bg-brandGreen' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  allowStudentLeaderboard ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-start justify-between border-t border-slate/5 pt-6">
            <div className="max-w-[70%]">
              <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
                Google Classroom Integration
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    googleConnected
                      ? 'bg-brandGreenSoft text-brandGreenDark border border-brandGreenDark/10'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {googleConnected ? 'Connected' : 'Not Connected'}
                </span>
              </h4>
              <p className="text-xs text-slate mt-1 leading-normal">
                {googleConnected
                  ? 'Your school is linked to Google Classroom. You can sync rosters and auto-push grades.'
                  : 'Link your school to a Google Classroom account to manage rosters and grades.'}
              </p>
              
              {googleConnected && (
                <button
                  type="button"
                  onClick={handleSyncRosters}
                  disabled={syncingRosters}
                  className="mt-3 text-xs bg-brandTealDeep text-white border border-brandTealDeep/20 px-4 py-2 rounded-full hover:bg-brandTealDeep/90 disabled:opacity-50 transition-all font-semibold flex items-center gap-1.5"
                >
                  {syncingRosters ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Syncing Rosters...
                    </>
                  ) : (
                    'Sync Classroom Rosters'
                  )}
                </button>
              )}
            </div>
            {!googleConnected ? (
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="bg-brandGreen text-brandTealDeep px-4 py-2 rounded-full hover:bg-brandGreen/90 transition-all text-xs font-bold"
              >
                Connect Account
              </button>
            ) : (
              <div className="flex flex-col items-end gap-2">
                {!showAutoSync ? (
                  <button
                    type="button"
                    onClick={() => setShowAutoSync(true)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-ink px-3 py-1.5 rounded-full transition-all font-semibold"
                  >
                    Configure Auto Sync
                  </button>
                ) : (
                  <div className="flex flex-col items-end gap-2 p-3 bg-surface border border-slate/10 rounded-md animate-toast-in">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate font-medium">Auto Sync (24h)</span>
                      <button
                        type="button"
                        onClick={() => setGclassSyncEnabled(!gclassSyncEnabled)}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                          gclassSyncEnabled ? 'bg-brandGreen' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            gclassSyncEnabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAutoSync(false)}
                      className="text-[10px] text-brandTealDeep hover:underline font-semibold"
                    >
                      Hide sync settings
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-brandGreen text-brandTealDeep font-bold px-8 py-3.5 rounded-full hover:bg-brandGreen/90 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-brandTealDeep" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving Changes...
              </>
            ) : (
              'Save Configurations'
            )}
          </button>
        </div>
      </div>

      {/* Interactive Mock Preview Panel */}
      <div className="lg:col-span-1 space-y-6">
        <div className="sticky top-6 border border-slate/10 bg-canvasDark rounded-lg p-5 text-white shadow-lg space-y-6 select-none font-sans">
          <div className="border-b border-white/10 pb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brandGreen">
              Live Dashboard Preview
            </h4>
            <p className="text-[10px] text-white/50 mt-1">
              Visualizes how changes to logo and colors reflect on the student panel.
            </p>
          </div>

          {/* Miniature App Interface Frame */}
          <div className="border border-white/10 rounded-md bg-canvas text-ink overflow-hidden text-[10px]">
            {/* Mock Header */}
            <div
              className="h-10 flex items-center justify-between px-3 text-white transition-colors duration-300"
              style={{ backgroundColor: brandColor }}
            >
              <div className="flex items-center gap-1.5">
                {logoUrl ? (
                  <img src={resolveLogoUrl(logoUrl)} alt="Logo" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-brandGreen flex items-center justify-center font-bold text-brandTealDeep text-[8px]">
                    {name.charAt(0)}
                  </div>
                )}
                <span className="font-bold tracking-tight text-[9px] uppercase max-w-[80px] truncate">
                  {name}
                </span>
              </div>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-semibold text-white">
                JD
              </div>
            </div>

            {/* Mock Content */}
            <div className="p-4 bg-surface space-y-3.5">
              <div className="space-y-1">
                <div className="h-2.5 w-16 bg-slate/20 rounded" />
                <div className="h-1.5 w-24 bg-slate/10 rounded" />
              </div>

              {/* Mock Buttons and Components */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-canvas border border-slate/10 p-2 rounded flex flex-col justify-between h-14">
                  <span className="text-[8px] text-slate">Accuracy Score</span>
                  <span className="text-base font-bold text-brandTealDeep">87%</span>
                </div>
                <div className="bg-canvas border border-slate/10 p-2 rounded flex flex-col justify-between h-14">
                  <span className="text-[8px] text-slate">Practices Submitted</span>
                  <span className="text-base font-bold text-brandTealDeep">14</span>
                </div>
              </div>

              <div className="flex justify-between items-center bg-canvas p-2.5 rounded border border-slate/10">
                <span className="font-medium text-[8px]">Practice Lesson 3: Vowels</span>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-full text-[8px] font-bold transition-colors duration-300"
                  style={{ backgroundColor: brandColor, color: '#ffffff' }}
                >
                  Record
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] leading-normal text-white/70 space-y-2">
            <p>
              The <strong>Primary Brand Color</strong> dictates headers, navigation badges, and dynamic action buttons.
            </p>
            <p>
              Your <strong>Logo Url</strong> changes the top-left sidebar graphic.
            </p>
          </div>
        </div>
      </div>

      {/* Custom Styles for Entry Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-1rem);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-toast-in {
          animation: slideIn 0.2s ease-out forwards;
        }
      `}</style>

      {/* Toast Notification Container */}
      <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg border text-xs font-medium flex gap-3 items-start pointer-events-auto animate-toast-in transition-all duration-300 bg-white dark:bg-slate-900 ${
              toast.type === 'success'
                ? 'border-l-4 border-l-brandGreen border-slate-200 dark:border-slate-800 text-ink'
                : toast.type === 'error'
                ? 'border-l-4 border-l-red-500 border-slate-200 dark:border-slate-800 text-ink'
                : toast.type === 'warning'
                ? 'border-l-4 border-l-yellow-500 border-slate-200 dark:border-slate-800 text-ink'
                : 'border-l-4 border-l-blue-500 border-slate-200 dark:border-slate-800 text-ink'
            }`}
          >
            <span
              className={`text-sm select-none font-bold ${
                toast.type === 'success'
                  ? 'text-brandGreen'
                  : toast.type === 'error'
                  ? 'text-red-500'
                  : toast.type === 'warning'
                  ? 'text-yellow-500'
                  : 'text-blue-500'
              }`}
            >
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'warning' && '⚠'}
              {toast.type === 'info' && 'ℹ'}
            </span>
            <div className="flex-1">
              <p className="leading-relaxed">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 transition-colors ml-2 font-bold"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </form>
  );
}
