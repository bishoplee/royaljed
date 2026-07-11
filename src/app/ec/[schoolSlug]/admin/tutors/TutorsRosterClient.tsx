'use client';

import React, { useState } from 'react';

interface ClassData {
  id: string;
  name: string;
}

interface TutorData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  classes: ClassData[];
}

interface TutorsRosterClientProps {
  initialTutors: TutorData[];
  availableClasses: ClassData[];
  schoolSlug: string;
}

export function TutorsRosterClient({ initialTutors, availableClasses, schoolSlug }: TutorsRosterClientProps) {
  const [tutors, setTutors] = useState<TutorData[]>(initialTutors);
  const [activeTab, setActiveTab] = useState<'roster' | 'manual'>('roster');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Manual Add Form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [createClassIds, setCreateClassIds] = useState<string[]>([]);
  const [createClassSearch, setCreateClassSearch] = useState('');

  // Edit Modal States
  const [editingTutor, setEditingTutor] = useState<TutorData | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editClassIds, setEditClassIds] = useState<string[]>([]);
  const [editClassSearch, setEditClassSearch] = useState('');

  // Feedbacks
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredCreateClasses = availableClasses.filter((c) =>
    c.name.toLowerCase().includes(createClassSearch.toLowerCase())
  );

  const filteredEditClasses = availableClasses.filter((c) =>
    c.name.toLowerCase().includes(editClassSearch.toLowerCase())
  );

  const handleCreateClassToggle = (classId: string) => {
    setCreateClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleEditClassToggle = (classId: string) => {
    setEditClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/tutors`);
      if (res.ok) {
        const data = await res.json();
        setTutors(data);
      }
    } catch (e) {
      console.error('Failed to reload tutor roster', e);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/tutors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone.trim() === '' ? null : phone,
          password: password.trim() === '' ? undefined : password,
          classIds: createClassIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to onboard tutor');
        setLoading(false);
        return;
      }

      setSuccess('Tutor registered successfully!');
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setCreateClassIds([]);
      setCreateClassSearch('');
      setLoading(false);
      setActiveTab('roster');
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleStatusToggle = async (tutorId: string, currentStatus: 'ACTIVE' | 'SUSPENDED') => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/tutors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorId,
          status: nextStatus,
        }),
      });

      if (res.ok) {
        setTutors(prev =>
          prev.map(t => (t.id === tutorId ? { ...t, status: nextStatus } : t))
        );
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (e) {
      alert('Error updating status');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTutor) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/tutors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorId: editingTutor.id,
          fullName: editName,
          email: editEmail,
          phone: editPhone.trim() === '' ? null : editPhone,
          classIds: editClassIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update tutor details');
        setLoading(false);
        return;
      }

      setSuccess('Tutor profile updated.');
      setEditingTutor(null);
      setLoading(false);
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError('Something went wrong.');
      setLoading(false);
    }
  };

  const filteredTutors = tutors.filter(
    t =>
      t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.phone && t.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Alerts */}
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

      {/* Tabs */}
      <div className="flex border-b border-slate/10 gap-6 select-none">
        <button
          onClick={() => {
            setActiveTab('roster');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'roster'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          Tutors Roster ({tutors.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('manual');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'manual'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          Add Tutor Account
        </button>
      </div>

      {/* TAB 1: TUTOR ROSTER LIST */}
      {activeTab === 'roster' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search tutors by name, email, phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate/20 rounded-md focus:outline-none focus:border-brandGreenDark"
              />
            </div>
            <button
              onClick={handleRefresh}
              className="text-xs font-semibold text-brandGreenDark hover:text-brandTealDeep flex items-center gap-1 border border-slate/10 px-3 py-2 rounded-md bg-surface"
            >
              🔄 Refresh List
            </button>
          </div>

          <div className="overflow-x-auto">
            {filteredTutors.length > 0 ? (
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate/10 text-slate uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3">Name</th>
                    <th className="py-3">Email</th>
                    <th className="py-3">Phone</th>
                    <th className="py-3">Classes Assigned</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate/5 text-slate-700">
                  {filteredTutors.map(tutor => (
                    <tr key={tutor.id} className="hover:bg-surface/50">
                      <td className="py-3.5 font-medium text-ink flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                          {tutor.fullName.charAt(0)}
                        </div>
                        {tutor.fullName}
                      </td>
                      <td className="py-3.5">{tutor.email}</td>
                      <td className="py-3.5 text-slate-500">{tutor.phone || '-'}</td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {tutor.classes.length > 0 ? (
                            tutor.classes.map(c => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-semibold"
                              >
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Class Assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tutor.status === 'ACTIVE'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {tutor.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingTutor(tutor);
                            setEditName(tutor.fullName);
                            setEditEmail(tutor.email);
                            setEditPhone(tutor.phone || '');
                            setEditClassIds(tutor.classes?.map((c) => c.id) || []);
                            setEditClassSearch('');
                          }}
                          className="text-brandTeal hover:underline font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleStatusToggle(tutor.id, tutor.status)}
                          className={`font-semibold ${
                            tutor.status === 'ACTIVE'
                              ? 'text-red-600 hover:underline'
                              : 'text-green-700 hover:underline'
                          }`}
                        >
                          {tutor.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate text-sm">
                {searchTerm ? 'No tutor matched your query.' : 'No tutors registered under this school roster yet.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL ADD TUTOR */}
      {activeTab === 'manual' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 max-w-2xl">
          <h3 className="text-lg font-medium text-ink border-b border-slate/5 pb-3 mb-5">
            Register Tutor Profile
          </h3>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="tutorName" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Tutor Full Name
              </label>
              <input
                id="tutorName"
                type="text"
                required
                placeholder="e.g. Dr. Jane Smith"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tutorEmail" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  id="tutorEmail"
                  type="email"
                  required
                  placeholder="tutor@school.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="tutorPhone" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Phone (Optional)
                </label>
                <input
                  id="tutorPhone"
                  type="text"
                  placeholder="+234..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tutorPass" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Custom Password (Optional)
              </label>
              <input
                id="tutorPass"
                type="password"
                placeholder="Defaults to password123"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
              />
            </div>

            <div className="border border-slate/10 rounded-lg p-3 bg-surface">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-ink uppercase tracking-wider">
                  Assign Classes ({createClassIds.length})
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCreateClassIds((prev) => Array.from(new Set([...prev, ...filteredCreateClasses.map((c) => c.id)])))}
                    disabled={filteredCreateClasses.length === 0}
                    className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateClassIds((prev) => prev.filter((id) => !filteredCreateClasses.some((c) => c.id === id)))}
                    disabled={filteredCreateClasses.length === 0}
                    className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Search classes..."
                value={createClassSearch}
                onChange={(e) => setCreateClassSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
              />
              <div className="max-h-44 overflow-y-auto space-y-1">
                {filteredCreateClasses.map((classItem) => {
                  const isSelected = createClassIds.includes(classItem.id);
                  return (
                    <label key={classItem.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                      <span className="truncate pr-2">{classItem.name}</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCreateClassToggle(classItem.id)}
                        className="w-4 h-4 accent-brandGreen"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-brandGreen text-brandTealDeep font-bold px-6 py-2.5 rounded-full hover:bg-brandGreen/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? 'Creating...' : 'Register Tutor'}
            </button>
          </form>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {editingTutor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-brandTealDeep/50 backdrop-blur-xs" onClick={() => setEditingTutor(null)} />
          <div className="relative bg-canvas border border-slate/10 rounded-lg p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <h3 className="text-base font-semibold text-ink border-b border-slate/5 pb-2.5 mb-4">
              Edit Tutor Profile
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="editTName" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  id="editTName"
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="editTEmail" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  id="editTEmail"
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="editTPhone" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Phone (Optional)
                </label>
                <input
                  id="editTPhone"
                  type="text"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div className="border border-slate/10 rounded-lg p-3 bg-surface">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-ink uppercase tracking-wider">
                    Assigned Classes ({editClassIds.length})
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditClassIds((prev) => Array.from(new Set([...prev, ...filteredEditClasses.map((c) => c.id)])))}
                      disabled={filteredEditClasses.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditClassIds((prev) => prev.filter((id) => !filteredEditClasses.some((c) => c.id === id)))}
                      disabled={filteredEditClasses.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search classes..."
                  value={editClassSearch}
                  onChange={(e) => setEditClassSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
                />
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {filteredEditClasses.map((classItem) => {
                    const isSelected = editClassIds.includes(classItem.id);
                    return (
                      <label key={classItem.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                        <span className="truncate pr-2">{classItem.name}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleEditClassToggle(classItem.id)}
                          className="w-4 h-4 accent-brandGreen"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTutor(null)}
                  className="px-4 py-2 border border-slate/10 text-xs text-slate hover:bg-surface rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brandGreen text-brandTealDeep font-bold text-xs hover:bg-brandGreen/90 disabled:opacity-50 rounded-full"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
