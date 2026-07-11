'use client';

import React, { useState } from 'react';

interface ClassData {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  classes: ClassData[];
}

interface StudentsRosterClientProps {
  initialStudents: StudentData[];
  availableClasses: ClassData[];
  schoolSlug: string;
}

export function StudentsRosterClient({ initialStudents, availableClasses, schoolSlug }: StudentsRosterClientProps) {
  const [students, setStudents] = useState<StudentData[]>(initialStudents);
  const [activeTab, setActiveTab] = useState<'roster' | 'manual' | 'csv'>('roster');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Manual Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [createClassId, setCreateClassId] = useState<string | null>(null);
  const [createClassSearch, setCreateClassSearch] = useState('');
  const classNameToId = new Map(
    availableClasses.map((classItem) => [classItem.name.toLowerCase().trim(), classItem.id])
  );
  
  // CSV Import States
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<{ fullName: string; email: string; phone: string; className: string; valid: boolean; errorReason?: string }[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Edit Modal States
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [editClassSearch, setEditClassSearch] = useState('');

  // UX Feedback
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
    setCreateClassId((prev) => (prev === classId ? null : classId));
  };

  const handleEditClassToggle = (classId: string) => {
    setEditClassId((prev) => (prev === classId ? null : classId));
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (e) {
      console.error('Failed to reload student roster', e);
    }
  };

  // Student manual add submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone.trim() === '' ? null : phone,
          password: password.trim() === '' ? undefined : password,
          classId: createClassId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to register student');
        setLoading(false);
        return;
      }

      setSuccess('Student account registered successfully!');
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setCreateClassId(null);
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

  // Toggle ACTIVE/SUSPENDED status
  const handleStatusToggle = async (studentId: string, currentStatus: 'ACTIVE' | 'SUSPENDED') => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          status: nextStatus,
        }),
      });

      if (res.ok) {
        setStudents(prev =>
          prev.map(s => (s.id === studentId ? { ...s, status: nextStatus } : s))
        );
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update student status');
      }
    } catch (err) {
      alert('Error updating status');
    }
  };

  // Edit Student submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editingStudent.id,
          fullName: editName,
          email: editEmail,
          phone: editPhone.trim() === '' ? null : editPhone,
          classId: editClassId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update student');
        setLoading(false);
        return;
      }

      setSuccess('Student profile updated.');
      setEditingStudent(null);
      setLoading(false);
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Something went wrong.');
      setLoading(false);
    }
  };

  // Parse CSV function
  const parseCSVData = (text: string) => {
    const rows = text.split('\n');
    const parsedRows = rows
      .map((row, index) => {
        if (index === 0 && row.toLowerCase().includes('name') && row.toLowerCase().includes('email')) {
          // Skip header row if present
          return null;
        }

        const cols = row.split(',');
        if (cols.length === 0 || row.trim() === '') return null;

        const name = cols[0] ? cols[0].trim() : '';
        const emailVal = cols[1] ? cols[1].trim() : '';
        const phoneVal = cols[2] ? cols[2].trim() : '';
        const classNameVal = cols[3] ? cols[3].trim() : '';

        // Validation checks
        let valid = true;
        let errorReason = '';

        if (!name) {
          valid = false;
          errorReason = 'Missing Name';
        } else if (!emailVal) {
          valid = false;
          errorReason = 'Missing Email';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          valid = false;
          errorReason = 'Invalid Email Format';
        } else if (classNameVal && !classNameToId.has(classNameVal.toLowerCase())) {
          valid = false;
          errorReason = 'Unknown Class Name';
        }

        return {
          fullName: name,
          email: emailVal,
          phone: phoneVal,
          className: classNameVal,
          valid,
          errorReason,
        };
      })
      .filter(Boolean) as any[];

    setCsvPreview(parsedRows);
  };

  const handleCsvPasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    parseCSVData(text);
  };

  // File reader for CSV
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSVData(text);
    };
    reader.readAsText(file);
  };

  // Bulk Import submit
  const handleBulkSubmit = async () => {
    const validStudents = csvPreview.filter(p => p.valid).map(p => ({
      fullName: p.fullName,
      email: p.email,
      phone: p.phone || null,
      classId: p.className ? classNameToId.get(p.className.toLowerCase()) : undefined,
    }));

    if (validStudents.length === 0) {
      setError('No valid student records found to import.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: validStudents }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Bulk registration failed.');
        setLoading(false);
        return;
      }

      setSuccess(data.message || 'Roster successfully imported!');
      setCsvText('');
      setCsvPreview([]);
      setCsvFile(null);
      setLoading(false);
      setActiveTab('roster');
      handleRefresh();

      setTimeout(() => setSuccess(''), 5000);
    } catch (e) {
      setError('Something went wrong during bulk submission.');
      setLoading(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const classExamples = availableClasses.slice(0, 2).map((classItem) => classItem.name);
    const firstClass = classExamples[0] || 'Primary 1A';
    const secondClass = classExamples[1] || firstClass;
    const csvTemplate = [
      'Name,Email,Phone,Class',
      `Jane Doe,jane.doe@example.com,+2348000000001,${firstClass}`,
      `John Smith,john.smith@example.com,+2348000000002,${secondClass}`,
    ].join('\n');

    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students-import-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Search filter matching
  const filteredStudents = students.filter(
    s =>
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm))
  );

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

      {/* Tabs Layout */}
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
          Student Directory ({students.length})
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
          Add Student Manually
        </button>
        <button
          onClick={() => {
            setActiveTab('csv');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'csv'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          CSV Batch Import
        </button>
      </div>

      {/* TAB 1: STUDENT DIRECTORY */}
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
                placeholder="Search students by name, email, or phone..."
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
            {filteredStudents.length > 0 ? (
              <table className="min-w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate/10 text-slate uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3">Full Name</th>
                    <th className="py-3">Email Address</th>
                    <th className="py-3">Phone</th>
                    <th className="py-3">Class Enrolled</th>
                    <th className="py-3">Account Status</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate/5 text-slate-700">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-surface/50">
                      <td className="py-3.5 font-medium text-ink flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                          {student.fullName.charAt(0)}
                        </div>
                        {student.fullName}
                      </td>
                      <td className="py-3.5">{student.email}</td>
                      <td className="py-3.5 text-slate-500">{student.phone || '-'}</td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {student.classes.length > 0 ? (
                            student.classes.map(c => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded bg-brandGreenSoft text-brandGreenDark text-[9px] font-semibold"
                              >
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Not Enrolled</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            student.status === 'ACTIVE'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setEditName(student.fullName);
                            setEditEmail(student.email);
                            setEditPhone(student.phone || '');
                            if ((student.classes?.length || 0) > 1) {
                              setError('This student currently has multiple class assignments. Saving will keep only one class.');
                            }
                            setEditClassId(student.classes?.[0]?.id || null);
                            setEditClassSearch('');
                          }}
                          className="text-brandTeal hover:underline font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleStatusToggle(student.id, student.status)}
                          className={`font-semibold ${
                            student.status === 'ACTIVE'
                              ? 'text-red-600 hover:underline'
                              : 'text-green-700 hover:underline'
                          }`}
                        >
                          {student.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate text-sm">
                {searchTerm ? 'No student matched your search filters.' : 'No students registered in this school roster yet.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL CREATION */}
      {activeTab === 'manual' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 max-w-2xl">
          <h3 className="text-lg font-medium text-ink border-b border-slate/5 pb-3 mb-5">
            Register Student Profile
          </h3>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Student Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="student@school.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Phone (Optional)
                </label>
                <input
                  id="phone"
                  type="text"
                  placeholder="+234..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pass" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Custom Password (Optional)
              </label>
              <input
                id="pass"
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
                  Assign Class {createClassId ? '(1)' : '(0)'}
                </p>
                <button
                  type="button"
                  onClick={() => setCreateClassId(null)}
                  disabled={!createClassId}
                  className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                >
                  Clear
                </button>
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
                  const isSelected = createClassId === classItem.id;
                  return (
                    <label key={classItem.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                      <span className="truncate pr-2">{classItem.name}</span>
                      <input
                        type="radio"
                        name="student-create-class"
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
              {loading ? 'Creating...' : 'Register Student'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: CSV BATCH IMPORT */}
      {activeTab === 'csv' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 space-y-6">
          <div className="border-b border-slate/5 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium text-ink">
                Roster CSV Bulk Importer
              </h3>
              <p className="text-slate text-xs mt-1">
                Add multiple students at once. Columns should be formatted as: <strong>Name, Email, Phone, Class</strong>. Headers are ignored automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="text-xs font-semibold text-brandGreenDark hover:text-brandTealDeep border border-slate/10 px-3 py-2 rounded-md bg-surface whitespace-nowrap"
            >
              Download Sample CSV
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Options */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="block w-full text-xs text-slate file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brandGreenSoft file:text-brandGreenDark hover:file:bg-brandGreenSoft/80"
                />
              </div>

              <div>
                <label htmlFor="csvPaste" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Or Paste CSV Text
                </label>
                <textarea
                  id="csvPaste"
                  rows={8}
                  placeholder="e.g.&#10;Michael Scott,michael@dunder.com,08011223344&#10;Dwight Schrute,dwight@dunder.com,08055667788"
                  value={csvText}
                  onChange={handleCsvPasteChange}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-xs font-mono border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>
            </div>

            {/* Preview Column */}
            <div className="border border-slate/10 rounded-lg p-4 bg-surface flex flex-col justify-between h-[320px] overflow-hidden">
              <div className="overflow-y-auto space-y-3 flex-1 mb-4">
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-1">
                  Parsing Live Preview
                </span>

                {csvPreview.length > 0 ? (
                  <div className="space-y-2.5 text-[11px] font-sans">
                    {csvPreview.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded border flex justify-between items-center ${
                          item.valid
                            ? 'bg-green-50/50 border-green-200 text-green-800'
                            : 'bg-red-50/50 border-red-200 text-red-800'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{item.fullName || 'Blank Name'}</p>
                          <p className="text-[10px] opacity-75">{item.email || 'Blank Email'}</p>
                          <p className="text-[10px] opacity-75">{item.className || 'No Class'}</p>
                        </div>
                        <div>
                          {item.valid ? (
                            <span className="text-[9px] font-bold bg-green-200 px-2 py-0.5 rounded">Valid</span>
                          ) : (
                            <span
                              className="text-[9px] font-bold bg-red-200 px-2 py-0.5 rounded cursor-help"
                              title={item.errorReason}
                            >
                              Error: {item.errorReason}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    Paste text or load a CSV file to inspect parse trees.
                  </div>
                )}
              </div>

              {csvPreview.length > 0 && (
                <div className="border-t border-slate/10 pt-3 flex justify-between items-center text-xs font-medium text-ink">
                  <span>
                    Valid: <span className="text-green-700 font-bold">{csvPreview.filter(p => p.valid).length}</span> | Invalid:{' '}
                    <span className="text-red-600 font-bold">{csvPreview.filter(p => !p.valid).length}</span>
                  </span>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={loading || csvPreview.filter(p => p.valid).length === 0}
                    className="bg-brandGreen text-brandTealDeep px-4 py-2 rounded-full font-bold hover:bg-brandGreen/90 disabled:opacity-50 transition-all text-[11px]"
                  >
                    {loading ? 'Submitting...' : 'Submit Import'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-brandTealDeep/50 backdrop-blur-xs" onClick={() => setEditingStudent(null)} />
          <div className="relative bg-canvas border border-slate/10 rounded-lg p-6 w-full max-w-md shadow-2xl animate-fade-in font-sans">
            <h3 className="text-base font-semibold text-ink border-b border-slate/5 pb-2.5 mb-4">
              Edit Student Profile
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="editName" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  id="editName"
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="editEmail" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  id="editEmail"
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="editPhone" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Phone (Optional)
                </label>
                <input
                  id="editPhone"
                  type="text"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div className="border border-slate/10 rounded-lg p-3 bg-surface">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-ink uppercase tracking-wider">
                    Assigned Class {editClassId ? '(1)' : '(0)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditClassId(null)}
                    disabled={!editClassId}
                    className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                  >
                    Clear
                  </button>
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
                    const isSelected = editClassId === classItem.id;
                    return (
                      <label key={classItem.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                        <span className="truncate pr-2">{classItem.name}</span>
                        <input
                          type="radio"
                          name="student-edit-class"
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
                  onClick={() => setEditingStudent(null)}
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
