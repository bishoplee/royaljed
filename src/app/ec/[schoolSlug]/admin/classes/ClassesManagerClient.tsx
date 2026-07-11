'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserItem {
  id: string;
  fullName: string;
  email: string;
}

interface ClassData {
  id: string;
  name: string;
  category: 'NURSERY' | 'PRIMARY' | 'JUNIOR_SECONDARY' | 'SENIOR_SECONDARY' | 'OTHER';
  sortOrder: number;
  students: UserItem[];
  tutors: UserItem[];
}

interface ClassesManagerClientProps {
  initialClasses: ClassData[];
  allStudents: UserItem[];
  allTutors: UserItem[];
  schoolSlug: string;
}

export function ClassesManagerClient({
  initialClasses,
  allStudents,
  allTutors,
  schoolSlug,
}: ClassesManagerClientProps) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>(initialClasses);
  const [activeTab, setActiveTab] = useState<'list' | 'manual' | 'bulk'>('list');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Single Class Inputs
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'NURSERY' | 'PRIMARY' | 'JUNIOR_SECONDARY' | 'SENIOR_SECONDARY' | 'OTHER'>('PRIMARY');
  const [createTutorIds, setCreateTutorIds] = useState<string[]>([]);
  const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
  const [createTutorSearch, setCreateTutorSearch] = useState('');
  const [createStudentSearch, setCreateStudentSearch] = useState('');

  // Bulk Class Inputs
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [bulkSuffixes, setBulkSuffixes] = useState('1, 2, 3, 4, 5, 6');
  const [bulkCategory, setBulkCategory] = useState<'NURSERY' | 'PRIMARY' | 'JUNIOR_SECONDARY' | 'SENIOR_SECONDARY' | 'OTHER'>('PRIMARY');
  const [bulkTutorIds, setBulkTutorIds] = useState<string[]>([]);
  const [bulkStudentIds, setBulkStudentIds] = useState<string[]>([]);
  const [bulkTutorSearch, setBulkTutorSearch] = useState('');
  const [bulkStudentSearch, setBulkStudentSearch] = useState('');

  // Roster Manager Modal States
  const [managingClass, setManagingClass] = useState<ClassData | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<'NURSERY' | 'PRIMARY' | 'JUNIOR_SECONDARY' | 'SENIOR_SECONDARY' | 'OTHER'>('PRIMARY');
  const [selectedTutors, setSelectedTutors] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  // Search state inside Modal
  const [tutorSearch, setTutorSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // UX feedbacks
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const categories = ['ALL', 'NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY', 'OTHER'];

  const handleRefresh = async () => {
    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/classes`);
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (e) {
      console.error('Failed to reload class lists', e);
    }
  };

  // Submit single class creation
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          tutorIds: createTutorIds,
          studentIds: createStudentIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create class');
        setLoading(false);
        return;
      }

      setSuccess('Class created successfully!');
      setName('');
      setCreateTutorIds([]);
      setCreateStudentIds([]);
      setCreateTutorSearch('');
      setCreateStudentSearch('');
      setLoading(false);
      setActiveTab('list');
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Submit bulk class creation
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const suffixes = bulkSuffixes.split(',').map(s => s.trim()).filter(Boolean);
    if (suffixes.length === 0) {
      setError('At least one class suffix is required.');
      setLoading(false);
      return;
    }

    const bulkClasses = suffixes.map(suffix => ({
      name: `${bulkPrefix.trim()} ${suffix}`.trim(),
      category: bulkCategory,
    }));

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkClasses,
          tutorIds: bulkTutorIds,
          studentIds: bulkStudentIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Bulk class creation failed.');
        setLoading(false);
        return;
      }

      setSuccess(data.message || 'Bulk classes setup successfully!');
      setBulkPrefix('');
      setBulkTutorIds([]);
      setBulkStudentIds([]);
      setBulkTutorSearch('');
      setBulkStudentSearch('');
      setLoading(false);
      setActiveTab('list');
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Something went wrong during bulk creation.');
      setLoading(false);
    }
  };

  // Open manage modal
  const openManageModal = (c: ClassData) => {
    setManagingClass(c);
    setEditName(c.name);
    setEditCategory(c.category);
    setSelectedTutors(c.tutors.map(t => t.id));
    setSelectedStudents(c.students.map(s => s.id));
    setTutorSearch('');
    setStudentSearch('');
    setError('');
  };

  // Submit roster assignments updates
  const handleRosterSave = async () => {
    if (!managingClass) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/classes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: managingClass.id,
          name: editName,
          category: editCategory,
          tutorIds: selectedTutors,
          studentIds: selectedStudents,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update class assignments.');
        setLoading(false);
        return;
      }

      setSuccess('Class rosters updated successfully.');
      setManagingClass(null);
      setLoading(false);
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError('Something went wrong.');
      setLoading(false);
    }
  };

  const handleTutorToggle = (tutorId: string) => {
    setSelectedTutors(prev =>
      prev.includes(tutorId) ? prev.filter(id => id !== tutorId) : [...prev, tutorId]
    );
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleCreateTutorToggle = (tutorId: string) => {
    setCreateTutorIds(prev =>
      prev.includes(tutorId) ? prev.filter(id => id !== tutorId) : [...prev, tutorId]
    );
  };

  const handleCreateStudentToggle = (studentId: string) => {
    setCreateStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleBulkTutorToggle = (tutorId: string) => {
    setBulkTutorIds(prev =>
      prev.includes(tutorId) ? prev.filter(id => id !== tutorId) : [...prev, tutorId]
    );
  };

  const handleBulkStudentToggle = (studentId: string) => {
    setBulkStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Filters classes based on categories tabs
  const filteredClasses = classes.filter(
    c => categoryFilter === 'ALL' || c.category === categoryFilter
  );

  // Search filtered rosters for check selection
  const filteredModalTutors = allTutors.filter(
    t =>
      t.fullName.toLowerCase().includes(tutorSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(tutorSearch.toLowerCase())
  );

  const filteredModalStudents = allStudents.filter(
    s =>
      s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredCreateTutors = allTutors.filter(
    t =>
      t.fullName.toLowerCase().includes(createTutorSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(createTutorSearch.toLowerCase())
  );

  const filteredCreateStudents = allStudents.filter(
    s =>
      s.fullName.toLowerCase().includes(createStudentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(createStudentSearch.toLowerCase())
  );

  const filteredBulkTutors = allTutors.filter(
    t =>
      t.fullName.toLowerCase().includes(bulkTutorSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(bulkTutorSearch.toLowerCase())
  );

  const filteredBulkStudents = allStudents.filter(
    s =>
      s.fullName.toLowerCase().includes(bulkStudentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(bulkStudentSearch.toLowerCase())
  );

  const filteredCreateTutorIds = filteredCreateTutors.map((t) => t.id);
  const filteredCreateStudentIds = filteredCreateStudents.map((s) => s.id);
  const filteredBulkTutorIds = filteredBulkTutors.map((t) => t.id);
  const filteredBulkStudentIds = filteredBulkStudents.map((s) => s.id);

  const addIdsToSelection = (current: string[], idsToAdd: string[]) =>
    Array.from(new Set([...current, ...idsToAdd]));

  const removeIdsFromSelection = (current: string[], idsToRemove: string[]) =>
    current.filter((id) => !idsToRemove.includes(id));

  return (
    <div className="space-y-6">
      {/* Notifications */}
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
      <div className="flex border-b border-slate/10 gap-6 select-none font-sans">
        <button
          onClick={() => {
            setActiveTab('list');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'list'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          Classes Directory ({classes.length})
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
          Add Single Class
        </button>
        <button
          onClick={() => {
            setActiveTab('bulk');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'bulk'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          Quick Bulk Setup
        </button>
      </div>

      {/* TAB 1: CLASSES DIRECTORY */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          {/* Category Tabs Filters */}
          <div className="flex flex-wrap gap-2 select-none">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  categoryFilter === cat
                    ? 'bg-brandTealDeep border-brandTealDeep text-white shadow-sm'
                    : 'bg-canvas border-slate/10 text-slate hover:border-slate/30'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Classes Grid */}
          {filteredClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
              {filteredClasses.map(c => (
                <div
                  key={c.id}
                  className="bg-canvas border border-slate/10 p-6 rounded-lg flex flex-col justify-between hover:border-brandGreenDark/20 transition-all group h-[180px]"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-brandGreenSoft text-brandGreenDark tracking-wider uppercase">
                        {c.category.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate font-mono">ID: {c.id.substring(0, 8)}</span>
                    </div>
                    <h4 className="text-lg font-medium text-ink truncate group-hover:text-brandGreenDark transition-colors">
                      {c.name}
                    </h4>
                    <div className="flex items-center gap-3.5 text-xs text-slate mt-2.5">
                      <span className="flex items-center gap-1">
                        🧑‍🎓 <strong>{c.students.length}</strong> Students
                      </span>
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                      <span className="flex items-center gap-1">
                        🧑‍🏫 <strong>{c.tutors.length}</strong> Tutors
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => openManageModal(c)}
                    className="w-full bg-surface border border-slate/10 hover:bg-slate/5 text-ink font-semibold text-xs py-2 rounded-md transition-colors mt-4 text-center block select-none"
                  >
                    Manage Roster &rarr;
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-canvas border border-slate/10 rounded-lg py-16 text-center text-slate text-sm">
              No classes registered under the &quot;{categoryFilter.replace('_', ' ')}&quot; filter category.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL CREATION */}
      {activeTab === 'manual' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 max-w-3xl">
          <h3 className="text-lg font-medium text-ink border-b border-slate/5 pb-3 mb-5">
            Add New Class
          </h3>

          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div>
              <label htmlFor="className" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Class Name
              </label>
              <input
                id="className"
                type="text"
                required
                placeholder="e.g. Primary 1A"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
              />
            </div>

            <div>
              <label htmlFor="classCategory" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Class Category
              </label>
              <select
                id="classCategory"
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
              >
                <option value="NURSERY">Nursery</option>
                <option value="PRIMARY">Primary</option>
                <option value="JUNIOR_SECONDARY">Junior Secondary</option>
                <option value="SENIOR_SECONDARY">Senior Secondary</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate/10 rounded-lg p-3 bg-surface">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink uppercase tracking-wider">
                    Assign Tutors ({createTutorIds.length})
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreateTutorIds((prev) => addIdsToSelection(prev, filteredCreateTutorIds))}
                      disabled={filteredCreateTutorIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateTutorIds((prev) => removeIdsFromSelection(prev, filteredCreateTutorIds))}
                      disabled={filteredCreateTutorIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search tutors..."
                  value={createTutorSearch}
                  onChange={e => setCreateTutorSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
                />
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {filteredCreateTutors.map(tutor => {
                    const isSelected = createTutorIds.includes(tutor.id);
                    return (
                      <label key={tutor.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                        <span className="truncate pr-2">{tutor.fullName}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCreateTutorToggle(tutor.id)}
                          className="w-4 h-4 accent-brandGreen"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border border-slate/10 rounded-lg p-3 bg-surface">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink uppercase tracking-wider">
                    Enroll Students ({createStudentIds.length})
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreateStudentIds((prev) => addIdsToSelection(prev, filteredCreateStudentIds))}
                      disabled={filteredCreateStudentIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateStudentIds((prev) => removeIdsFromSelection(prev, filteredCreateStudentIds))}
                      disabled={filteredCreateStudentIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={createStudentSearch}
                  onChange={e => setCreateStudentSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
                />
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {filteredCreateStudents.map(student => {
                    const isSelected = createStudentIds.includes(student.id);
                    return (
                      <label key={student.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                        <span className="truncate pr-2">{student.fullName}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCreateStudentToggle(student.id)}
                          className="w-4 h-4 accent-brandGreen"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-brandGreen text-brandTealDeep font-bold px-6 py-2.5 rounded-full hover:bg-brandGreen/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? 'Creating...' : 'Create Class'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: QUICK BULK SETUP */}
      {activeTab === 'bulk' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 max-w-2xl space-y-6">
          <div className="border-b border-slate/5 pb-3">
            <h3 className="text-lg font-medium text-ink">
              Quick Setup Classes
            </h3>
            <p className="text-slate text-xs mt-1">
              Create multiple class streams rapidly using prefixes and suffix combinations.
            </p>
          </div>

          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bulkPrefix" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Class Name Prefix
                </label>
                <input
                  id="bulkPrefix"
                  type="text"
                  required
                  placeholder="e.g. Primary"
                  value={bulkPrefix}
                  onChange={e => setBulkPrefix(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="bulkCategory" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Category Type
                </label>
                <select
                  id="bulkCategory"
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value as any)}
                  className="w-full rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark bg-canvas"
                >
                  <option value="NURSERY">Nursery</option>
                  <option value="PRIMARY">Primary</option>
                  <option value="JUNIOR_SECONDARY">Junior Secondary</option>
                  <option value="SENIOR_SECONDARY">Senior Secondary</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="bulkSuffixes" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Suffix Values (Comma-separated)
              </label>
              <input
                id="bulkSuffixes"
                type="text"
                value={bulkSuffixes}
                onChange={e => setBulkSuffixes(e.target.value)}
                placeholder="e.g. 1, 2, 3, 4, 5, 6 or A, B, C"
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
              />
            </div>

            {/* Live generation view */}
            {bulkPrefix && (
              <div className="bg-surface rounded-md border border-slate/10 p-4">
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-2">
                  Preview Generated Classes:
                </span>
                <div className="flex flex-wrap gap-2 text-xs text-ink font-semibold">
                  {bulkSuffixes.split(',').map(s => s.trim()).filter(Boolean).map((suff, i) => (
                    <span key={i} className="px-2.5 py-1 bg-brandGreenSoft text-brandGreenDark border border-brandGreen/10 rounded">
                      {bulkPrefix.trim()} {suff}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate/10 rounded-lg p-3 bg-surface">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink uppercase tracking-wider">
                    Assign Tutors To Each Class ({bulkTutorIds.length})
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBulkTutorIds((prev) => addIdsToSelection(prev, filteredBulkTutorIds))}
                      disabled={filteredBulkTutorIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkTutorIds((prev) => removeIdsFromSelection(prev, filteredBulkTutorIds))}
                      disabled={filteredBulkTutorIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search tutors..."
                  value={bulkTutorSearch}
                  onChange={e => setBulkTutorSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
                />
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {filteredBulkTutors.map(tutor => {
                    const isSelected = bulkTutorIds.includes(tutor.id);
                    return (
                      <label key={tutor.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                        <span className="truncate pr-2">{tutor.fullName}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleBulkTutorToggle(tutor.id)}
                          className="w-4 h-4 accent-brandGreen"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border border-slate/10 rounded-lg p-3 bg-surface">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink uppercase tracking-wider">
                    Enroll Students In Each Class ({bulkStudentIds.length})
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBulkStudentIds((prev) => addIdsToSelection(prev, filteredBulkStudentIds))}
                      disabled={filteredBulkStudentIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkStudentIds((prev) => removeIdsFromSelection(prev, filteredBulkStudentIds))}
                      disabled={filteredBulkStudentIds.length === 0}
                      className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={bulkStudentSearch}
                  onChange={e => setBulkStudentSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
                />
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {filteredBulkStudents.map(student => {
                    const isSelected = bulkStudentIds.includes(student.id);
                    return (
                      <label key={student.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                        <span className="truncate pr-2">{student.fullName}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleBulkStudentToggle(student.id)}
                          className="w-4 h-4 accent-brandGreen"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !bulkPrefix.trim()}
              className="bg-brandGreen text-brandTealDeep font-bold px-6 py-2.5 rounded-full hover:bg-brandGreen/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? 'Bootstrapping...' : 'Bulk Boot Classes'}
            </button>
          </form>
        </div>
      )}

      {/* ROSTER MANAGER MODAL */}
      {managingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-brandTealDeep/50 backdrop-blur-xs" onClick={() => setManagingClass(null)} />
          <div className="relative bg-canvas border border-slate/10 rounded-lg p-6 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col justify-between shadow-2xl animate-fade-in font-sans">
            <div>
              <div className="flex justify-between items-start border-b border-slate/5 pb-3.5 mb-5">
                <div>
                  <h3 className="text-lg font-medium text-ink">
                    Manage Roster for {managingClass.name}
                  </h3>
                  <p className="text-slate text-xs mt-0.5">
                    Assign teachers and students enrolled under this class stream.
                  </p>
                </div>
                <button
                  onClick={() => setManagingClass(null)}
                  className="w-7 h-7 hover:bg-surface border border-slate/10 rounded-full flex items-center justify-center text-slate hover:text-ink transition-colors"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Class Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Class Category
                </label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value as any)}
                  className="w-full rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                >
                  <option value="NURSERY">Nursery</option>
                  <option value="PRIMARY">Primary</option>
                  <option value="JUNIOR_SECONDARY">Junior Secondary</option>
                  <option value="SENIOR_SECONDARY">Senior Secondary</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            {/* Roster Assignment Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1 mb-6 pr-1">
              
              {/* Tutor Assignment Column */}
              <div className="border border-slate/10 rounded-lg p-4 bg-surface flex flex-col h-[380px]">
                <div className="mb-3.5">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider block mb-1">
                    Assign Tutors ({selectedTutors.length})
                  </span>
                  <input
                    type="text"
                    placeholder="Filter tutors by name or email..."
                    value={tutorSearch}
                    onChange={e => setTutorSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                  />
                </div>

                <div className="overflow-y-auto flex-1 space-y-1.5 pr-0.5">
                  {filteredModalTutors.length > 0 ? (
                    filteredModalTutors.map(tutor => {
                      const isAssigned = selectedTutors.includes(tutor.id);
                      return (
                        <label
                          key={tutor.id}
                          className={`flex items-center justify-between p-2.5 rounded text-xs cursor-pointer border transition-colors ${
                            isAssigned
                              ? 'bg-brandGreenSoft/50 border-brandGreen/20 text-brandGreenDark'
                              : 'bg-canvas border-slate/5 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{tutor.fullName}</p>
                            <p className="text-[10px] opacity-75 truncate">{tutor.email}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => handleTutorToggle(tutor.id)}
                            className="w-4 h-4 accent-brandGreen cursor-pointer border-slate/20 rounded focus:ring-0 focus:ring-offset-0"
                          />
                        </label>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                      No matching tutors found.
                    </div>
                  )}
                </div>
              </div>

              {/* Student Assignment Column */}
              <div className="border border-slate/10 rounded-lg p-4 bg-surface flex flex-col h-[380px]">
                <div className="mb-3.5">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider block mb-1">
                    Enroll Students ({selectedStudents.length})
                  </span>
                  <input
                    type="text"
                    placeholder="Filter students by name or email..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                  />
                </div>

                <div className="overflow-y-auto flex-1 space-y-1.5 pr-0.5">
                  {filteredModalStudents.length > 0 ? (
                    filteredModalStudents.map(student => {
                      const isAssigned = selectedStudents.includes(student.id);
                      return (
                        <label
                          key={student.id}
                          className={`flex items-center justify-between p-2.5 rounded text-xs cursor-pointer border transition-colors ${
                            isAssigned
                              ? 'bg-brandGreenSoft/50 border-brandGreen/20 text-brandGreenDark'
                              : 'bg-canvas border-slate/5 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{student.fullName}</p>
                            <p className="text-[10px] opacity-75 truncate">{student.email}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => handleStudentToggle(student.id)}
                            className="w-4 h-4 accent-brandGreen cursor-pointer border-slate/20 rounded focus:ring-0 focus:ring-offset-0"
                          />
                        </label>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                      No matching students found.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate/10 pt-3.5 flex justify-end gap-2.5 select-none">
              <button
                type="button"
                onClick={() => setManagingClass(null)}
                className="px-4 py-2 border border-slate/10 text-xs font-semibold text-slate hover:bg-surface rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRosterSave}
                disabled={loading}
                className="px-6 py-2 bg-brandGreen text-brandTealDeep font-bold text-xs hover:bg-brandGreen/90 disabled:opacity-50 rounded-full transition-all flex items-center gap-1.5"
              >
                {loading ? 'Saving Changes...' : 'Save Roster Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
